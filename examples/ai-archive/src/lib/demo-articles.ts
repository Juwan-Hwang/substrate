/**
 * Static demo corpus — powers the Orama fallback search and the demo RAG
 * mode when no `DATABASE_URL` / `OPENAI_API_KEY` is configured.
 *
 * Every document conforms to {@link SearchableDoc} so the same data can
 * feed both the client-side Orama index and the demo citation pipeline.
 */
import type { SearchableDoc } from '@substrate/content/search';

export const demoArticles: readonly SearchableDoc[] = [
  {
    id: 'demo-hybrid-search',
    slug: 'hybrid-search',
    type: 'article',
    title: 'Hybrid Search: Combining FTS and Vector Retrieval',
    excerpt:
      'Hybrid search fuses lexical full-text search with dense vector similarity to capture both exact keywords and semantic intent.',
    tags: ['search', 'hybrid', 'postgres', 'pgvector'],
    body: [
      'Hybrid search combines two complementary retrieval signals.',
      'Full-text search (FTS) excels at rare keywords, exact phrases, and boolean logic. PostgreSQL implements it with tsvector, tsquery, and GIN indexes, ranking via ts_rank_cd.',
      'Dense vector retrieval, powered by pgvector, captures semantic similarity: it finds documents that mean the same thing even when no words overlap.',
      'The two ranked lists are merged with Reciprocal Rank Fusion (RRF), a parameter-light algorithm that sums 1/(k+rank) across lists. RRF needs no score calibration, which is why it dominates production hybrid pipelines.',
      'A cross-encoder reranker can then refine the fused top-k for maximum precision, trading latency for quality at the very top of the results page.',
    ].join('\n\n'),
  },
  {
    id: 'demo-rag',
    slug: 'retrieval-augmented-generation',
    type: 'article',
    title: 'RAG: Retrieval-Augmented Generation Explained',
    excerpt:
      'RAG grounds language model answers in retrieved evidence, reducing hallucination and enabling transparent, clickable citations.',
    tags: ['rag', 'ai', 'llm', 'citations'],
    body: [
      'Retrieval-Augmented Generation (RAG) gives a language model a private, up-to-date memory.',
      'The pipeline is simple: embed the user question, retrieve the top-k most relevant chunks, then prompt the model to answer using ONLY those sources.',
      'Grounding in retrieved evidence sharply reduces hallucination. It also makes answers auditable: every claim can carry a [n] citation that links back to its source.',
      'Quality hinges on retrieval. Chunk size, embedding model, and the fusion strategy all matter. A weak retriever dooms even the strongest generator.',
      'Streaming the answer token-by-token keeps perceived latency low, while citation markers let users verify provenance inline.',
    ].join('\n\n'),
  },
  {
    id: 'demo-pgvector',
    slug: 'pgvector-semantic-search',
    type: 'article',
    title: 'pgvector: Semantic Search Inside PostgreSQL',
    excerpt:
      'pgvector adds vector columns and similarity operators to PostgreSQL, enabling semantic search without a separate vector database.',
    tags: ['postgres', 'pgvector', 'embeddings', 'vector'],
    body: [
      'pgvector extends PostgreSQL with a vector type and indexing for approximate nearest neighbour search.',
      'Store a 1536-dimensional embedding alongside each row, then query with the cosine distance operator `<=>`. The expression 1 - (embedding <=> query) yields a similarity score in [0, 1].',
      'HNSW indexes deliver sub-millisecond approximate search at scale; IVFFlat trades recall for memory. Choose based on your recall/latency budget.',
      'Because vectors live in the same database as your rows, you can combine semantic filters with arbitrary SQL predicates — a join that a standalone vector store cannot express.',
    ].join('\n\n'),
  },
  {
    id: 'demo-embeddings',
    slug: 'embeddings-text-to-vector-space',
    type: 'article',
    title: 'Embeddings: Mapping Text to Vector Space',
    excerpt:
      'Text embeddings place sentences into a high-dimensional space where geometric distance reflects semantic meaning.',
    tags: ['embeddings', 'ai', 'vector', 'similarity'],
    body: [
      'An embedding model maps text to a fixed-length vector (often 768, 1024, or 1536 dimensions).',
      'Semantically similar texts land near each other, so cosine similarity becomes a proxy for meaning. This is the foundation of vector search, clustering, and deduplication.',
      'Models like text-embedding-3-small produce 1536-dim vectors tuned for retrieval. The choice of model fixes your dimensionality, which must match your pgvector column.',
      'Embeddings are generated once at ingest time and reused for every query, so the cost is amortised across the lifetime of a document.',
    ].join('\n\n'),
  },
  {
    id: 'demo-rrf',
    slug: 'reciprocal-rank-fusion',
    type: 'article',
    title: 'RRF: Reciprocal Rank Fusion for Merging Ranked Lists',
    excerpt:
      'RRF merges multiple ranked result lists into one using 1/(k+rank), needing no score normalisation across systems.',
    tags: ['search', 'rrf', 'fusion', 'ranking'],
    body: [
      'Reciprocal Rank Fusion (RRF) combines several ranked lists into a single ranking.',
      'For each document, sum 1/(k + rank) across every list where it appears, where k is a smoothing constant (typically 60). Higher ranks (earlier positions) contribute more.',
      'RRF is score-agnostic: it uses only positions, so it fuses systems with incomparable score scales — exactly the FTS-vs-vector case in hybrid search.',
      'It is robust, parameter-light, and the default fusion strategy in most production hybrid retrievers, including the @substrate/ai hybridRetrieval function.',
    ].join('\n\n'),
  },
];
