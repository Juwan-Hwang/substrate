/**
 * AI actions — Vercel AI SDK wrapper functions.
 *
 * These wrap the Vercel AI SDK's core functions (streamText, generateText,
 * generateObject) with provider routing and Langfuse tracing.
 *
 * On the server (Server Actions / edge), uses cloud providers.
 * On the client, can fall back to WebLLM for on-device inference.
 */
import {
  generateObject as aiGenerateObject,
  generateText as aiGenerateText,
  streamText as aiStreamText,
} from 'ai';
import type { z } from 'zod';
import type { AI, ProviderType } from './config.js';
import type { LangfuseClient } from './langfuse.js';

export type AIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
};

export type StreamTextOptions = {
  provider?: ProviderType;
  model: string;
  system?: string;
  prompt?: string;
  messages?: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
  seed?: number;
  abortSignal?: AbortSignal;
  headers?: Record<string, string>;
};

export type GenerateTextOptions = StreamTextOptions;

export type GenerateObjectOptions<T extends z.ZodType> = {
  provider?: ProviderType;
  model: string;
  system?: string;
  prompt?: string;
  messages?: AIMessage[];
  schema: T;
  schemaName?: string;
  schemaDescription?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  seed?: number;
  abortSignal?: AbortSignal;
};

/** Resolve a model reference from the AI config. */
export function resolveModel(ai: AI, modelId: string, providerOverride?: ProviderType): unknown {
  let targetProvider = providerOverride ?? ai.config.defaultProvider;
  let targetModelId = modelId;

  // Support provider:model syntax (e.g. "openai:gpt-4o", "anthropic:claude-3-5-sonnet")
  const colonIndex = modelId.indexOf(':');
  if (colonIndex > 0 && !providerOverride) {
    const candidate = modelId.slice(0, colonIndex);
    if (ai.providers.has(candidate as ProviderType)) {
      targetProvider = candidate as ProviderType;
      targetModelId = modelId.slice(colonIndex + 1);
    }
  }

  const instance = ai.providers.get(targetProvider);
  if (!instance) {
    throw new Error(`Provider "${targetProvider}" not configured`);
  }

  // 1. In Vercel AI SDK, provider instances are typically functions: provider(modelId)
  if (typeof instance === 'function') {
    return (instance as (id: string) => unknown)(targetModelId);
  }

  // 2. Or they expose .languageModel(), .chat(), or .model()
  if (typeof (instance as { languageModel?: unknown }).languageModel === 'function') {
    return (instance as { languageModel: (id: string) => unknown }).languageModel(targetModelId);
  }
  if (typeof (instance as { chat?: unknown }).chat === 'function') {
    return (instance as { chat: (id: string) => unknown }).chat(targetModelId);
  }
  if (typeof (instance as { model?: unknown }).model === 'function') {
    return (instance as { model: (id: string) => unknown }).model(targetModelId);
  }

  return instance;
}

export function streamText(ai: AI, options: StreamTextOptions, langfuse?: LangfuseClient) {
  const model = resolveModel(ai, options.model, options.provider);
  const promptPayload = options.messages
    ? { messages: options.messages as never }
    : { prompt: options.prompt ?? '' };

  const result = aiStreamText({
    model: model as never,
    system: options.system,
    ...promptPayload,
    temperature: options.temperature,
    maxOutputTokens: options.maxTokens,
    topP: options.topP,
    topK: options.topK,
    presencePenalty: options.presencePenalty,
    frequencyPenalty: options.frequencyPenalty,
    stopSequences: options.stopSequences,
    seed: options.seed,
    abortSignal: options.abortSignal,
    headers: options.headers,
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
      input: options.messages ?? { system: options.system, prompt: options.prompt },
      startTime,
    });

    if (result && typeof result === 'object') {
      const pText = 'text' in result && result.text instanceof Promise ? result.text : null;
      const pUsage = 'usage' in result && result.usage instanceof Promise ? result.usage : null;
      if (pText || pUsage) {
        Promise.allSettled([pText, pUsage]).then(([textRes, usageRes]) => {
          const text = textRes.status === 'fulfilled' ? textRes.value : undefined;
          const usage =
            usageRes.status === 'fulfilled'
              ? (usageRes.value as
                  | {
                      inputTokens?: number;
                      outputTokens?: number;
                      promptTokens?: number;
                      completionTokens?: number;
                    }
                  | undefined)
              : undefined;
          const isError = textRes.status === 'rejected';
          langfuse.trace({
            traceId,
            generationId,
            name: 'streamText',
            model: options.model,
            input: options.messages ?? { system: options.system, prompt: options.prompt },
            output: isError ? textRes.reason : text,
            startTime,
            endTime: Date.now(),
            tokens: usage
              ? {
                  prompt: usage.inputTokens ?? usage.promptTokens ?? 0,
                  completion: usage.outputTokens ?? usage.completionTokens ?? 0,
                }
              : undefined,
          });
        });
      }
    }
  }

  return result;
}

export async function generateText(
  ai: AI,
  options: GenerateTextOptions,
  langfuse?: LangfuseClient,
) {
  const model = resolveModel(ai, options.model, options.provider);
  const startTime = Date.now();
  const promptPayload = options.messages
    ? { messages: options.messages as never }
    : { prompt: options.prompt ?? '' };

  const result = await aiGenerateText({
    model: model as never,
    system: options.system,
    ...promptPayload,
    temperature: options.temperature,
    maxOutputTokens: options.maxTokens,
    topP: options.topP,
    topK: options.topK,
    presencePenalty: options.presencePenalty,
    frequencyPenalty: options.frequencyPenalty,
    stopSequences: options.stopSequences,
    seed: options.seed,
    abortSignal: options.abortSignal,
    headers: options.headers,
  });

  if (langfuse) {
    langfuse.trace({
      traceId: crypto.randomUUID(),
      generationId: crypto.randomUUID(),
      name: 'generateText',
      model: options.model,
      input: options.messages ?? { system: options.system, prompt: options.prompt },
      output: result.text,
      startTime,
      endTime: Date.now(),
      tokens: {
        prompt: result.usage?.inputTokens ?? 0,
        completion: result.usage?.outputTokens ?? 0,
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
  const model = resolveModel(ai, options.model, options.provider);
  const startTime = Date.now();
  const promptPayload = options.messages
    ? { messages: options.messages as never }
    : { prompt: options.prompt ?? '' };

  const result: { object: unknown; usage?: { inputTokens?: number; outputTokens?: number } } =
    await aiGenerateObject({
      model: model as never,
      system: options.system,
      ...promptPayload,
      schema: options.schema,
      schemaName: options.schemaName,
      schemaDescription: options.schemaDescription,
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
      topP: options.topP,
      seed: options.seed,
      abortSignal: options.abortSignal,
    } as never);

  if (langfuse) {
    langfuse.trace({
      traceId: crypto.randomUUID(),
      generationId: crypto.randomUUID(),
      name: 'generateObject',
      model: options.model,
      input: options.messages ?? { system: options.system, prompt: options.prompt },
      output: result.object,
      startTime,
      endTime: Date.now(),
      tokens: result.usage
        ? {
            prompt: result.usage.inputTokens ?? 0,
            completion: result.usage.outputTokens ?? 0,
          }
        : undefined,
    });
  }

  return result;
}
