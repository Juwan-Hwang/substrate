/**
 * Server Actions — Crucible experiment submission & retrieval.
 *
 * Uses Next.js 16.3 Server Actions with 'use server' directive.
 * Validated with Zod, persisted to PostgreSQL via @substrate/db.
 */
'use server';

import * as Sentry from '@sentry/nextjs';
import { experimentSchema } from '@substrate/contracts';
import { createAuth } from '@substrate/contracts/auth';
import { createDb, experiments } from '@substrate/db';
import { createLogger } from '@substrate/observability';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';

const logger = createLogger('Crucible');

const experimentInputSchema = z.object({
  name: z.string().min(1).max(120),
  subsystem: z.enum(['lattice', 'crucible', 'archive']),
  parameters: z.record(z.string(), z.string()).default({}),
});

export type ExperimentInput = z.infer<typeof experimentInputSchema>;
export type ExperimentActionState = {
  ok: boolean;
  id?: string;
  error?: string;
};

/** Validated shape of a persisted experiment row returned to the client. */
export type ExperimentRow = z.infer<typeof experimentSchema>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required. Set it in your environment or .env file. ` +
        'See .env.example for all required variables.',
    );
  }
  return value;
}

const auth = createAuth({
  databaseUrl: requireEnv('DATABASE_URL'),
  secret: requireEnv('AUTH_SECRET'),
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
});

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not configured');
  }
  return createDb({ url });
}

export async function submitExperiment(
  _prev: ExperimentActionState,
  formData: FormData,
): Promise<ExperimentActionState> {
  // Defense-in-depth auth check: middleware already gates /crucible, but
  // Server Actions can be invoked directly — verify the session here too.
  let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;
  try {
    session = await auth.api.getSession({ headers: await headers() });
  } catch {
    return { ok: false, error: 'You must be signed in to submit an experiment.' };
  }

  if (!session) {
    return { ok: false, error: 'You must be signed in to submit an experiment.' };
  }

  let parameters: unknown;
  try {
    parameters = JSON.parse(String(formData.get('parameters') ?? '{}'));
  } catch {
    return { ok: false, error: 'Invalid parameters format' };
  }

  const raw = {
    name: formData.get('name'),
    subsystem: formData.get('subsystem'),
    parameters,
  };

  const parsed = experimentInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    const db = getDb();
    const [row] = await db
      .insert(experiments)
      .values({
        name: parsed.data.name,
        subsystem: parsed.data.subsystem,
        parameters: parsed.data.parameters,
        userId: session.user.id,
      })
      .returning({ id: experiments.id });

    revalidatePath('/crucible');
    return { ok: true, id: row?.id };
  } catch (err) {
    logger.log({
      level: 'error',
      subsystem: 'Crucible',
      message: 'submitExperiment failed',
      timestamp: Date.now(),
      context: { error: err },
    });
    Sentry.captureException(err);
    return { ok: false, error: 'Failed to submit experiment. Please try again.' };
  }
}

export async function getExperiments(subsystem?: string): Promise<ExperimentRow[]> {
  // Defense-in-depth auth check: verify session before returning any data.
  let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;
  try {
    session = await auth.api.getSession({ headers: await headers() });
  } catch {
    return [];
  }

  if (!session) {
    return [];
  }

  try {
    const db = getDb();

    // Scope to the authenticated user's experiments only.
    const rows = subsystem
      ? await db.execute(
          sql`SELECT * FROM experiments WHERE user_id = ${session.user.id} AND subsystem = ${subsystem} ORDER BY created_at DESC LIMIT 50`,
        )
      : await db.execute(
          sql`SELECT * FROM experiments WHERE user_id = ${session.user.id} ORDER BY created_at DESC LIMIT 50`,
        );

    // Raw rows arrive with snake_case columns (created_at, user_id,
    // duration_ms, …). Map them onto the camelCase shape expected by
    // experimentSchema, then validate with Zod so a malformed row can
    // never reach the client.
    const mapped = (rows as Record<string, unknown>[]).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      name: String(row.name),
      subsystem: String(row.subsystem) as 'lattice' | 'crucible' | 'archive',
      parameters: (row.parameters as Record<string, string>) ?? {},
      result: (row.result as Record<string, unknown> | null) ?? undefined,
      durationMs: row.duration_ms != null ? Number(row.duration_ms) : undefined,
    }));

    const validated = z.array(experimentSchema).safeParse(mapped);
    if (!validated.success) {
      logger.log({
        level: 'error',
        subsystem: 'Crucible',
        message: 'getExperiments validation failed',
        timestamp: Date.now(),
        context: { error: validated.error },
      });
      return [];
    }
    return validated.data;
  } catch (err) {
    logger.log({
      level: 'error',
      subsystem: 'Crucible',
      message: 'getExperiments failed',
      timestamp: Date.now(),
      context: { error: err },
    });
    Sentry.captureException(err);
    return [];
  }
}
