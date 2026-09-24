/**
 * @substrate-platform/ai — AI capabilities for Substrate-based sites.
 *
 * Vercel AI SDK as the core, with a provider adapter pattern that
 * routes to OpenAI / Anthropic / Google / Cloudflare Workers AI.
 * WebLLM + Transformers.js for client-side inference.
 * Hybrid Retrieval + Rerank for semantic search.
 * Langfuse for AI trace/eval wired through OpenTelemetry.
 */

export type {
  AIMessage,
  GenerateObjectOptions,
  GenerateTextOptions,
  StreamTextOptions,
} from './actions.js';
export { generateObject, generateText, resolveModel, streamText } from './actions.js';
export type { AI, AIConfig, CustomProviderConfig, ProviderType } from './config.js';
export { createAI } from './config.js';
export type { LangfuseClient, LangfuseConfig, TraceContext } from './langfuse.js';
export { createLangfuse, traceGeneration } from './langfuse.js';
export type { ProviderAdapter, ProviderMessage } from './provider-adapter.js';
export { createWorkersAIProvider, providerAdapter } from './provider-adapter.js';
export type {
  HybridSearchConfig,
  HybridSearchParams,
  RetrievalResult,
  ScoredItem,
  WeightedRankedList,
} from './retrieval.js';
export { hybridRetrieval, rerank, rrf } from './retrieval.js';
export type { Transformers, TransformersConfig } from './transformers.js';
export { createTransformers } from './transformers.js';
export type { WebLLMConfig, WebLLMEngine } from './web-llm.js';
export { createWebLLM } from './web-llm.js';
