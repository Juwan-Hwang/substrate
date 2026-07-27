# ────────────────────────────────────────────────────────────────────────
#  Aevum Web — Next.js 16 on Bun
#  Multi-stage build:  deps → builder → runner
# ────────────────────────────────────────────────────────────────────────
# Bun 1.4.0 (Rust rewrite) — canary 通道。oven/bun:canary 镜像即 1.4.0 Rust 版。
# 等 1.4.0 正式发布后改为 oven/bun:1.4.0。
FROM oven/bun:canary AS base

# ── Stage 1 · Dependencies ──────────────────────────────────────────────
#  Copy only manifests first so dependency installation is cached unless
#  the lockfile or a package.json changes.
FROM base AS deps
WORKDIR /app

COPY bun.lock bunfig.toml package.json ./

# Every workspace package.json must exist for --frozen-lockfile resolution.
COPY packages/ai/package.json            packages/ai/
COPY packages/config/package.json        packages/config/
COPY packages/content/package.json       packages/content/
COPY packages/contracts/package.json     packages/contracts/
COPY packages/db/package.json            packages/db/
COPY packages/edge/package.json          packages/edge/
COPY packages/graphics/package.json      packages/graphics/
COPY packages/observability/package.json packages/observability/
COPY packages/tokens/package.json        packages/tokens/
COPY packages/ui/package.json            packages/ui/
COPY packages/web/package.json           packages/web/
COPY apps/aevum/package.json             apps/aevum/
COPY examples/ai-archive/package.json    examples/ai-archive/
COPY examples/graphics-lab/package.json  examples/graphics-lab/
COPY examples/minimal-site/package.json  examples/minimal-site/
COPY examples/realtime-room/package.json examples/realtime-room/
COPY crates/wasm/pkg/package.json        crates/wasm/pkg/

RUN bun install --frozen-lockfile

# ── Stage 2 · Builder ───────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN cd packages/web && bun run build

# ── Stage 3 · Runner ────────────────────────────────────────────────────
FROM base AS runner

ARG APP_VERSION=0.1.0
ARG REVISION
ARG CREATED

LABEL org.opencontainers.image.title="Substrate Web" \
      org.opencontainers.image.description="Aevum — Next.js 16 web application on Bun" \
      org.opencontainers.image.source="https://github.com/Juwan-Hwang/substrate" \
      org.opencontainers.image.documentation="https://github.com/Juwan-Hwang/substrate" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later" \
      org.opencontainers.image.authors="Juwan-Hwang" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${CREATED}" \
      org.opencontainers.image.base.name="docker.io/oven/bun:canary"

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user — oven/bun:1 ships as root.
RUN groupadd --system --gid 1001 bunjs \
 && useradd  --system --uid 1001 --gid 1001 --no-create-home --shell /usr/sbin/nologin bunjs

# Runtime: production dependencies + workspace sources + build output.
COPY --from=builder --chown=bunjs:bunjs /app/node_modules       ./node_modules
COPY --from=builder --chown=bunjs:bunjs /app/package.json       ./package.json
COPY --from=builder --chown=bunjs:bunjs /app/bunfig.toml        ./bunfig.toml
COPY --from=builder --chown=bunjs:bunjs /app/turbo.json         ./turbo.json
COPY --from=builder --chown=bunjs:bunjs /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=builder --chown=bunjs:bunjs /app/packages           ./packages

USER bunjs
EXPOSE 3000

# `next start` honours $PORT and $HOSTNAME.
WORKDIR /app/packages/web
CMD ["bun", "run", "start"]
