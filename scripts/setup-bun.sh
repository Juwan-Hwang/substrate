#!/usr/bin/env bash
# 安装 Bun 1.4.0 (Rust 重写版) — 通过 canary 通道分发。
# bun.sh/install 默认走 stable 通道装 1.3.14 (Zig)，
# 本脚本自动切换到 canary 通道获取 1.4.0 Rust 版。
#
# 用法:
#   bash scripts/setup-bun.sh          # 安装/升级到 canary
#   bash scripts/setup-bun.sh --check  # 检查当前版本

set -euo pipefail

if [ "${1:-}" = "--check" ]; then
    if command -v bun &>/dev/null; then
        echo "当前 Bun 版本: $(bun --version)"
    else
        echo "Bun 未安装"
    fi
    exit 0
fi

echo "[setup] 安装 Bun 1.4.0 (Rust, canary 通道)..."
curl -fsSL https://bun.sh/install | bash -s -- canary

# 激活环境
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

echo "[setup] 安装完成: $(bun --version)"
echo "[setup] 如需永久生效，请确保 ~/.bun/bin 在你的 PATH 中"
