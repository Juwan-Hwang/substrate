/**
 * Server Actions — Crucible experiment submission & retrieval.
 *
 * Uses Next.js 16.3 Server Actions with 'use server' directive.
 * Validated with Zod, traced via @substrate/observability.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Subsystem } from '@substrate/web';

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

export async function submitExperiment(
  _prev: ExperimentActionState,
  formData: FormData,
): Promise<ExperimentActionState> {
  const raw = {
    name: formData.get('name'),
    subsystem: formData.get('subsystem'),
    parameters: JSON.parse(String(formData.get('parameters') ?? '{}')),
  };

  const parsed = experimentInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const id = crypto.randomUUID();
  // In production: persist to PostgreSQL via @substrate/db, enqueue via @substrate/edge.
  // For now, revalidate the path to refresh cached data.
  revalidatePath('/crucible');

  return { ok: true, id };
}

export async function getExperiments(subsystem?: Subsystem) {
  // In production: query from PostgreSQL via @substrate/db.
  // Server Actions can directly call the database — no API round-trip needed.
  const filter = subsystem ? `?subsystem=${subsystem}` : '';
  revalidatePath(`/crucible${filter}`);
  return [];
}
