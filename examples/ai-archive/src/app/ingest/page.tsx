/**
 * `/ingest` — content ingestion surface.
 *
 * A client form for title / slug / body / tags. The slug auto-derives
 * from the title until manually edited. Submission posts to
 * `/api/ingest`, which persists (or simulates) the article and reports
 * a status the UI surfaces as a coloured badge.
 */
'use client';

import type { FormEvent, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { IngestResponse, IngestStatus } from '@/lib/types';

type Form = {
  title: string;
  slug: string;
  body: string;
  tags: string;
  excerpt: string;
};

const empty: Form = { title: '', slug: '', body: '', tags: '', excerpt: '' };

const statusStyles: Record<IngestStatus, string> = {
  success: 'badge-accent',
  demo: 'badge-cyan',
  queued: 'badge-accent',
  error: '',
};

export default function IngestPage() {
  const [form, setForm] = useState<Form>(empty);
  const [slugTouched, setSlugTouched] = useState(false);
  const [status, setStatus] = useState<IngestStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const derivedSlug = useMemo(
    () =>
      form.title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    [form.title],
  );
  const slug = slugTouched ? form.slug : derivedSlug;

  const update = (key: keyof Form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus(null);
    setMessage(null);

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          slug: slug.trim(),
          body: form.body.trim(),
          excerpt: form.excerpt.trim(),
          tags: form.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const data = (await res.json()) as IngestResponse;
      setStatus(data.status);
      setMessage(data.message);
      if (data.status === 'success' || data.status === 'demo') {
        setForm(empty);
        setSlugTouched(false);
      }
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Ingest Content</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Submit an article. With a database it is persisted and embedded; otherwise the pipeline
          runs in demo mode.
        </p>
      </header>

      <form onSubmit={submit} className="card space-y-4">
        <Field label="Title">
          <input
            className="input"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Hybrid Search Explained"
            required
          />
        </Field>

        <Field label="Slug" {...(!slugTouched ? { hint: 'auto-derived from title' } : {})}>
          <input
            className="input mono"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              update('slug', e.target.value);
            }}
            placeholder="hybrid-search-explained"
          />
        </Field>

        <Field label="Excerpt" hint="optional">
          <input
            className="input"
            value={form.excerpt}
            onChange={(e) => update('excerpt', e.target.value)}
            placeholder="A short summary used in search results and citations."
          />
        </Field>

        <Field label="Body">
          <textarea
            className="textarea"
            value={form.body}
            onChange={(e) => update('body', e.target.value)}
            placeholder="Write the article body in plain text…"
            required
          />
        </Field>

        <Field label="Tags" hint="comma-separated">
          <input
            className="input"
            value={form.tags}
            onChange={(e) => update('tags', e.target.value)}
            placeholder="search, rag, postgres"
          />
        </Field>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Ingesting…' : 'Ingest article'}
          </button>
          {status && <span className={`badge ${statusStyles[status]}`}>{status}</span>}
        </div>

        {message && (
          <p
            className={`text-sm ${status === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}`}
            role={status === 'error' ? 'alert' : undefined}
          >
            {message}
          </p>
        )}
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: form control is provided via children
    <label className="block space-y-1.5">
      <span className="flex items-center gap-2 text-sm font-medium">
        {label}
        {hint && <span className="text-xs font-normal text-[var(--color-text-muted)]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
