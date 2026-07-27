/**
 * AI configuration — central config for all providers.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createWorkersAIProvider } from './provider-adapter.js';

export type ProviderType = 'openai' | 'anthropic' | 'google' | 'workers-ai' | 'web-llm';

export type AIConfig = {
  defaultProvider: ProviderType;
  openai?: { apiKey: string; baseURL?: string };
  anthropic?: { apiKey: string };
  google?: { apiKey: string };
  workersAI?: { accountId: string; apiToken: string };
  langfuse?: { publicKey: string; secretKey: string; baseURL?: string };
};

export type AI = {
  config: AIConfig;
  providers: Map<ProviderType, unknown>;
};

export function createAI(config: AIConfig): AI {
  const providers = new Map<ProviderType, unknown>();

  if (config.openai) {
    providers.set(
      'openai',
      createOpenAI({ apiKey: config.openai.apiKey, baseURL: config.openai.baseURL }),
    );
  }
  if (config.anthropic) {
    providers.set('anthropic', createAnthropic({ apiKey: config.anthropic.apiKey }));
  }
  if (config.google) {
    providers.set('google', createGoogleGenerativeAI({ apiKey: config.google.apiKey }));
  }
  if (config.workersAI) {
    // Workers AI can be used via REST API (provider-adapter.ts) or
    // via the Cloudflare Workers AI binding (env.AI.run()).
    // The REST adapter is registered here; the binding is used
    // directly in edge routes (@substrate/edge).
    providers.set(
      'workers-ai',
      createWorkersAIProvider(config.workersAI.accountId, config.workersAI.apiToken),
    );
  }

  return { config, providers };
}
