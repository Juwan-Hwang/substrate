/**
 * WebGPU Compute Shader — Force-directed graph layout.
 * Hand-written WGSL, loaded via substrate-wasm.
 *
 * This is the raw WGSL source string; substrate-wasm will compile and
 * dispatch it on the GPU compute pipeline.
 */
export const GRAPH_LAYOUT_WGSL = /* wgsl */ `
struct GraphNode {
  position: vec3<f32>,
  velocity: vec3<f32>,
  weight: f32,
  _pad: vec3<f32>,
};

struct GraphEdge {
  source: u32,
  target: u32,
  weight: f32,
  _pad: f32,
};

struct Params {
  node_count: u32,
  edge_count: u32,
  dt: f32,
  k: f32,
};

@group(0) @binding(0) var<storage, read_write> nodes: array<GraphNode>;
@group(0) @binding(1) var<storage, read> edges: array<GraphEdge>;
@group(0) @binding(2) var<uniform> params: Params;

@compute @workgroup_size(64)
fn repulsion(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.node_count) { return; }

  for (var j: u32 = 0u; j < params.node_count; j++) {
    if (i == j) { continue; }
    let delta = nodes[i].position - nodes[j].position;
    let dist = max(length(delta), 0.001);
    let force = (params.k * params.k) / dist;
    nodes[i].velocity += normalize(delta) * force * params.dt;
  }
}

@compute @workgroup_size(64)
fn attraction(@builtin(global_invocation_id) gid: vec3<u32>) {
  let e = gid.x;
  if (e >= params.edge_count) { return; }

  let edge = edges[e];
  let a = nodes[edge.source];
  let b = nodes[edge.target];
  let delta = b.position - a.position;
  let dist = max(length(delta), 0.001);
  let force = (dist * dist) / params.k;

  nodes[edge.source].velocity += normalize(delta) * force * params.dt;
  nodes[edge.target].velocity -= normalize(delta) * force * params.dt;
}

@compute @workgroup_size(64)
fn integrate(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.node_count) { return; }
  nodes[i].position += nodes[i].velocity * params.dt;
  nodes[i].velocity *= 0.9; // damping
}
`;
