# Substrate

> **Aevum** — a personal site platform built on Substrate.

A polyglot monorepo combining a TypeScript / React frontend stack with Rust
core libraries compiled to WASM. The public-facing site is branded **Aevum**
and is organised into three subsystems:

```
Aevum
├─ Lattice     # GPU / knowledge graph / visual system
├─ Crucible    # runnable experiments / benchmark lab
└─ Archive     # articles / projects / notes
```

## Structure

```
substrate/
├─ apps/
│  └─ aevum/                  # The site users see (@substrate/web)
│     ├─ lattice/             # GPU / knowledge graph / visual system
│     ├─ crucible/            # Runnable experiments / benchmark lab
│     └─ archive/             # Articles / projects / notes
├─ packages/
│  ├─ web/                    # @substrate/web    — Next.js application
│  ├─ ui/                     # @substrate/ui     — Component library
│  ├─ content/                # @substrate/content — Content layer & MDX
│  ├─ graphics/               # @substrate/graphics — GPU / WebGL / rendering
│  ├─ contracts/              # @substrate/contracts — Type contracts & schemas
│  ├─ db/                     # @substrate/db      — Database access layer
│  ├─ edge/                   # @substrate/edge    — Edge functions & middleware
│  └─ observability/          # @substrate/observability — Telemetry & metrics
├─ crates/
│  ├─ core/                   # substrate-core    — Rust core library
│  └─ wasm/                   # substrate-wasm    — Rust → WASM bindings
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
├─ Cargo.toml
└─ rust-toolchain.toml
```

## License

[AGPL-3.0-or-later](./LICENSE)
