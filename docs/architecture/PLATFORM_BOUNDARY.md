# Platform Boundary

> This document is the formal source of truth for what Substrate's platform
> layer may and may not do, what belongs where, and how the boundary is
> enforced. It is derived from the codebase, not from external planning
> documents. If the code and this document disagree, the code wins — and
> this document gets updated.

---

## 1. What Substrate Is

Substrate is a modular platform for building modern personal sites. It
provides reusable infrastructure — content layer, component library,
graphics engine, database access, edge functions, AI integration,
observability — without forcing a specific site structure or feature set.

Every capability is opt-in through a Feature Manifest. A site can start as
a pure static content site and progressively enable auth, search, AI,
realtime, and more.

Substrate is **not a website**. It is the foundation you build one on.

---

## 2. Layer Model

```text
┌───────────────────────────────────────────────┐
│                 Application                    │
│   (examples/*, consumer sites, your-domain) │
│                  depends on ↓                 │
├───────────────────────────────────────────────┤
│                  Platform                     │
│  packages/contracts  packages/site   packages/ui
│  packages/config     packages/db     packages/content
│  packages/graphics   packages/ai     packages/edge
│  packages/observability  packages/tokens       │
│                  depends on ↓                 │
├───────────────────────────────────────────────┤
│              External dependencies            │
│  (npm packages, Rust crates)                  │
└───────────────────────────────────────────────┘
```

### Dependency direction

```
Application → Platform → External
Platform ↛ Application
```

The platform may never import from `examples/`, any application
namespace, or a forbidden brand namespace (configured in
`.boundary-patterns.json`). This is enforced by CI (see §6).

---

## 3. Directory Classification

### Platform packages (`packages/`)

These directories contain platform-level code. They are the only directories
scanned by the boundary CI gate for import violations.

| Package | Role |
|---------|------|
| `packages/contracts/` | Core type contracts, Zod schemas, publish protocol, authorization engine, storage interfaces (zero heavyweight runtime deps at root; tRPC/Effect/Zustand/OpenAPI via subpath exports) |
| `packages/config/` | Feature manifest schema and preset profiles |
| `packages/db/` | Drizzle ORM table definitions, schemas, Turso read replica |
| `packages/site/` | Next.js site shell primitives (layout, metadata, providers, shells, animations) |
| `packages/ui/` | Component library (Button, GlassCard, Badge, Switch), design tokens, paint worklets |
| `packages/content/` | MDX/Fumadocs content layer, Orama static search |
| `packages/graphics/` | Three.js / R3F / WebGPU / WASM graphics engine |
| `packages/ai/` | Vercel AI SDK, provider adapter, RAG retrieval, Langfuse tracing |
| `packages/edge/` | Cloudflare Workers (Hono), R2, Queues, Durable Objects, Turnstile |
| `packages/observability/` | OpenTelemetry, Sentry, PostHog |
| `packages/tokens/` | Design token source files (Style Dictionary) |

### Package categories: interfaces vs concrete implementations

Substrate packages fall into two categories:

| Category | Packages | Nature |
----------|----------|--------
| **Interface packages** | `contracts`, `config` | Define abstract types, Zod schemas, and platform protocols. Zero heavyweight runtime deps at the root. Optional integrations (tRPC, Effect, Zustand, OpenAPI) via subpath exports — each pulls in its own deps only when imported. Consumers implement these interfaces against any backend. |
| **Concrete implementation packages** | `db`, `edge`, `ai`, `graphics`, `content`, `observability`, `site`, `ui`, `tokens` | Provide working implementations built on specific technology choices (PostgreSQL/Turso, Cloudflare Workers, Vercel AI SDK, Three.js/R3F, Orama, OpenTelemetry/Sentry/PostHog, etc.). These are **default implementations**, not abstract interfaces. |

**What this means for consumers:**

- The interface packages (`contracts`, `config`) define *what* the platform
  does. They are vendor-neutral and stable.
- The concrete packages define *how* it does it today. They are opt-in via
  the Feature Manifest and can be replaced.
