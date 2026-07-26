/**
 * `/chat` — RAG Q&A surface.
 *
 * Flow: the user asks → we retrieve context via `/api/search` → we POST
 * `{ messages, context }` to `/api/chat` (Edge) and stream the answer.
 * Each assistant turn carries clickable `[n]` citations linked to the
 * retrieved sources.
 *
 * Works identically in demo mode: the server streams a canned,
 * citation-stamped answer when no `OPENAI_API_KEY` is set.
 */
'use client';

import { useCallback, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import Link from 'next/link';
import { toCitations } from '@/lib/rag';
import type { ChatMessage, Citation, SearchResult } from '@/lib/types';

const uid = () => (globalThis.crypto?.randomUUID?.() ?? `m-${Date.now()}-${Math.random()}`);

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;

    setBusy(true);
    setInput('');

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: question };
    const assistantId = uid();
    const placeholder: ChatMessage = { id: assistantId, role: 'assistant', content: '' };
    setMessages((prev) => [...prev, userMsg, placeholder]);

    try {
      // 1. Retrieve grounded context.
      let context: SearchResult[] = [];
      try {
        const sres = await fetch(`/api/search?q=${encodeURIComponent(question)}&limit=4`);
        if (sres.ok) context = ((await sres.json()) as { results: SearchResult[] }).results;
      } catch {
        /* retrieval is best-effort; chat can still answer without it */
      }

      const citations = toCitations(context);

      // 2. Stream the RAG answer.
      const controller = new AbortController();
      abortRef.current = controller;
      const cres = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          context,
        }),
        signal: controller.signal,
      });

      if (!cres.body) throw new Error('No response stream');

      const reader = cres.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: acc, ...(citations.length ? { citations } : {}) }
              : m,
          ),
        );
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error: ${err instanceof Error ? err.message : 'stream failed'}` }
            : m,
        ),
      );
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [busy, input, messages]);

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col gap-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">RAG Chat</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Ask a question — answers are grounded in retrieved sources with inline citations.
        </p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto scrollbar-thin pr-1">
        {messages.length === 0 && <EmptyHint />}
        {messages.map((m) =>
          m.role === 'user' ? (
            <UserBubble key={m.id} content={m.content} />
          ) : (
            <AssistantBubble key={m.id} content={m.content} {...(m.citations ? { citations: m.citations } : {})} />
          ),
        )}
      </div>

      <form onSubmit={send} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about RAG, hybrid search, pgvector…"
          className="input"
          disabled={busy}
          aria-label="Question"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()}>
          {busy ? 'Thinking…' : 'Send'}
        </button>
      </form>
    </div>
  );
}

function EmptyHint() {
  const samples = ['What is hybrid search?', 'Explain RRF', 'How does pgvector work?'];
  return (
    <div className="card mt-4 space-y-3">
      <p className="text-sm text-[var(--color-text-secondary)]">
        No messages yet. Try one of these:
      </p>
      <div className="flex flex-wrap gap-2">
        {samples.map((s) => (
          <span key={s} className="badge badge-accent">
            {s}
          </span>
        ))}
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">
        Without an API key the assistant runs in <Link className="underline" href="/ingest">demo mode</Link> with pre-built citations.
      </p>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--color-accent)] px-4 py-2.5 text-sm text-white">
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({ content, citations }: { content: string; citations?: Citation[] }) {
  return (
    <div className="flex justify-start">
      <div className="card card-tight max-w-[85%] space-y-3">
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {content ? renderCitations(content) : <span className="opacity-60">…</span>}
        </div>
        {citations && citations.length > 0 && (
          <ol className="space-y-1 border-t border-[var(--color-border-subtle)] pt-2">
            {citations.map((c) => (
              <li key={c.index} id={`cite-${c.index}`} className="flex items-center gap-2 text-xs">
                <span className="cite">{c.index}</span>
                <span className="text-[var(--color-text-secondary)]">{c.title}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/** Render `[n]` markers as clickable chips that jump to the source list. */
function renderCitations(text: string): ReactNode {
  const parts = text.split(/(\[\d+\])/);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    const n = match?.[1];
    if (n) {
      return (
        <a key={i} href={`#cite-${n}`} className="cite mx-0.5 align-baseline no-underline">
          {n}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
