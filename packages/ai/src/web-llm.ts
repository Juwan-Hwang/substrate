/**
 * WebLLM — generative on-device LLM inference via WebGPU.
 *
 * Runs LLMs entirely in the browser using WebGPU acceleration.
 * No server round-trip — the model is downloaded once and cached.
 * Used for generative on-device AI experiences.
 *
 * @mlc-ai/web-llm provides an OpenAI-compatible API surface.
 */
import type { MLCEngineConfig } from '@mlc-ai/web-llm';

export type WebLLMEngine = {
  chat: (
    messages: { role: string; content: string }[],
    options?: {
      stream?: boolean;
      temperature?: number;
      maxTokens?: number;
    },
  ) => Promise<unknown>;
  unload: () => Promise<void>;
};

export type WebLLMConfig = {
  model: string;
  options?: MLCEngineConfig;
};

export async function createWebLLM(config: WebLLMConfig): Promise<WebLLMEngine> {
  const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

  const engine = await CreateMLCEngine(
    config.model,
    config.options ?? {
      initProgressCallback: (report: { text: string; progress: number }) => {
        console.info(`[WebLLM] ${report.text} (${(report.progress * 100).toFixed(1)}%)`);
      },
    },
  );

  return {
    chat: async (messages, options) => {
      return engine.chat.completions.create({
        messages: messages as never,
        stream: options?.stream ?? false,
        temperature: options?.temperature ?? null,
        max_tokens: options?.maxTokens ?? null,
      });
    },
    unload: async () => {
      await engine.unload();
    },
  };
}
