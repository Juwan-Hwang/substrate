/**
 * Next.js instrumentation — initialises the AI Archive feature manifest
 * and validates environment variables when the server boots.
 *
 * The manifest (`@substrate/config`) is the single source of truth for
 * which capabilities are enabled. Missing OPTIONAL credentials
 * (`DATABASE_URL`, `OPENAI_API_KEY`) are not fatal: the app degrades to
 * Orama client-side search and demo RAG answers, so we only warn.
 */
import { aiArchiveFeatures, initFeatures, validateEnv } from '@substrate/config/features';

export async function register(): Promise<void> {
  initFeatures(aiArchiveFeatures);

  // The full manifest asks for auth/Turso/OTel which this example does
  // not exercise — filter to the optional vars we actually degrade on.
  const relevant = validateEnv(aiArchiveFeatures).filter((v) =>
    ['DATABASE_URL', 'OPENAI_API_KEY or ANTHROPIC_API_KEY'].includes(v),
  );

  if (relevant.length > 0) {
    console.warn(
      `[ai-archive] Optional credentials not set: ${relevant.join(', ')}. ` +
        'Running in degraded mode (Orama search / demo RAG).',
    );
  }
}
