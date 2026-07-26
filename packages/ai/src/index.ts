/**
 * @substrate/ai — AI capabilities for Aevum.
 *
 * Vercel AI SDK as the core, with a provider adapter pattern that
 * routes to OpenAI / Anthropic / Google / Cloudflare Workers AI.
 * WebLLM + Transformers.js for client-side inference.
 * Hybrid Retrieval + Rerank for semantic search.
 * Langfuse for AI trace/eval wired through OpenTelemetry.
 */
export type { AIConfig, ProviderType } from './config.js';
export { createAI } from './config.js';
export { providerAdapter } from './provider-adapter.js';
export type { ProviderAdapter, ProviderMessage } from './provider-adapter.js';
export { hybridRetrieval, rerank } from './retrieval.js';
export type { RetrievalResult, HybridSearchParams } from './retrieval.js';
export { createWebLLM } from './web-llm.js';
export { createTransformers } from './transformers.js';
export { createLangfuse, traceGeneration } from './langfuse.js';
export { streamText, generateText, generateObject } from './actions.js';