- A consumer who wants to use a different database, edge runtime, or AI
  provider should implement the corresponding interfaces from
  `@substrate/contracts` (e.g. `SnapshotStore`, `EntityResolver`,
  `AuthorizationBundle`) in their own application code. They do not need to
  fork or modify the concrete packages — they simply don't use them.

This is a deliberate trade-off: Substrate ships working defaults so most
consumers can start immediately, while remaining architecturally replaceable
for those who need different infrastructure.

### Examples (`examples/`)

Examples are **consumers**, not platform code. They demonstrate platform
capabilities and serve as consumer validation fixtures.

| Example | Role |
|---------|------|
| `examples/minimal-site/` | Simplest usage — static content, no backend |
| `examples/northstar/` | Consumer conformance fixture — fictional site that proves third-party buildability |
| `examples/graphics-lab/` | WebGPU/WASM/R3F capability demo |
| `examples/ai-archive/` | RAG, hybrid search, chat capability demo |
| `examples/realtime-room/` | Durable Objects, presence demo |

Examples may import from `packages/` but never the reverse.

### Rust core (`crates/`)

| Crate | Role |
|-------|------|
| `crates/core/` | Rust core: graph layout, SIMD, content parsing |
| `crates/wasm/` | WASM bindings for browser/edge consumption |

---

## 4. Platform Neutrality Rules

The platform must remain agnostic to application-specific concepts. These
rules are **hard constraints**, not conventions.

### 4.1 No hardcoded state names

The platform never imports or hardcodes lifecycle state names (`draft`,
`published`, `archived`, etc.). `LifecycleDefinition` is generic:
`<State extends string, Event extends string>`. The application supplies
concrete state and event names.

### 4.2 No hardcoded visibility levels

The platform never hardcodes visibility values (`private`, `restricted`,
`public`). Visibility is `text` in the database and `string` in TypeScript.
The application defines what visibility levels exist.

### 4.3 No hardcoded entity types

The platform never hardcodes entity type names (`writing`, `project`,
`experience`, etc.). `EntityRef.type` is `string`. The platform uses it only
as a composite key for resolution, never to interpret semantics.

### 4.4 No hardcoded content types

The platform never hardcodes content type identifiers in the search layer.
`SearchableDoc<TType extends string = string>` allows the application to
define its own content type space.

### 4.5 No brand names, person identifiers, or site-specific URLs

The platform must not contain application-specific identifiers such as
brand names, person names, site URLs, CSS variable prefixes, or
infrastructure resource names. This is enforced by the pattern scan layer
of `check-boundary.ts`.

### 4.6 No application-specific tables

The platform provides only generic metadata tables (`entities`,
`associations`, `entity_indexes`, `snapshots`, `cas_objects`). Application
typed tables (e.g. `writings`, `projects`) are defined by the application
in its own migration. There is **no `revisions` table** in the platform —
Revision is an application entity.

### 4.7 Infrastructure packages are concrete implementations, not interfaces

The concrete infrastructure packages (`db`, `edge`, `ai`, `graphics`,
`content`, `observability`) are **default implementations** built on
specific technology choices, not abstract interfaces. The platform does
not claim vendor neutrality for these packages.

- `@substrate/db` uses PostgreSQL + Turso (libSQL) with Drizzle ORM.
- `@substrate/edge` uses Cloudflare Workers + Hono + Upstash Redis.
- `@substrate/ai` uses Vercel AI SDK + OpenAI/Anthropic/Google + Langfuse.
- `@substrate/content` uses Fumadocs MDX + Orama search + `@vercel/og`.
- `@substrate/graphics` uses Three.js / R3F / WebGPU / WASM.
- `@substrate/observability` uses OpenTelemetry + Sentry + PostHog.

Consumers who need a different vendor should implement the corresponding
interfaces from `@substrate/contracts` in their own application code and
simply not import the concrete package. The interface packages (`contracts`,
`config`) are the vendor-neutral contracts; the infrastructure packages are
opinionated defaults.

---

## 5. CSS Package Boundary

Substrate defines a three-tier CSS contract:

