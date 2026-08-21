# Substrate

[![npm](https://img.shields.io/npm/v/@substrate-platform/site?include_prereleases&label=%40substrate-platform%2Fsite)](https://www.npmjs.com/package/@substrate-platform/site)
[![npm canary](https://img.shields.io/npm/v/@substrate-platform/contracts@canary?label=canary)](https://www.npmjs.com/package/@substrate-platform/contracts)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)

An open-source platform for building modern personal sites.

TypeScript / React frontend, Rust → WASM core, edge-native deployment.

Substrate is not a website — it is the foundation you build one on.

## What is Substrate?

Substrate is a modular platform that gives you everything needed to build a
personal site — content layer, component library, graphics engine, database
access, edge functions, AI integration, and observability — without forcing a
specific site structure or feature set.

Every capability is controlled by a **Feature Manifest**: a Zod-validated
schema that lets you start with a pure static site and progressively turn on
auth, search, AI, realtime, and more as you need them.

```text
Substrate (this repo)
├─ packages/          reusable platform modules
│  └─ site/           site shell primitives (@substrate-platform/site)
├─ crates/            Rust → WASM core
└─ examples/          focused demos + consumer validation
```

## Quick Start

### Install from npm

Substrate packages are published to npm under the `@substrate-platform` scope.
You don't need to clone this repo.

Requires [Bun](https://bun.sh) `>= 1.4.0` or [Node.js](https://nodejs.org) `>= 22.00`.

```bash
# Scaffold a new site with versioned npm dependencies
bun create-substrate-site my-site --preset minimal --standalone
cd my-site
bun install
bun dev
```

Or install individual packages directly:

```bash
npm install @substrate-platform/site@canary
```

See [`docs/CONSUMER_GUIDE.md`](./docs/CONSUMER_GUIDE.md) for a complete walkthrough.

### Develop in the monorepo (contributors)

If you're contributing to Substrate itself:

```bash
bun install
bun dev
bun build
bun test
bun lint

# Build WASM bindings (requires Rust toolchain)
bun wasm:build

# Check platform boundary (CI gate)
bun boundary:check
```

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for architectural rules.

## Create Your Own Site

```bash
# Scaffold with npm dependencies (no monorepo clone needed)
bun create-substrate-site my-site --preset minimal --standalone
cd my-site
bun install
bun dev
```

This generates a Next.js project using `@substrate-platform/site` platform
primitives (SubstrateLayout, createMetadata, registerInstrumentation,
error/loading shells). The script rewrites site identity, package metadata,
feature preset, starter content, and theme defaults to match your input.

Or start from an existing Next.js project and install packages manually:

```bash
npm install @substrate-platform/site@canary @substrate-platform/ui@canary @substrate-platform/config@canary
```

Then customise:

| File | What to change |
|------|---------------|
| `src/app/layout.tsx` | Site name, metadata, fonts |
| `src/app/globals.css` | Theme tokens (colors, spacing, radius) |
| `src/lib/<content>.ts` | Your content |
| `src/instrumentation.ts` | Feature preset (or define your own manifest) |

The three things that define a site are the **preset**, the **feature manifest**,
and the **content**. Everything else is yours to shape.

### npm Channels

| Channel | Tag | Stability |
|---------|-----|-----------|
| Canary | `@canary` | Bleeding-edge — every CI build |
| Stable | `@latest` | Production-ready releases |

```bash
npm install @substrate-platform/site@canary   # latest canary
npm install @substrate-platform/site@latest   # latest stable
```

### Monorepo Mode (contributors)

If you're contributing to Substrate, scaffold from within the monorepo
using `workspace:*` dependencies:

```bash
# From the monorepo root
bun create-site my-site --preset minimal
bun dev --filter my-site
```

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the full development workflow.

## Feature Presets

Every deployment declares which capabilities are active via a Feature Manifest
(`@substrate-platform/config`). Five presets are included, ranging from minimal sites
to capability-focused and reference configurations; use them as-is or as a
starting point for your own.

| Preset | Data | Graphics | AI | Runtime | Use case |
|--------|------|----------|----|---------|----------|
| `minimal` | Static | — | — | Web | Pure static content site |
| `graphics` | Static | WebGPU + WASM | — | Web | Interactive 3D / GPU demos |
| `ai-archive` | PostgreSQL | — | RAG + chat | Server | AI-powered knowledge base |
| `realtime` | Realtime state | — | — | Edge | Realtime collaboration |
| `reference` | — | All | All | All | Capability showcase |

See [`examples/`](./examples) for a working demo of each preset.

## CSS Contract

Substrate uses a three-tier CSS contract: consumer-owned Tailwind entry,
platform UI styles (`@substrate-platform/ui`), and site-level utilities
(`@substrate-platform/site`). See [`docs/css.md`](./docs/css.md) for the full
boundary specification and Turbopack resolver details.

## Structure

```text
substrate/
├─ examples/                    # Focused demos — one per feature preset + consumer validation
│  ├─ minimal-site/             #   Simplest usage (static content, no backend)
│  ├─ graphics-lab/             #   WebGPU / WASM / R3F capability demo
│  ├─ ai-archive/               #   RAG, hybrid search, chat capability demo
│  ├─ realtime-room/            #   Durable Objects, presence capability demo
│  └─ northstar/                #   Independent consumer validation (fictional site)
├─ packages/                    # Reusable platform modules
│  ├─ site/                     #   @substrate-platform/site          — Site shell primitives
│  ├─ ui/                       #   @substrate-platform/ui            — Component library
│  ├─ content/                  #   @substrate-platform/content       — MDX & content layer
│  ├─ graphics/                 #   @substrate-platform/graphics      — GPU / WebGL / rendering
│  ├─ contracts/                #   @substrate-platform/contracts     — Type contracts & schemas
│  ├─ db/                       #   @substrate-platform/db            — Database access (Drizzle)
│  ├─ edge/                     #   @substrate-platform/edge          — Cloudflare Workers (Hono)
│  ├─ config/                   #   @substrate-platform/config        — Feature manifest & presets
│  ├─ tokens/                   #   @substrate-platform/tokens        — Design tokens (Style Dictionary)
│  └─ observability/            #   @substrate-platform/observability — OpenTelemetry & telemetry
├─ crates/                      # Rust core
│  ├─ core/                     #   substrate-core          — Graph, SIMD, content
│  └─ wasm/                     #   substrate-wasm          → WASM bindings
├─ e2e/                         # Platform-level E2E tests
├─ package.json
├─ bun.lock
├─ turbo.json
├─ Cargo.toml
└─ rust-toolchain.toml
```

### examples/ roles

| Example | Role | Build |
|---------|------|-------|
| `minimal-site` | Simplest usage — minimal platform surface | ✅ |
| `graphics-lab` | Graphics capability demo | ✅ |
| `ai-archive` | AI capability demo | ✅ |
| `realtime-room` | Realtime capability demo | ✅ |
| `northstar` | **Independent consumer validation** — a completely fictional site that proves a third party can build on Substrate without knowing any platform internals | ✅ |

`northstar` is the **consumer conformance fixture**: when Substrate makes
breaking changes, Northstar is the regression test that proves the platform
remains consumable.

## Platform Primitives (`@substrate-platform/site`)

The `@substrate-platform/site` package provides a minimal site shell for
Substrate-based sites. It does NOT include any application-specific
features (newsletter, search, auth, etc.).

```tsx
import {
  SubstrateLayout,
  createMetadata,
} from '@substrate-platform/site';
import { GeistSans } from 'geist/font/sans';
import type { ReactNode } from 'react';

const identity = {
  name: 'My Site',
  url: 'https://example.com',
};

export const metadata = createMetadata(identity);

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SubstrateLayout fontClass={GeistSans.variable}>
      {children}
    </SubstrateLayout>
  );
}
```

The full API surface also includes `SubstrateProviders` (React Query wrapper),
`SubstrateError` / `SubstrateLoading` / `SubstrateNotFound` (convention-file
shells), `registerInstrumentation` (feature manifest + OTel factory),
`ThemeScript`, `SmoothScroll`, and `PaintRegistrar`.

### "Powered by Substrate" Attribution

The `SubstrateLayout` renders a "Powered by Substrate" footer by default.
This is a **brand default, not a licence requirement** — under Apache-2.0,
you are free to disable it:

```tsx
// Default — shows "Powered by Substrate" → official GitHub.
<SubstrateLayout fontClass={fontVar}>{children}</SubstrateLayout>

// Disable entirely.
<SubstrateLayout
  fontClass={fontVar}
  poweredBy={{ enabled: false }}
>
  {children}
</SubstrateLayout>
```

The label and link are **not configurable**. When shown, the attribution
always reads "Powered by Substrate" and always links to the official
Substrate repository. This ensures it serves as a genuine ecosystem entry
point, not a generic brand slot.

## Tech Stack

You do not need the entire stack to build a site. Features are opt-in through
the Feature Manifest — minimal sites require only the core web stack, while
databases, edge services, AI, and realtime infrastructure are activated by the
selected feature profile.

**Frontend** — Next.js 16.3 (App Router, RSC, PPR, View Transitions), React 19.3 + React Compiler, Tailwind CSS 4, GSAP + Lenis

**Graphics** — Three.js / R3F, WebGPU / WGSL, Rust → WASM layout engine

**Backend** — PostgreSQL 17 + pgvector (Drizzle ORM), Cloudflare Workers + Hono, Upstash Redis, Turso read replica

**AI** — Vercel AI SDK, OpenAI / Anthropic / Google, Transformers.js, WebLLM, Langfuse

**Auth** — Better Auth, WebAuthn / Passkeys, GitHub OAuth

**Observability** — OpenTelemetry, Sentry, PostHog

**Tooling** — Bun 1.4.0, Turborepo, Biome + oxlint, Vitest, Playwright, Lighthouse CI, Nix devshell

**Deployment** — Vercel (web), Cloudflare Workers (edge), GitHub Actions (CI/CD)

See [`docs/CONSUMER_GUIDE.md`](./docs/CONSUMER_GUIDE.md) for a complete
walkthrough on building a site with Substrate. See
[`CONTRIBUTING.md`](./CONTRIBUTING.md) for architectural boundaries and
rules on state management, observability, and database usage. See
[`docs/architecture/PLATFORM_BOUNDARY.md`](./docs/architecture/PLATFORM_BOUNDARY.md)
for the full platform boundary contract.

## License

[Apache-2.0](./LICENSE)
