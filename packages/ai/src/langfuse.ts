/**
 * Langfuse — AI observability: tracing, evaluation, and prompt management.
 *
 * Wired through OpenTelemetry for distributed tracing of AI generations.
 * Each LLM call is traced with: prompt, model, tokens, latency, cost,
 * and user feedback for evaluation.
 */
import { Langfuse } from 'langfuse';

export type LangfuseConfig = {
  publicKey: string;
  secretKey: string;
  baseURL?: string;
  flushAt?: number;
};

export type TraceContext = {
  traceId: string;
  generationId: string;
  name: string;
  model: string;
  input: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  startTime?: number;
  endTime?: number;
  tokens?: { prompt: number; completion: number };
};

export type LangfuseClient = {
  trace: (ctx: TraceContext) => void;
  flush: () => Promise<void>;
  shutdown: () => Promise<void>;
};

export function createLangfuse(config: LangfuseConfig): LangfuseClient {
  const client = new Langfuse({
    publicKey: config.publicKey,
    secretKey: config.secretKey,
    baseUrl: config.baseURL ?? 'https://cloud.langfuse.com',
    flushAt: config.flushAt ?? 1,
  });

  return {
    trace: (ctx) => {
      const trace = client.trace({
        id: ctx.traceId,
        name: ctx.name,
        metadata: ctx.metadata,
      });

      trace.generation({
        id: ctx.generationId,
        name: ctx.name,
        model: ctx.model,
        input: ctx.input,
        output: ctx.output,
        startTime: ctx.startTime ? new Date(ctx.startTime).toISOString() : undefined,
        endTime: ctx.endTime ? new Date(ctx.endTime).toISOString() : undefined,
        usage: ctx.tokens
          ? {
              promptTokens: ctx.tokens.prompt,
              completionTokens: ctx.tokens.completion,
            }
          : undefined,
      });
    },
    flush: () => client.flushAsync(),
    shutdown: () => client.shutdownAsync(),
  };
}

/**
 * Wrap a generation function with automatic Langfuse tracing.
 */
export function traceGeneration(
  client: LangfuseClient,
  name: string,
  model: string,
  fn: (input: unknown) => Promise<unknown>,
) {
  return async (input: unknown): Promise<unknown> => {
    const startTime = Date.now();
    const traceId = crypto.randomUUID();
    const generationId = crypto.randomUUID();

    let output: unknown;
    let error: Error | null = null;

    try {
      output = await fn(input);
      return output;
    } catch (e) {
      error = e as Error;
      throw e;
    } finally {
      const endTime = Date.now();
      client.trace({
        traceId,
        generationId,
        name,
        model,
        input,
        output: error ? undefined : output,
        metadata: error ? { error: error.message } : undefined,
        startTime,
        endTime,
      });
    }
  };
}
