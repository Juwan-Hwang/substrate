/**
 * Provider Adapter — unified interface across all AI providers.
 *
 * Allows swapping between cloud providers (OpenAI, Anthropic, Google,
 * Cloudflare Workers AI) and edge providers (WebLLM) without changing
 * calling code. Each provider maps to the Vercel AI SDK's LanguageModel
 * interface.
 */
import type { AIConfig, ProviderType } from './config.js';

export type ProviderMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
};

export type ProviderAdapter = {
  type: ProviderType;
  model: (modelId: string) => unknown;
  /** Cloudflare Workers AI — runs inference on Cloudflare's edge network. */
  workersAI?: (modelId: string) => unknown;
};

/** Cloudflare Workers AI binding (fetch-based, no SDK needed). */
function createWorkersAIProvider(accountId: string, apiToken: string) {
  return {
    model: (modelId: string) => ({
      async doGenerate(options: { prompt: string; system?: string }) {
        const res = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelId}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: options.prompt,
              system: options.system,
            }),
          },
        );
        const data = await res.json();
        return data;
      },
    }),
  };
}

export function providerAdapter(config: AIConfig): ProviderAdapter {
  const adapter: ProviderAdapter = {
    type: config.defaultProvider,
    model: () => {
      throw new Error('No provider configured');
    },
  };

  switch (config.defaultProvider) {
    case 'workers-ai':
      if (config.workersAI) {
        const wai = createWorkersAIProvider(config.workersAI.accountId, config.workersAI.apiToken);
        adapter.workersAI = (modelId: string) => wai.model(modelId);
        adapter.model = adapter.workersAI;
      }
      break;
    case 'web-llm':
      // WebLLM is initialized client-side via createWebLLM().
      adapter.model = () => {
        throw new Error('WebLLM must be initialized via createWebLLM() on the client');
      };
      break;
    default:
      // Cloud providers are initialized in createAI() via Vercel AI SDK.
      adapter.model = (modelId: string) => modelId;
  }

  return adapter;
}
