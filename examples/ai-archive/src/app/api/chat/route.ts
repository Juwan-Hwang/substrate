/**
 * `/api/chat` — RAG endpoint.
 *
 * Receives `{ messages, context }`. The client performs retrieval via
 * `/api/search` and ships the grounded context here, so this Edge
 * function never touches a database — it only generates.
 *
 * - `OPENAI_API_KEY` set → stream a live, citation-grounded answer with
 *   the Vercel AI SDK.
 * - otherwise → stream a demo answer built from the provided context,
 *   so the UX is identical in degraded mode.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { NextResponse } from 'next/server';
import { hasAI, openaiApiKey } from '@/lib/env';
import { buildRagPrompt } from '@/lib/rag';
import type { ChatMessage, SearchResult } from '@/lib/types';

type ChatRequest = {
  messages: ChatMessage[];
  context: SearchResult[];
};

const MODEL = 'gpt-4o-mini';

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as ChatRequest | null;
  const messages = body?.messages ?? [];
  const context = body?.context ?? [];

  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const question = lastUser?.content ?? '';

  const system = buildRagPrompt(question, context);

  // Live streaming generation.
  const key = openaiApiKey();
  if (hasAI() && key) {
    try {
      const openai = createOpenAI({ apiKey: key });
      const result = streamText({ model: openai(MODEL), system, prompt: question });
      return result.toTextStreamResponse();
    } catch {
      return NextResponse.json({ error: 'Failed to generate chat response' }, { status: 500 });
    }
  }

  // Demo mode: stream a synthesised, citation-stamped answer.
  return demoResponse(question, context);
}

/** Build and stream a demo answer word-by-word (no API key required). */
function demoResponse(question: string, context: SearchResult[]): Response {
  const answer = demoAnswer(question, context);
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const words = answer.split(/(\s+)/);
      for (const w of words) {
        controller.enqueue(encoder.encode(w));
      }
      controller.close();
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Mode': 'demo',
    },
  });
}

/** Compose a canned answer that references the retrieved sources. */
function demoAnswer(question: string, context: SearchResult[]): string {
  if (context.length === 0) {
    return [
      'Demo mode (no OPENAI_API_KEY).',
      '',
      `I have no retrieved context for: “${question}”.`,
      'Ask about RAG, hybrid search, pgvector, embeddings, or RRF to see a cited demo answer.',
    ].join('\n');
  }

  const lines = context.map((r, i) => `[${i + 1}] ${r.title} — ${r.excerpt}`);
  return [
    `Demo mode (no OPENAI_API_KEY). Based on ${context.length} retrieved source(s), here is a synthesised answer to: “${question}”.`,
    '',
    ...lines,
    '',
    'Set OPENAI_API_KEY to get a real LLM-generated, citation-grounded answer.',
  ].join('\n');
}
