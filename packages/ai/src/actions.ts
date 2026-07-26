/**
 * AI actions — Vercel AI SDK wrapper functions.
 *
 * These wrap the Vercel AI SDK's core functions (streamText, generateText,
 * generateObject) with provider routing and Langfuse tracing.
 *
 * On the server (Server Actions / edge), uses cloud providers.
 * On the client, can fall back to WebLLM for on-device inference.
 */
import { streamText as aiStreamText, generateText as aiGenerateText, generateObject as aiGenerateObject } from 'ai';
import type { z } from 'zod';
import type { AI } from './config.js';
import type { LangfuseClient } from './langfuse.js';

export type StreamTextOptions = {
  model: string;
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
};

export type GenerateTextOptions = StreamTextOptions;

export type GenerateObjectOptions<T extends z.ZodType> = {
  model: string;
  system?: string;
  prompt: string;
  schema: T;
  temperature?: number;
};

/** Resolve a model reference from the AI config. */
function resolveModel(ai: AI, modelId: string): unknown {
  const provider = ai.config.defaultProvider;
  const instance = ai.providers.get(provider);
  if (!instance) {
    throw new Error(`Provider "${provider}" not configured`);
  }
  // Vercel AI SDK providers expose .model() or .chat() — delegate to the instance.
  if (provider === 'openai' && typeof (instance as { chat?: unknown }).chat === 'function') {
    return (instance as { chat: (id: string) => unknown }).chat(modelId);
  }
  if (typeof (instance as { model?: unknown }).model === 'function') {
    return (instance as { model: (id: string) => unknown }).model(modelId);
  }
  return instance;
}

export function streamText(ai: AI, options: StreamTextOptions, langfuse?: LangfuseClient) {
  const model = resolveModel(ai, options.model);
  const result = aiStreamText({
    model: model as never,
    system: options.system,
    prompt: options.prompt,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });

  if (langfuse) {
    const traceId = crypto.randomUUID();
    const generationId = crypto.randomUUID();
    const startTime = Date.now();
    langfuse.trace({
      traceId,
      generationId,
      name: 'streamText',
      model: options.model,
      input: { system: options.system, prompt: options.prompt },
      startTime,
    });
  }

  return result;
}

export async function generateText(
  ai: AI,
  options: GenerateTextOptions,
  langfuse?: LangfuseClient,
) {
  const model = resolveModel(ai, options.model);
  const startTime = Date.now();
  const result = await aiGenerateText({
    model: model as never,
    system: options.system,
    prompt: options.prompt,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });

  if (langfuse) {
    langfuse.trace({
      traceId: crypto.randomUUID(),
      generationId: crypto.randomUUID(),
      name: 'generateText',
      model: options.model,
      input: { system: options.system, prompt: options.prompt },
      output: result.text,
      startTime,
      endTime: Date.now(),
      tokens: {
        prompt: result.usage?.promptTokens ?? 0,
        completion: result.usage?.completionTokens ?? 0,
      },
    });
  }

  return result;
}

export async function generateObject<T extends z.ZodType>(
  ai: AI,
  options: GenerateObjectOptions<T>,
  langfuse?: LangfuseClient,
) {
  const model = resolveModel(ai, options.model);
  const startTime = Date.now();
  const result = await aiGenerateObject({
    model: model as never,
    system: options.system,
    prompt: options.prompt,
    schema: options.schema,
    temperature: options.temperature,
  });

  if (langfuse) {
    langfuse.trace({
      traceId: crypto.randomUUID(),
      generationId: crypto.randomUUID(),
      name: 'generateObject',
      model: options.model,
      input: { system: options.system, prompt: options.prompt },
      output: result.object,
      startTime,
      endTime: Date.now(),
    });
  }

  return result;
}
