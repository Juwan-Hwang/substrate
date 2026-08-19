# substrate-core

Core domain logic for the Substrate platform — graph algorithms, content
parsing, experiment runtime, and SIMD-accelerated force computation.

## Modules

| Module   | Responsibility                                                  |
|----------|-----------------------------------------------------------------|
| `graph`  | Force-directed layout (Fruchterman–Reingold), graph indexing    |
| `simd`   | Portable SIMD (f32x4) acceleration for all-pairs repulsion     |
| `content`| Frontmatter parsing & slugification                            |
| `experiment` | Benchmark runtime — synthetic graph generation & timing     |

## Key Types

- `KnowledgeGraph` — serializable graph with named nodes/edges
- `IndexedGraph` — GPU-ready graph with flat byte buffers for `wgpu`
- `GraphVertex` / `GraphEdge` — `#[repr(C)]` + `Pod` for zero-copy upload
- `ContentEntry` — parsed frontmatter content (slug, title, body, tags)

## SIMD

The `simd` module uses the [`wide`](https://crates.io/crates/wide) crate for
portable f32x4 vectors. On wasm32 with `+simd128`, WASM SIMD intrinsics are
used automatically; on x86_64 it uses AVX2/SSE, on aarch64 it uses NEON.

The all-pairs repulsive force (O(n²)) is the layout bottleneck — SIMD
processes 4 node pairs per iteration, giving ~3–4× speedup on large graphs.

## Usage

```rust
use substrate_core::KnowledgeGraph;

let mut graph = KnowledgeGraph::default();
graph.nodes.push(/* ... */);
graph.edges.push(/* ... */);
graph.layout(200); // 200 iterations of force-directed layout
```

## Testing

```bash
cargo test -p substrate-core
```
