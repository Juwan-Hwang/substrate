# substrate-wasm

WASM bindings for the Substrate platform — exposes `substrate-core` to the
browser and to WASI runtimes.

## Build Modes

### Browser / JS (default)

Target: `wasm32-unknown-unknown`

Exposes core domain logic via `wasm-bindgen`, enabling in-page GPU-accelerated
graph layout and client-side experiment execution without a server round-trip.

```bash
wasm-pack build crates/wasm --target web --release
```

Produces `@substrate-platform/wasm` in `crates/wasm/pkg/`, consumed by
`@substrate-platform/graphics` via `import init from '@substrate-platform/wasm'`.

#### WebGPU

The `gpu` module uses `wgpu` with the `webgpu` feature. The `has_webgpu()`
function detects availability at runtime; callers should check before
requesting GPU-accelerated layout.

### Component Model (WASI Preview 2)

Target: `wasm32-wasip2`

Produces a standalone WASM Component via `wit-bindgen` that can run in any
WASI Preview 2 runtime (wasmtime, wasmer) without JavaScript glue.

```bash
cargo build -p substrate-wasm --no-default-features --features component \
  --target wasm32-wasip2 --release
wasm-tools component new target/wasm32-wasip2/release/substrate_wasm.wasm \
  -o crates/wasm/substrate.component.wasm
```

## Features

| Feature    | Target              | Bindings         | Use case                    |
|------------|---------------------|------------------|-----------------------------|
| `js` (default) | `wasm32-unknown-unknown` | wasm-bindgen + wgpu | Browser / Next.js       |
| `component`    | `wasm32-wasip2`          | wit-bindgen         | WASI runtimes           |
| `simd`         | any (nightly)            | std::simd           | Experimental portable SIMD |

## Testing

```bash
cargo test -p substrate-wasm
```
