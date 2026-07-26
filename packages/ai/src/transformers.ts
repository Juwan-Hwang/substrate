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
 */
import { pipeline, env } from '@huggingface/transformers';

// Configure to use remote models (downloaded and cached locally).
env.allowLocalModels = false;
env.useBrowserCache = true;

export type Transformers = {
  embed: (text: string) => Promise<number[]>;
  embedBatch: (texts: string[]) => Promise<number[][]>;
  rerank: (query: string, documents: string[]) => Promise<number[]>;
  classify: (text: string, labels: string[]) => Promise<{ label: string; score: number }[]>;
};

export async function createTransformers(): Promise<Transformers> {
  // Initialize pipelines lazily (loaded on first use).
  let embedder: Awaited<ReturnType<typeof pipeline>> | null = null;
  let reranker: Awaited<ReturnType<typeof pipeline>> | null = null;
  let classifier: Awaited<ReturnType<typeof pipeline>> | null = null;

  async function getEmbedder() {
    if (!embedder) {
      embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return embedder;
  }

  async function getReranker() {
    if (!reranker) {
      reranker = await pipeline('zero-shot-classification', 'Xenova/distilbart-mnli-12-9');
    }
    return reranker;
  }

  async function getClassifier() {
    if (!classifier) {
      classifier = await pipeline('zero-shot-classification', 'Xenova/distilbart-mnli-12-9');
    }
    return classifier;
  }

  return {
    embed: async (text) => {
      const extractor = await getEmbedder();
      const output = (await extractor(text, { pooling: 'mean', normalize: true })) as {
        data: number[];
      };
      return Array.from(output.data);
    },

    embedBatch: async (texts) => {
      const extractor = await getEmbedder();
      const results: number[][] = [];
      for (const text of texts) {
        const output = (await extractor(text, { pooling: 'mean', normalize: true })) as {
          data: number[];
        };
        results.push(Array.from(output.data));
      }
      return results;
    },

    rerank: async (query, documents) => {
      // Use zero-shot classification as a proxy reranker:
      // score each document against the query as a "hypothesis".
      const classifier = await getClassifier();
      const scores: number[] = [];
      for (const doc of documents) {
        const result = (await classifier(doc, [query])) as { scores: number[] };
        scores.push(result.scores[0] ?? 0);
      }
      return scores;
    },

    classify: async (text, labels) => {
      const classifier = await getClassifier();
      const result = (await classifier(text, labels)) as {
        labels: string[];
        scores: number[];
      };
      return result.labels.map((label, i) => ({ label, score: result.scores[i] ?? 0 }));
    },
  };
}
