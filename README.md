# Substrate

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
│  └─ site/           site shell primitives (@substrate/site)
├─ crates/            Rust → WASM core
└─ examples/          focused demos + consumer validation
```

## Quick Start

Requires [Bun](https://bun.sh) `>= 1.4.0` and [Node.js](https://nodejs.org) `>= 22.0.0`. A [Rust toolchain](https://rustup.rs) is optional — only needed for WASM builds.

```bash
# Install dependencies
bun install

# Start the dev server (runs all packages via turbo)
bun dev

# Build everything
bun build

# Run tests
bun test

# Lint
bun lint

# Build WASM bindings (requires the Rust toolchain)
bun wasm:build

# Check platform boundary (CI gate — detects application-specific contamination)
bun boundary:check
```

## Create Your Own Site

```bash
# Interactive — prompts for name, preset, author, URL
bun create-site

# Non-interactive
bun create-site my-site --preset minimal --author Alice --url https://alice.dev
```

This scaffolds a new site from Substrate's consumer template —
a project using `@substrate/site` platform primitives (SubstrateLayout,
createMetadata, registerInstrumentation, error/loading shells).
The script rewrites site identity, package metadata, feature preset, starter
content, and theme defaults to match your input. Then:

```bash
bun install
bun dev --filter my-site
```

See [`docs/CONSUMER_GUIDE.md`](./docs/CONSUMER_GUIDE.md) for a complete
walkthrough — every file, every platform primitive, every customisation
point.

Customise:

| File | What to change |
|------|---------------|
| `src/app/layout.tsx` | Site name, metadata, fonts |
| `src/app/globals.css` | Theme tokens (colors, spacing, radius) |
| `src/lib/<content>.ts` | Your content |
| `src/instrumentation.ts` | Feature preset (or define your own manifest) |

### Standalone Mode (not yet available)

> **Not yet available.** Standalone mode generates versioned npm dependencies,
> but Substrate packages are not yet published to npm. Standalone-generated
> sites **cannot install dependencies today** — `bun install` will fail.
> Use monorepo (workspace) mode, which is fully functional and is the primary
> supported workflow.

When the npm publishing pipeline is in place, standalone mode will work as
follows:

```bash
bun run ./scripts/create-substrate-site.ts my-site --standalone
cd my-site
bun install
bun dev
```

The three things that define a site are the **preset**, the **feature manifest**,
and the **content**. Everything else is yours to shape.

## Feature Presets

Every deployment declares which capabilities are active via a Feature Manifest
(`@substrate/config`). Five presets are included, ranging from minimal sites
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
platform UI styles (`@substrate/ui`), and site-level utilities
(`@substrate/site`). See [`docs/css.md`](./docs/css.md) for the full
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
│  ├─ site/                     #   @substrate/site          — Site shell primitives
│  ├─ ui/                       #   @substrate/ui            — Component library
│  ├─ content/                  #   @substrate/content       — MDX & content layer
│  ├─ graphics/                 #   @substrate/graphics      — GPU / WebGL / rendering
│  ├─ contracts/                #   @substrate/contracts     — Type contracts & schemas
│  ├─ db/                       #   @substrate/db            — Database access (Drizzle)
│  ├─ edge/                     #   @substrate/edge          — Cloudflare Workers (Hono)
│  ├─ config/                   #   @substrate/config        — Feature manifest & presets
│  ├─ tokens/                   #   @substrate/tokens        — Design tokens (Style Dictionary)
│  └─ observability/            #   @substrate/observability — OpenTelemetry & telemetry
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

## Platform Primitives (`@substrate/site`)

The `@substrate/site` package provides a minimal site shell for
Substrate-based sites. It does NOT include any application-specific
features (newsletter, search, auth, etc.).

```tsx
import {
  SubstrateLayout,
  createMetadata,
} from '@substrate/site';
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
