/**
 * Effect — functional service composition, error handling, and runtime.
 *
 * Defines service interfaces (Context tags) and Layers for:
 *  - Database access (delegates to @substrate/db)
 *  - Logger (delegates to @substrate/observability)
 *  - AI provider (delegates to @substrate/ai)
 *
 * Effects are run via `Effect.runPromise` in Server Actions / edge handlers.
 */
import { Context, Effect, Layer } from 'effect';

// ── Service Tags ────────────────────────────────────────────────────

export interface DatabaseService {
  readonly _tag: 'DatabaseService';
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  insert<T>(table: string, data: Record<string, unknown>): Promise<T>;
}

export const DatabaseService = Context.GenericTag<DatabaseService>(
  '@substrate/contracts/DatabaseService',
);

export interface LoggerService {
  readonly _tag: 'LoggerService';
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
  metric(name: string, value: number, tags?: Record<string, string>): void;
}

export const LoggerService = Context.GenericTag<LoggerService>(
  '@substrate/contracts/LoggerService',
);

export interface AIService {
  readonly _tag: 'AIService';
  generateText(model: string, prompt: string, system?: string): Promise<string>;
  streamText(model: string, prompt: string, system?: string): AsyncIterable<string>;
}

export const AIService = Context.GenericTag<AIService>('@substrate/contracts/AIService');

// ── Error types ─────────────────────────────────────────────────────

export class DatabaseError {
  readonly _tag = 'DatabaseError';
  readonly cause: unknown;
  readonly query?: string | undefined;
  constructor(cause: unknown, query?: string) {
    this.cause = cause;
    this.query = query;
  }
}

export class ValidationError {
  readonly _tag = 'ValidationError';
  readonly field: string;
  readonly message: string;
  constructor(field: string, message: string) {
    this.field = field;
    this.message = message;
  }
}

export class NotFoundError {
  readonly _tag = 'NotFoundError';
  readonly resource: string;
  readonly id: string;
  constructor(resource: string, id: string) {
    this.resource = resource;
    this.id = id;
  }
}

// ── Effect programs ─────────────────────────────────────────────────

// ── Layers ──────────────────────────────────────────────────────────

/**
 * Console logger layer — for development and edge environments.
 */
export const ConsoleLoggerLayer = Layer.succeed(LoggerService, {
  _tag: 'LoggerService',
  info: (msg, ctx) => console.info(`[info] ${msg}`, ctx ?? ''),
  warn: (msg, ctx) => console.warn(`[warn] ${msg}`, ctx ?? ''),
  error: (msg, ctx) => console.error(`[error] ${msg}`, ctx ?? ''),
  metric: (name, value) => console.debug(`[metric] ${name} = ${value}`),
});

/**
 * Create a database layer from a query function.
 *
 * ```ts
 * const DbLayer = createDatabaseLayer({
 *   query: (sql, params) => client.unsafe(sql, params),
 *   insert: async (table, data) => { ... },
 * });
 * ```
 */
export function createDatabaseLayer(impl: {
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  insert: <T>(table: string, data: Record<string, unknown>) => Promise<T>;
}) {
  return Layer.succeed(DatabaseService, {
    _tag: 'DatabaseService',
    query: impl.query,
    insert: impl.insert,
  });
}

/**
 * Create an AI service layer from provider functions.
 */
export function createAILayer(impl: {
  generateText: (model: string, prompt: string, system?: string) => Promise<string>;
  streamText: (model: string, prompt: string, system?: string) => AsyncIterable<string>;
}) {
  return Layer.succeed(AIService, {
    _tag: 'AIService',
    generateText: impl.generateText,
    streamText: impl.streamText,
  });
}

/**
 * Run an Effect program, converting Effect errors to thrown Errors.
 *
 * ```ts
 * const article = await runEffect(fetchArticleBySlug('hello-world'), {
 *   database: dbLayer,
 *   logger: ConsoleLoggerLayer,
 * });
 * ```
 */
export async function runEffect<A, E>(
  program: Effect.Effect<A, E, DatabaseService | LoggerService | AIService>,
  layers: {
    database?: ReturnType<typeof createDatabaseLayer>;
    logger?: typeof ConsoleLoggerLayer;
    ai?: ReturnType<typeof createAILayer>;
  },
): Promise<A> {
  const allLayers = Layer.mergeAll(
    layers.database ?? ConsoleLoggerLayer,
    layers.logger ?? ConsoleLoggerLayer,
    layers.ai ?? ConsoleLoggerLayer,
  );
  const provided = program.pipe(Effect.provide(allLayers));
  // Effect.runPromise requires a clean Effect type; mergeAll produces a union that
  // the compiler cannot narrow. We assert the program type rather than using `any`.
  return Effect.runPromise(provided as unknown as Effect.Effect<A, never, never>) as Promise<A>;
}
