/**
 * Shared domain types for the AI Archive example.
 *
 * These are deliberately framework-agnostic so they can cross the
 * server/client boundary without dragging in Next or React types.
 */

/** A normalised search result returned by `/api/search`. */
export type SearchResult = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** Relevance score. Scale depends on the provider (ts_rank vs Orama). */
  score: number;
  /** Which backend produced this result. */
  source: 'postgres' | 'orama';
  citation: { type: 'article'; ref: string };
};

/** Response envelope for the search API. */
export type SearchResponse = {
  query: string;
  provider: 'postgres' | 'orama';
  results: SearchResult[];
};

export type ChatRole = 'user' | 'assistant' | 'system';

/** A single chat turn rendered in the UI. */
export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  /** Citations attached to assistant answers. */
  citations?: Citation[];
};

/** A numbered, clickable source reference for an assistant answer. */
export type Citation = {
  index: number;
  title: string;
  slug: string;
  ref: string;
};

/** Payload accepted by `/api/ingest`. */
export type IngestPayload = {
  title: string;
  slug: string;
  body: string;
  excerpt?: string;
  tags: string[];
};

export type IngestStatus = 'queued' | 'success' | 'error' | 'demo';

/** Response envelope for the ingest API. */
export type IngestResponse = {
  status: IngestStatus;
  id?: string;
  message: string;
};
