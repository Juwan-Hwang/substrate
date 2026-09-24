/**
 * AI configuration — central config for all providers.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createWorkersAIProvider } from './provider-adapter.js';

export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'workers-ai'
  | 'web-llm'
  | (string & {});

export type CustomProviderConfig = {
  baseURL: string;
  apiKey?: string;
};

export type AIConfig = {
  defaultProvider: ProviderType;
  openai?: { apiKey: string; baseURL?: string };
  anthropic?: { apiKey: string; baseURL?: string };
  google?: { apiKey: string; baseURL?: string };
  workersAI?: { accountId: string; apiToken: string };
  customProviders?: Record<string, CustomProviderConfig>;
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
    providers.set(
      'anthropic',
      createAnthropic({ apiKey: config.anthropic.apiKey, baseURL: config.anthropic.baseURL }),
    );
  }
  if (config.google) {
    providers.set(
      'google',
      createGoogleGenerativeAI({ apiKey: config.google.apiKey, baseURL: config.google.baseURL }),
    );
  }
  if (config.workersAI) {
    // Workers AI can be used via REST API (provider-adapter.ts) or
    // via the Cloudflare Workers AI binding (env.AI.run()).
    // The REST adapter is registered here; the binding is used
    // directly in edge routes (@substrate-platform/edge).
    providers.set(
      'workers-ai',
      createWorkersAIProvider(config.workersAI.accountId, config.workersAI.apiToken),
    );
  }
  if (config.customProviders) {
    for (const [name, custom] of Object.entries(config.customProviders)) {
      providers.set(
        name as ProviderType,
        createOpenAI({
          name,
          apiKey: custom.apiKey ?? 'custom-provider',
          baseURL: custom.baseURL,
        }),
      );
    }
  }

  return { config, providers };
}