| Tier | Owner | What it provides | `@import "tailwindcss"`? |
|------|-------|-------------------|--------------------------|
| 1 | Application | Tailwind v4 entry | Yes — resolved by consumer's PostCSS |
| 2 | `@substrate/ui` | `--substrate-*` tokens, `.substrate-*` components | No — relative `@import` only |
| 3 | `@substrate/site` | `@theme` bridge, `.glass`, `.text-gradient`, paint worklets | No — would break Turbopack resolver |

**Why `@substrate/site/globals.css` must not `@import "tailwindcss"`:**
Turbopack resolves CSS `@import` from the source file's directory. If a
platform package contains `@import "tailwindcss"`, the resolver searches
`packages/site/node_modules/` — but `tailwindcss` is installed in the
consumer's `node_modules`, causing a build error.

See [`docs/css.md`](../css.md) for the full contract.

---

## 6. Boundary Enforcement

The boundary is enforced by `scripts/check-boundary.ts` — a zero-dependency
CI gate with three layers:

### Layer 1: Import Graph (primary gate)

Scans all files under `packages/*/src/` for imports that reference
application namespaces:

- Forbidden namespaces configured in `.boundary-patterns.json`
  (e.g. `yourbrand/`, `yourbrand-*`, `@yourbrand/`)
- `examples/`

If any platform file imports from these patterns, the gate fails.
Forks replace the namespace entries with their own identifiers.

### Layer 1.5: Search Privacy Gate

Scans files under `examples/*/src/app/` that import client-side search
libraries (Orama, Fuse.js, MiniSearch, FlexSearch, Lunr). If such a file
also imports auth-related modules (better-auth, next-auth, lucia, clerk),
the gate fails.

This prevents the architectural anti-pattern of shipping private content
to the browser and then hiding it client-side.

### Layer 2: Pattern Scan (secondary lint)

Scans all files for application-specific identifiers:

- Brand names, person identifiers, site URLs, infrastructure
  resource names, and CSS variable prefixes — all configured in
  `.boundary-patterns.json`
- Possible credentials (API keys, AWS access key IDs) — built-in

The brand patterns are configurable so forks can replace them with
their own identifiers without editing the script. Credential
detection is universal and never configurable.

This layer catches contamination that import analysis cannot detect.

### Running the gate

```bash
bun boundary:check
```

Exit code 1 if any violations are found.

---

## 7. State Management Rules

| Library | Use for | Do NOT use for |
|---------|---------|-----------------|
| **Zustand** | Flat, step-less UI state (sidebar, theme, toasts) | Ordered transitions, server cache |
| **XState** | State machines with ordered phases, guarded transitions | Simple boolean toggles, URL state |
| **TanStack Query** | Server data with cache invalidation | UI state, client-only state |
| **nuqs** | URL-synchronised state (shareable, bookmarkable) | Internal UI state |

Decision flowchart:

```
Does the state have ordered phases or guarded transitions?
├── Yes  → XState
└── No
    ├── Is it URL-synchronised? → nuqs
    └── No → Zustand

Is it server data that needs caching? → TanStack Query (always)
```

---

## 8. Observability Rules

| Tool | Scope |
|------|-------|
| **OpenTelemetry** | All non-AI telemetry: HTTP, DB, queue, worker, business metrics |
| **Langfuse** | AI-specific: prompt versioning, token cost, model traces, eval |

There is **one trace context, not two**. Every AI generation creates an
OTel span with `gen_ai.*` attributes. The same trace ID is sent to
Langfuse for AI-specific dashboards. Never create a Langfuse trace without
the corresponding OTel span.

---

## 9. Database Rules

**PostgreSQL is the single source of truth. Turso is a read-only edge
projection.**

```
Write request → PostgreSQL (only write path)
                   ↓
              CDC / Queue (async)
                   ↓
              Turso replica (SELECT only — edge read path)
```

Turso is enforced read-only at two levels:

1. **Type level:** `createTursoReadReplica()` returns `ReadOnlyDrizzleDb`
   which only exposes `.query` and `.select`.
2. **Runtime level:** A Proxy intercepts `execute()` and `batch()` calls,
   throwing on `INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE`.

