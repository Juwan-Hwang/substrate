/**
 * Transformers.js — on-device task models via WebGPU/WASM.
 *
 * Runs Hugging Face models directly in the browser for:
 *  - Embeddings (for semantic search / pgvector queries)
 *  - Text classification (sentiment, toxicity)
 *  - Token classification (NER)
 *  - Zero-shot classification (reranking)
 *
 * Models are cached in the browser after first download.
 * Loaded dynamically on demand to avoid node-side runtime module resolution issues.
 */

export type TransformersConfig = {
  embedModel?: string;
  rerankModel?: string;
  classifierModel?: string;
  allowLocalModels?: boolean;
  useBrowserCache?: boolean;
};

export type Transformers = {
  embed: (text: string) => Promise<number[]>;
  embedBatch: (texts: string[]) => Promise<number[][]>;
  rerank: (query: string, documents: string[]) => Promise<number[]>;
  classify: (text: string, labels: string[]) => Promise<{ label: string; score: number }[]>;
};

export async function createTransformers(config?: TransformersConfig): Promise<Transformers> {
  const { env, pipeline } = await import('@huggingface/transformers');

  // Configure to use remote models (downloaded and cached locally).
  env.allowLocalModels = config?.allowLocalModels ?? false;
  env.useBrowserCache = config?.useBrowserCache ?? true;

  const embedModel = config?.embedModel ?? 'Xenova/all-MiniLM-L6-v2';
  const rerankModel = config?.rerankModel ?? 'Xenova/distilbart-mnli-12-9';
  const classifierModel = config?.classifierModel ?? 'Xenova/distilbart-mnli-12-9';

  // Initialize pipelines lazily (loaded on first use).
  let embedder: unknown = null;
  let reranker: unknown = null;
  let classifier: unknown = null;

  async function getEmbedder() {
    if (!embedder) {
      embedder = await (pipeline as (task: string, model: string) => Promise<unknown>)(
        'feature-extraction',
        embedModel,
      );
    }
    return embedder;
  }

  async function getReranker() {
    if (!reranker) {
      reranker = await (pipeline as (task: string, model: string) => Promise<unknown>)(
        'zero-shot-classification',
        rerankModel,
      );
    }
    return reranker;
  }

  async function getClassifier() {
    if (!classifier) {
      classifier = await (pipeline as (task: string, model: string) => Promise<unknown>)(
        'zero-shot-classification',
        classifierModel,
      );
    }
    return classifier;
  }

  return {
    embed: async (text) => {
      const extractor = await getEmbedder();
      const output = (await (
        extractor as (text: string, options: Record<string, unknown>) => Promise<unknown>
      )(text, { pooling: 'mean', normalize: true })) as { data: number[] };
      return Array.from(output.data);
    },

    embedBatch: async (texts) => {
      const extractor = await getEmbedder();
      const results: number[][] = [];
      for (const text of texts) {
        const output = (await (
          extractor as (text: string, options: Record<string, unknown>) => Promise<unknown>
        )(text, { pooling: 'mean', normalize: true })) as { data: number[] };
        results.push(Array.from(output.data));
      }
      return results;
    },

    rerank: async (query, documents) => {
      // Use zero-shot classification as a proxy reranker:
      // score each document against the query as a "hypothesis".
      const rk = await getReranker();
      const scores: number[] = [];
      for (const doc of documents) {
        const result = (await (rk as (text: string, labels: string[]) => Promise<unknown>)(doc, [
          query,
        ])) as {
          scores: number[];
        };
        scores.push(result.scores[0] ?? 0);
      }
      return scores;
    },

    classify: async (text, labels) => {
      const clf = await getClassifier();
      const result = (await (clf as (text: string, labels: string[]) => Promise<unknown>)(
        text,
        labels,
      )) as {
        labels: string[];
        scores: number[];
      };
      return result.labels.map((label, i) => ({ label, score: result.scores[i] ?? 0 }));
    },
  };
}
