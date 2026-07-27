/**
 * Static article corpus — demo content for the Archive.
 *
 * In production this is replaced by Velite/Fumadocs collections backed
 * by MDX files. The reference implementation ships a static corpus so
 * the Archive list and article detail routes render without a database.
 */
import type { SearchableDoc } from '@substrate/content/search';

export type Article = SearchableDoc;

export const demoDocs: SearchableDoc[] = [
  {
    id: '1',
    title: 'Building Substrate: A Graphics-First Personal Site Foundation',
    excerpt:
      'How we designed an opinionated platform for personal sites with WebGPU, WASM, and edge-native architecture.',
    body: 'Substrate is an opinionated, graphics-first personal-site foundation. It combines Next.js 16, React 19, Three.js WebGPU, Rust/WASM, Cloudflare Workers, and PostgreSQL into a single coherent platform.',
    slug: 'building-substrate',
    tags: ['architecture', 'webgpu', 'wasm'],
    type: 'article',
  },
  {
    id: '2',
    title: 'WebGPU Compute Shaders for Force-Directed Graph Layout',
    excerpt: 'Using WGSL compute shaders to accelerate graph layout by 40x compared to JavaScript.',
    body: 'WebGPU compute shaders allow us to run force-directed graph layout on the GPU. The algorithm uses three compute passes: repulsion, attraction, and integration.',
    slug: 'webgpu-graph-layout',
    tags: ['webgpu', 'wgsl', 'graphics'],
    type: 'article',
  },
  {
    id: '3',
    title: 'Hybrid Search: Combining PostgreSQL FTS with pgvector',
    excerpt: 'A practical guide to building hybrid search with reciprocal rank fusion.',
    body: 'Hybrid search combines keyword search (PostgreSQL FTS) with semantic search (pgvector). Results are merged using reciprocal rank fusion (RRF) and optionally reranked with a cross-encoder.',
    slug: 'hybrid-search',
    tags: ['search', 'postgresql', 'ai'],
    type: 'article',
  },
  {
    id: '4',
    title: 'Lattice — GPU Knowledge Graph Visualiser',
    excerpt: 'An interactive 3D knowledge graph with WASM-accelerated force-directed layout.',
    body: 'Lattice is the visual system of Aevum. It renders knowledge graphs in 3D using React Three Fiber and WebGPU, with a Rust/WASM fallback for CPU layout.',
    slug: 'lattice-visualiser',
    tags: ['graphics', 'r3f', 'webgpu'],
    type: 'project',
  },
  {
    id: '5',
    title: 'Crucible — Experiment Benchmark Lab',
    excerpt: 'A runnable experiment framework for benchmarking algorithms and visualising results.',
    body: 'Crucible is the experiment subsystem. It allows submitting parameterised experiments that run on the edge and stream results back in real-time.',
    slug: 'crucible-lab',
    tags: ['experiments', 'edge'],
    type: 'project',
  },
  {
    id: '6',
    title: 'Durable Objects for Real-Time Collaboration',
    excerpt: 'Using Cloudflare Durable Objects for presence and collaborative sessions.',
    body: 'Durable Objects provide single-threaded consistency at the edge. We use them for real-time presence, experiment state synchronisation, and collaborative sessions.',
    slug: 'durable-objects-collab',
    tags: ['cloudflare', 'realtime', 'edge'],
    type: 'note',
  },
];

/** Look up a single article by slug. Returns undefined when not found. */
export function getArticle(slug: string): Article | undefined {
  return demoDocs.find((doc) => doc.slug === slug);
}
