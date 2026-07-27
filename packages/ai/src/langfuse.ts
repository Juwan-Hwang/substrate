/**
 * Langfuse — AI observability with OpenTelemetry bridge.
 *
 * Boundary (see CONTRIBUTING.md):
 *   OpenTelemetry → HTTP requests, DB queries, queue consumption, Worker timing
 *   Langfuse      → AI only: prompt version, token usage, model call chain, cost, eval scores
 *
 * Integration:
 *   Each AI generation creates TWO correlated records that share a trace ID:
 *   1. An OTel span with `gen_ai.*` attributes → flows to Grafana via the
 *      shared OTel pipeline (@substrate/observability). This is the SAME
 *      pipeline that carries system-level traces, so AI calls appear
 *      inline with the request that triggered them.
 *   2. A Langfuse trace → flows to Langfuse Cloud for the AI-specific
 *      dashboard (prompt diffing, cost breakdown, eval scores).
 *
 *   There is ONE trace context, not two. The OTel span is the parent;
 *   Langfuse receives the same trace ID for cross-linking.
 */

import { context, trace as otelTrace, SpanStatusCode, type Tracer } from '@opentelemetry/api';
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

const TRACER_NAME = '@substrate/ai/langfuse';
const otelTracer: Tracer = otelTrace.getTracer(TRACER_NAME);

export function createLangfuse(config: LangfuseConfig): LangfuseClient {
  const client = new Langfuse({
    publicKey: config.publicKey,
    secretKey: config.secretKey,
    baseUrl: config.baseURL ?? 'https://cloud.langfuse.com',
    flushAt: config.flushAt ?? 1,
  });

  return {
    trace: (ctx) => {
      // ── 1. Langfuse trace (AI-specific dashboard) ─────────────────
      const lfTrace = client.trace({
        id: ctx.traceId,
        name: ctx.name,
        metadata: ctx.metadata,
      });

      lfTrace.generation({
        id: ctx.generationId,
        name: ctx.name,
        model: ctx.model,
        input: ctx.input,
        output: ctx.output,
        startTime: ctx.startTime ? new Date(ctx.startTime) : undefined,
        endTime: ctx.endTime ? new Date(ctx.endTime) : undefined,
        usage: ctx.tokens
          ? {
              promptTokens: ctx.tokens.prompt,
              completionTokens: ctx.tokens.completion,
            }
          : undefined,
      });

      // ── 2. OTel span (shared pipeline → Grafana) ──────────────────
      // Uses OpenTelemetry GenAI semantic conventions so the span is
      // recognised as an AI generation by any OTel-compatible backend.
      const span = otelTracer.startSpan(ctx.name, {
        attributes: {
          'gen_ai.system': ctx.model.split('/')[0] ?? 'unknown',
          'gen_ai.request.model': ctx.model,
          'langfuse.trace.id': ctx.traceId,
          'langfuse.generation.id': ctx.generationId,
          ...(ctx.tokens
            ? {
                'gen_ai.usage.input_tokens': ctx.tokens.prompt,
                'gen_ai.usage.output_tokens': ctx.tokens.completion,
              }
            : {}),
          ...ctx.metadata,
        },
        startTime: ctx.startTime,
      });

      if (ctx.output instanceof Error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: ctx.output.message });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end(ctx.endTime);
    },
    flush: () => client.flushAsync(),
    shutdown: () => client.shutdownAsync(),
  };
}

/**
 * Wrap a generation function with automatic Langfuse + OTel tracing.
 *
 * The returned function creates a single trace context that is visible
 * in both Langfuse (AI dashboard) and Grafana (system dashboard).
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

    // Start an OTel span as the active context so child spans
    // (e.g. from @substrate/observability instrumentation) are
    // automatically nested under this AI generation.
    const span = otelTracer.startSpan(`${name} (ai.generation)`, {
      attributes: {
        'gen_ai.system': model.split('/')[0] ?? 'unknown',
        'gen_ai.request.model': model,
        'langfuse.trace.id': traceId,
        'langfuse.generation.id': generationId,
      },
      startTime,
    });

    let output: unknown;
    let error: Error | null = null;

    try {
      output = await context.with(otelTrace.setSpan(context.active(), span), () => fn(input));
      return output;
    } catch (e) {
      error = e as Error;
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw e;
    } finally {
      const endTime = Date.now();
      span.end(endTime);

      // Send the same trace to Langfuse for AI-specific analytics.
      client.trace({
        traceId,
        generationId,
        name,
        model,
        input,
        ...(error ? {} : { output }),
        ...(error ? { metadata: { error: error.message } } : {}),
        startTime,
        endTime,
      });
    }
  };
}
