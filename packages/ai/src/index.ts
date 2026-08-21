/**
 * @substrate-platform/ai — AI capabilities for Substrate-based sites.
 *
 * Vercel AI SDK as the core, with a provider adapter pattern that
 * routes to OpenAI / Anthropic / Google / Cloudflare Workers AI.
 * WebLLM + Transformers.js for client-side inference.
 * Hybrid Retrieval + Rerank for semantic search.
 * Langfuse for AI trace/eval wired through OpenTelemetry.
 */

export { generateObject, generateText, streamText } from './actions.js';
export type { AIConfig, ProviderType } from './config.js';
export { createAI } from './config.js';
export { createLangfuse, traceGeneration } from './langfuse.js';
export type { ProviderAdapter, ProviderMessage } from './provider-adapter.js';
export { createWorkersAIProvider, providerAdapter } from './provider-adapter.js';
export type { HybridSearchParams, RetrievalResult } from './retrieval.js';
export { hybridRetrieval, rerank } from './retrieval.js';
export { createTransformers } from './transformers.js';
export { createWebLLM } from './web-llm.js';