Never bypass these wrappers. Never create a raw `@libsql/client` instance
outside of `turso.ts`. If you need to write data, use `@substrate/db`
(PostgreSQL).

---

## 10. Publish Protocol

The platform defines a two-phase publish protocol for atomic content
release. The protocol is implemented in `@substrate/contracts/publish.ts`
and is the **only** mechanism for committing changes that may affect the
public site.

### Phase A (advisory, outside transaction)

1. Build ChangeSet
2. Preflight Authorization (fast reject for UX)
3. Preview State (render for user)
4. Public Impact Assessment
5. User Confirms

### Phase B (binding, inside transaction)

6. CAS pre-write (if enabled — precondition)
7. BEGIN TRANSACTION
8. `tx.lockEntity(refs)` — SELECT ... FOR UPDATE
9. Recompute projected state
10. Recompute public impact
11. Verify user's confirmed preview matches recomputed state
12. Revalidate Authorization (binding)
13. Write Current State
14. Write Snapshot Reference + application revision row
15. COMMIT

### Hard invariants

- **I2:** Public Site == Public Archive (atomic publish). If the batch
  changes the public site, it also creates a Public Revision.
- **I6:** Authorization revalidation occurs inside the transaction, after
  lock acquisition.
- **I13:** The user's confirmed preview is verified against the recomputed
  state. Stale previews are rejected.
- **I14:** CAS pre-write is a precondition, not part of DB atomicity.

---

## 11. Association Model

Associations are **undirected and untyped**. An Association expresses only
"A and B are related" — no `kind`, no `relationType`, no `source`/`target`
bias.

If the application needs typed relations, it defines its own table (e.g.
`collection_memberships`) on top of Association.

Associations cannot break visibility boundaries: if either endpoint is
invisible to the current visitor, the association itself is also invisible.

---

## 12. Storage Model

The platform provides three storage interfaces:

| Interface | Mutability | Purpose |
|-----------|------------|---------|
| `SnapshotStore` | Immutable (no update, no delete) | Point-in-time state snapshots |
| `ContentAddressedStore` | Immutable (content-addressed) | Deduplicated blobs |
| `AssetStore` | Originals immutable; representations append-only | Media, attachments |

### Purge safety

`purge()` deletes the **current entity row only**. It does NOT delete:
- CAS objects (immutable, content-addressed)
- Snapshots (historical record)
- Revisions (application-owned, historical reachability)
- Associations (unless explicitly requested and they don't break reachability)

The platform MUST NOT provide a `purgeAll()` or `purgeDeep()` that bypasses
snapshot reachability. Orphaned CAS objects are GC-safe and cleaned by an
optional garbage collector that operates on reachability sets.

---

## 13. Search Privacy

| Rule | Enforcement |
|------|-------------|
| Static indexes contain ONLY public content | `assertStaticIndexIsPublic()` runtime assertion |
| No client-side filtering of private data | Browser must never receive Private/Restricted content |
| Authenticated search goes through server | `mustUseServer()` gate |
| Server-side search is authorized before query | `authorizedSearch()` with `AuthQueryIntent` |

Private/Restricted content is excluded from the search index at build time,
not hidden client-side after retrieval.

---

## 14. Feature Manifest

Every deployment declares its active capabilities via a Zod-validated
Feature Manifest. The manifest is the single source of truth — every
module, route, worker binding, and env check references it.

### Hard constraint: CAS depends on Snapshot

```ts
if (parsed.contentAddressedStorage && !parsed.snapshot) {
  throw new Error('CAS requires snapshot=true (I23)');
}
```

Content-addressed storage is an optional enhancement that depends on the
snapshot layer. It cannot be enabled independently.

---

## 15. Attribution

`SubstrateLayout` renders a "Powered by Substrate" footer by default. This
is a **brand default, not a licence requirement**. Under Apache-2.0,
consumers are free to disable it:

```tsx
<SubstrateLayout poweredBy={{ enabled: false }}>
```

When shown, the label always reads "Powered by Substrate" and always links
to the official Substrate repository. Neither is configurable.
