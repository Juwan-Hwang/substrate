# Contributing to Substrate

## Architecture Boundaries

This document defines hard rules for three areas where overlapping
technologies could cause architectural confusion. Every contributor
MUST follow these rules.

---

## 1. State Management: Zustand vs XState

Both libraries are approved, but they serve **different categories**
of state. Picking the wrong one creates split-state bugs that are
extremely hard to debug.

### Zustand — flat, step-less UI state

Use Zustand when the state has **no ordered transitions** — it is a
bag of independent values that can change in any order.

**Approved examples:**

- Sidebar open / closed
- Current theme (`dark` / `light`)
- Player volume
- Currently selected 3D object ID
- Command palette open / closed
- Toast queue

**Anti-patterns (do NOT use Zustand for):**

- Anything with `idle → loading → success | error` semantics → use XState
- Anything where step B requires step A to have completed → use XState
- Server data that needs cache invalidation → use TanStack Query

### XState — state machines with explicit transitions

Use XState when the state has **ordered phases, guarded transitions,
or side effects tied to specific state changes**.

**Approved examples:**

- Experiment lifecycle: `idle → queued → running → completed | failed | cancelled`
- Renderer initialization: `initializing → webgpu-ready | fallback-webgl | error`
- Auth flow: `signed-out → signing-in → signed-in | error`

**Anti-patterns (do NOT use XState for):**

- A simple boolean toggle → use Zustand
- URL-synchronised state → use nuqs
- Server cache → use TanStack Query

### Decision flowchart

```
Does the state have ordered phases or guarded transitions?
├── Yes  → XState
└── No
    ├── Is it URL-synchronised (shareable / bookmarkable)?
    │   ├── Yes  → nuqs
    │   └── No   → Zustand

Is it server data that needs caching / invalidation?
└── Always → TanStack Query (never Zustand or XState)
```

---

## 2. Observability: OpenTelemetry vs Langfuse

Both are approved, but they must not create **two independent monitoring
data silos**. There is ONE trace context; Langfuse is a specialised
consumer of OTel, not a parallel system.

### OpenTelemetry — system-wide telemetry

OTel is the **standard layer** for all non-AI telemetry:

- HTTP request duration, status codes
- Database query latency (PostgreSQL, Turso)
- Queue consumption (Cloudflare Queues)
- Worker execution time (Cloudflare Workers)
- Custom business metrics (experiment count, render FPS)

Configured in `@substrate-platform/observability` → exports to Grafana Cloud
(Tempo for traces, Loki for logs, Prometheus for metrics).

### Langfuse — AI-specific observability

Langfuse handles **AI calls only**:

- Prompt versioning & diffing
- Token usage and cost breakdown per model
- Model call chains (multi-step agent traces)
- Human / automated evaluation scores
- A/B comparison of prompt versions

### Integration contract

The `@substrate-platform/ai/langfuse.ts` module enforces the boundary:

1. Every AI generation creates an **OTel span** with `gen_ai.*`
   attributes — this span flows through the **same** OTel pipeline
   as system traces, so AI calls appear inline with the HTTP request
   that triggered them in Grafana.
2. The same trace ID is sent to **Langfuse Cloud** for the AI-specific
   dashboard (prompt diffing, cost, eval).
3. There is **one trace context, not two**. The OTel span is the
   parent; Langfuse receives the trace ID for cross-linking.

**Rule:** Never create a Langfuse trace without also creating the
corresponding OTel span. The `traceGeneration()` helper does both
automatically — use it instead of calling `client.trace()` directly.

---

## 3. Database: PostgreSQL vs Turso

PostgreSQL is the **single source of truth**. Turso is a **read-only
edge projection** — never a second write path.

### Data flow

```
Write request
    │
    ▼
PostgreSQL (@substrate-platform/db/index.ts)
    │
    ├── INSERT / UPDATE / DELETE  ← the ONLY write path
    │
    ▼
CDC / Queue (async projection)
    │
    ▼
Turso replica (@substrate-platform/db/turso.ts)
    │
    └── SELECT only ← edge read path (Cloudflare Workers)
```

### Enforcement

`turso.ts` enforces read-only at two levels:

1. **Type level:** `createTursoReadReplica()` returns `ReadOnlyDrizzleDb`
   which only exposes `.query` and `.select` — `.insert()`, `.update()`,
   and `.delete()` are not on the type.
2. **Runtime level:** `createTursoReadClient()` returns a Proxy that
   intercepts every `execute()` and `batch()` call and throws if the
   SQL matches `INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|…`.

**Rule:** Never bypass these wrappers. Never create a raw
`@libsql/client` instance outside of `turso.ts`. If you need to write
data, use `@substrate-platform/db` (PostgreSQL) — not Turso.

---

## Development Setup

Development uses the Bun monorepo workspace. Published packages are
consumed through the npm Registry — contributors do not need to publish
locally to test consumer workflows; install from `@substrate-platform/*@canary`
instead.

```bash
# Install dependencies
bun install

# Start dev server
bun dev

# Build everything
bun build

# Run tests
bun test

# Lint
bun lint

# Build WASM
bun wasm:build
```

### Rust / WASM

```bash
# Build Rust crates
bun rust:build

# Build WASM for browser
bun wasm:build

# Build WASM Component Model (WASI Preview 2)
bun wasm:component
bun wasm:component-embed
```

### Nix

```bash
nix develop --impure  # enter devshell with all tools pre-installed
```

## License

Apache-2.0. All contributions are licensed under the same terms.
