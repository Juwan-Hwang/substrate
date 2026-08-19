/**
 * Environment capability detection — the single source of truth for
 * graceful degradation.
 *
 * The app supports three independent tiers that compose freely:
 *  - Postgres FTS + pgvector  → live when {@link hasDatabase}
 *  - Live AI streaming + embeddings → live when {@link hasAI}
 *  - Orama client search + demo RAG → always available as a fallback
 *
 * Every server route and Server Action reads these helpers instead of
 * touching `process.env` directly, so the degradation rules live in
 * exactly one place.
 */

/** A PostgreSQL connection string is configured. */
export const hasDatabase = (): boolean => Boolean(process.env.DATABASE_URL);

/** At least one AI provider credential is configured. */
export const hasAI = (): boolean =>
  Boolean(process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY);

/** The configured database URL, or `undefined` when absent. */
export const databaseUrl = (): string | undefined => process.env.DATABASE_URL;

/** The OpenAI API key, or `undefined` when absent. */
export const openaiApiKey = (): string | undefined => process.env.OPENAI_API_KEY;
