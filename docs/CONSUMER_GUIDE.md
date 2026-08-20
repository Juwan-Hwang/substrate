# Consumer Getting Started

> This guide is for **builders** — people who want to create a site on top
> of Substrate without contributing to the platform itself. If you want to
> contribute to Substrate's packages, see
> [`CONTRIBUTING.md`](../CONTRIBUTING.md) and
> [`docs/architecture/PLATFORM_BOUNDARY.md`](./architecture/PLATFORM_BOUNDARY.md)
> instead.

---

## 1. What you need

| Tool | Version | Required? |
|------|---------|-----------|
| [Bun](https://bun.sh) | `>= 1.4.0` | Yes — package manager + test runner |
| [Node.js](https://nodejs.org) | `>= 22.0.0` | Yes — Next.js runtime |
| [Rust toolchain](https://rustup.rs) | stable | Only for WASM builds (`wasm:build`) |

Substrate packages are **not yet published to npm**. You must work within
the monorepo (workspace mode). See
[§ Standalone Mode](#standalone-mode-not-yet-available) below.

---

## 2. Scaffold a new site

From the monorepo root:

```bash
# Interactive — prompts for name, preset, content model, author, URL
bun create-site

# Non-interactive
bun create-site my-site --preset minimal --author Alice --url https://alice.dev
```

This copies the `northstar` consumer template, rewrites all branding,
identity, and feature configuration to match your input, and generates a
`.env.example` and `README.md` for your site.

Then:

```bash
bun install
bun dev --filter my-site
```

Open `http://localhost:3000`.

---

## 3. The four things that define a site

A Substrate site is defined by exactly four things. Everything else is
platform infrastructure you don't touch.

| # | What | Where | Purpose |
|---|------|-------|---------|
| 1 | **Identity** | `src/app/layout.tsx` | Site name, URL, metadata, fonts |
| 2 | **Theme** | `src/app/globals.css` | CSS custom properties (colors, spacing, radius) |
| 3 | **Content** | `src/lib/<content>.ts` | Your data — articles, projects, logs, anything |
| 4 | **Feature preset** | `src/instrumentation.ts` | Which platform capabilities are active |

Change these four, and you have a completely different site. The
platform provides the structure; the application provides the meaning.

---

## 4. File-by-file walkthrough

What follows is the complete anatomy of a scaffolded site. Every file
is listed — nothing is hidden.

### `src/instrumentation.ts` — Feature preset

The entry point that Next.js calls before the first request. It
bootstraps the Feature Manifest and (optionally) OpenTelemetry.

```ts
export const register = (
  await import('@substrate/site/instrumentation')
).registerInstrumentation({
  featurePreset: 'minimal',     // or: graphics, ai-archive, realtime, reference
  serviceName: 'my-site',       // OTel service name — use your own
});
```

Available presets:

| Preset | Capabilities | Requires |
|--------|-------------|----------|
| `minimal` | Static content, static search, OG images | Nothing |
| `graphics` | + WebGPU, WASM, R3F | Nothing extra |
| `ai-archive` | + PostgreSQL, AI/RAG, auth, edge, queue | DB + AI API key |
| `realtime` | + Cloudflare Workers, Durable Objects | Cloudflare account |
| `reference` | Everything on | All of the above |

To go beyond a preset, pass a custom manifest instead:

```ts
import { registerInstrumentation } from '@substrate/site/instrumentation';

export const register = registerInstrumentation({
  featureManifest: {
    auth: true,
    analytics: true,
    graphics: false,
    search: 'server',
    // ... see @substrate/config for the full schema
  },
  serviceName: 'my-site',
});
```

### `src/app/layout.tsx` — Identity and layout

Root server component. Declares the site's identity, initialises the
feature manifest, and wraps children in the platform's layout shell.

```tsx
import { initFeatures, minimalSiteFeatures } from '@substrate/config/features';
import { SubstrateLayout } from '@substrate/site/layout';
import { createMetadata } from '@substrate/site/metadata';
import { GeistSans } from 'geist/font/sans';
import type { ReactNode } from 'react';
import './globals.css';

// Initialise the feature manifest for this deployment.
initFeatures(minimalSiteFeatures);

export const metadata = createMetadata({
  name: 'My Site',
  url: 'https://example.com',
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <SubstrateLayout fontClass={GeistSans.variable}>
      {children}
    </SubstrateLayout>
  );
}
```

Key points:

- `createMetadata()` takes a `SiteIdentity` (`{ name, url }`) and returns
  a Next.js `Metadata` object with sensible OpenGraph defaults.
- `SubstrateLayout` renders the `<html>`/`<body>` shell, applies the
  font class, and optionally shows a "Powered by Substrate" footer.
  Disable it with `poweredBy={{ enabled: false }}`.
- `initFeatures()` sets the global feature manifest. Call it once, at
  module scope, so it runs during both build and runtime.

### `src/app/globals.css` — Theme

Three-tier CSS contract:

```css
/* Tier 1 — Tailwind v4 entry. Resolved by your PostCSS. */
@import "tailwindcss";

/* Tier 2 — Platform design tokens + component styles. */
@import "@substrate/ui/styles.css";

/* Tier 3 — Tailwind theme bridge + platform utilities. */
@import "@substrate/site/globals.css";

/* Your tokens */
:root {
  --bg-primary: #0a0a0c;
  --accent-primary: #7c8ba0;
  --max-width: 680px;
  --gutter: 1.5rem;
}
```

The platform's `--substrate-*` tokens are consumed by `@substrate/ui`
components. Your `--accent-primary` flows into those components, so the
shared library inherits your brand without a fork.

See [`docs/css.md`](./css.md) for the full boundary specification.

### `src/lib/<content>.ts` — Content corpus

Your data. The scaffold generates a static array with a typed shape,
plus lookup helpers:

```ts
export type ContentEntry = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  body: string;
};

export const content: ContentEntry[] = [ /* your entries */ ];

export function getContent(slug: string): ContentEntry | undefined {
  return content.find((c) => c.slug === slug);
}

export function getAllSlugs(): string[] {
  return content.map((c) => c.slug);
}
```

The shape mirrors `SearchableDoc` from `@substrate/content/search`, so
the same records feed both your routes and the search index without
transformation. You can rename the type, the file, and the variable —
the platform does not hardcode any content type name.

### `src/app/page.tsx` — Homepage

Server component that renders your content index. Uses `GlassCard` and
`Badge` from `@substrate/ui`. Fully prerendered at build time for static
presets.

### `src/app/<content>/[slug]/page.tsx` — Detail route

Server component that renders a single content entry. Uses
`generateStaticParams` for prerendering and `generateMetadata` for
per-page titles.

### `src/app/archive/` — Search page

- `archive/page.tsx` — server component that maps your content corpus
  to `SearchableDoc[]` and passes it to the search box.
- `archive/search.tsx` — client component that builds an Orama index
  on mount and queries it on every keystroke. Zero network round-trips.

### Convention-file shells

Four files that re-export platform shells — you don't write any UI:

```ts
// src/app/error.tsx
'use client';
export { SubstrateError as default } from '@substrate/site/shells';

// src/app/global-error.tsx
'use client';
export { SubstrateGlobalError as default } from '@substrate/site/shells';

// src/app/loading.tsx
export { SubstrateLoading as default } from '@substrate/site/shells';

// src/app/not-found.tsx
export { SubstrateNotFound as default } from '@substrate/site/shells';
```

### `src/app/api/og/route.tsx` — OG image endpoint

Dynamic Open Graph image generator using `@vercel/og`. Renders a
1200×630 PNG with your monogram, title, and accent colour. Every page
can declare a unique social card via metadata.

### `next.config.ts` — Build configuration

Key settings the scaffold provides:

```ts
const nextConfig: NextConfig = {
  reactCompiler: true,           // React 19 Compiler
  cacheComponents: true,          // Partial Prerendering
  experimental: {
    viewTransition: true,         // View Transitions API
  },
  transpilePackages: [
    '@substrate/site',
    '@substrate/ui',
    '@substrate/content',
    '@substrate/config',
    '@substrate/contracts',
  ],
};
```

`transpilePackages` lets your site consume raw TypeScript source from
workspace packages — no separate build step needed.

### `tsconfig.json` — Path aliases

The scaffold maps `@substrate/*` package names to workspace `src/`
directories, and `@/*` to your `src/`:

```json
{
  "paths": {
    "@/*": ["./src/*"],
    "@substrate/site": ["../../packages/site/src"],
    "@substrate/site/*": ["../../packages/site/src/*"],
    // ... etc for each platform package
  }
}
```

### `postcss.config.mjs` — Tailwind v4

```js
export default {
  plugins: { '@tailwindcss/postcss': {} },
};
```

### `.env.example` — Environment contract

Generated by the scaffold. Documents every variable the platform
accepts, grouped by feature. All non-essential variables are commented
out — uncomment the ones your preset needs.

---

## 5. Platform API surface

The full set of primitives available to consumers:

### `@substrate/site` — Site shell

| Export | What it does |
|--------|-------------|
| `SubstrateLayout` | `<html>`/`<body>` shell + optional "Powered by Substrate" footer |
| `SubstrateProviders` | React Query provider wrapper with optional outer provider (tRPC, etc.) |
| `createMetadata` | Next.js `Metadata` factory from `{ name, url }` |
| `registerInstrumentation` | Next.js instrumentation hook factory — feature manifest + OTel |
| `SubstrateError` | Error boundary shell |
| `SubstrateGlobalError` | Global error boundary shell (renders full `<html>`) |
| `SubstrateLoading` | Loading skeleton shell |
| `SubstrateNotFound` | 404 shell |
| `ThemeScript` | Inline theme script (prevents FOUC) |
| `SmoothScroll` | Lenis smooth scroll provider |
| `PaintRegistrar` | CSS Paint API worklet registration |
| `cardFlip`, `fadeInUp`, `magneticHover`, `scaleEntrance`, `staggerReveal`, `scrollTo` | GSAP animation utilities |

### `@substrate/ui` — Components

| Export | What it does |
|--------|-------------|
| `Button` | Variants: primary, accent, ghost, outline |
| `GlassCard` | Glassmorphism container |
| `Badge` | Tag/chip component |
| `Switch` | Toggle switch |
| `styles.css` | `--substrate-*` tokens + `.substrate-*` classes |

### `@substrate/content` — Content layer

| Export | What it does |
|--------|-------------|
| `createSearchIndex` | Orama in-memory index from `SearchableDoc[]` |
| `SearchableDoc<TType>` | Generic content type for search indexing |
| Fumadocs MDX config | MDX content source configuration |

### `@substrate/config` — Feature manifest

| Export | What it does |
|--------|-------------|
| `featureManifestSchema` | Zod schema for the feature manifest |
| `FeatureManifest` | Inferred type |
| `initFeatures(manifest)` | Set the active manifest at startup |
| `features()` | Get the active manifest |
| `isEnabled(feature)` | Check if a specific feature is on |
| `validateEnv(manifest)` | List missing env vars for enabled features |
| `strictValidateEnv(manifest)` | Throw if env vars are missing |
| Preset constants | `minimalSiteFeatures`, `graphicsLabFeatures`, `aiArchiveFeatures`, `realtimeRoomFeatures`, `referenceFeatures` |

### `@substrate/contracts` — Type contracts

The root entrypoint has **zero heavyweight runtime dependencies** — only `zod`.
Import core types and primitives from `@substrate/contracts`:

- `SiteIdentity`, `EntityId`, `Result`/`ok`/`err`
- `EntityRef`, `EntityResolver`, `EntitySnapshot`
- `AuthorizationPolicy`, `Principal`, `preflight`
- `LifecycleDefinition<State, Event>`, `resolveTransition`
- `ChangeSet`, `TransactionalCommitEngine`
- `PublishResult`, `executePublish`, `buildPreview`
- `SnapshotStore`, `ContentAddressedStore`, `AssetStore`
- `SearchMode`, `authorizedSearch`, `assertStaticIndexIsPublic`

Optional integration capabilities are available via subpath exports (each
pulls in its own runtime dependencies only when imported):

| Subpath | What it provides | Runtime dep |
|---------|-----------------|------------|
| `@substrate/contracts/trpc` | tRPC router builder, `appRouter` | `@trpc/server` |
| `@substrate/contracts/effect` | Effect service composition (Database, Logger, AI) | `effect` |
| `@substrate/contracts/store` | Zustand vanilla UI store (theme, toasts) | `zustand` |
| `@substrate/contracts/openapi` | OpenAPI 3.1 document factory | `@asteasolutions/zod-to-openapi` |

### Other packages (opt-in)

| Package | When you need it |
|---------|------------------|
| `@substrate/db` | `snapshot`, `contentAddressedStorage`, or `assets` features |
| `@substrate/edge` | `edge` feature (Cloudflare Workers) |
| `@substrate/ai` | `ai` feature (RAG, chat, embeddings) |
| `@substrate/graphics` | `graphics` feature (Three.js, R3F, WebGPU) |
| `@substrate/observability` | `observability` feature (OTel, Sentry, PostHog) |
| `@substrate/tokens` | Design token source files (Style Dictionary) |

---

## 6. Customising beyond the scaffold

### Change the accent colour

```css
/* globals.css */
:root {
  --accent-primary: #your-brand-color;
  --accent-glow: rgba(your, rgb, alpha, 0.15);
}
```

`@substrate/ui` components consume `--accent-primary` — the entire
component library inherits your brand.

### Add a new route

Create any file under `src/app/`. The platform does not constrain your
routing. Import from `@substrate/ui` for components, from `@/lib/<content>`
for data.

### Enable a new feature

1. Edit `src/instrumentation.ts`:

   ```ts
   export const register = registerInstrumentation({
     featurePreset: 'ai-archive',  // or pass featureManifest: { ... }
     serviceName: 'my-site',
   });
   ```

2. Edit `src/app/layout.tsx` to call `initFeatures()` with the matching
   manifest (or remove the call — `registerInstrumentation` handles it).

3. Uncomment the needed variables in `.env.example` and fill them in.

4. Add any backend-specific files (API routes, edge worker, etc.) — see
   the matching example under `examples/` for reference.

### Replace the search engine

The scaffold uses Orama via `@substrate/content/search`. You are not
locked in — `createSearchIndex` is the only integration point. Replace
it with any search library by implementing the same interface:

```ts
interface SearchIndex {
  search(term: string, limit?: number): Promise<{ hits: Array<{ document: SearchableDoc }> }>;
}
```

---

## 7. Common workflows

```bash
# Develop your site (hot reload via Turbopack)
bun dev --filter my-site

# Build for production
bun build --filter my-site

# Run your site's tests
bun test --filter my-site

# Type-check only
bun typecheck --filter my-site

# Clean build artifacts
bun clean --filter my-site
```

---

## 8. What the platform will never do

These are hard guarantees enforced by the
[boundary CI gate](../scripts/check-boundary.ts):

- **No hardcoded entity types** — `writing`, `project`, `experience`
  are your names, not the platform's.
- **No hardcoded lifecycle states** — `draft`, `published`, `archived`
  are your names.
- **No hardcoded visibility levels** — `private`, `public` are your names.
- **No brand names** — `Aevum`, `Juwan`, `juwanh.com` are scrubbed from
  all platform packages.
- **No application-specific tables** — the platform provides only
  generic metadata tables (`entities`, `associations`, `snapshots`).
  Your typed tables live in your own migration.
- **No import from `examples/` or `aevum/`** — the dependency direction
  is `Application → Platform`, never the reverse.

If you ever find platform code that references your site's identity,
that's a bug — report it.

---

## Standalone Mode (not yet available)

`create-substrate-site --standalone` generates a project with versioned
npm dependencies instead of `workspace:*`. However, **Substrate packages
are not yet published to npm**, so standalone-generated sites cannot
install dependencies today.

When the npm publishing pipeline is in place, standalone mode will work
as follows:

```bash
bun run ./scripts/create-substrate-site.ts my-site --standalone
cd my-site
bun install
bun dev
```

Until then, use monorepo (workspace) mode — it is fully functional and
is the primary supported workflow.

---

## Where to look for reference

| If you want to see... | Look at |
|----------------------|---------|
| The simplest possible site | `examples/minimal-site/` |
| A site that consumes `@substrate/site` shell primitives | `examples/northstar/` |
| Graphics / WebGPU / WASM capability | `examples/graphics-lab/` |
| AI / RAG / hybrid search capability | `examples/ai-archive/` |
| Realtime / Durable Objects capability | `examples/realtime-room/` |
| Platform boundary rules (for contributors) | [`docs/architecture/PLATFORM_BOUNDARY.md`](./architecture/PLATFORM_BOUNDARY.md) |
| CSS package boundary | [`docs/css.md`](./css.md) |
| Architectural conventions (state, DB, observability) | [`CONTRIBUTING.md`](../CONTRIBUTING.md) |
