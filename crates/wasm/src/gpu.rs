//! GPU-accelerated force-directed layout using wgpu (WebGPU).
//!
//! Uses a compute shader to run Fruchterman–Reingold layout on the GPU.
//! Falls back to CPU (`WasmGraph`) when WebGPU is unavailable.
//!
//! Pipeline:
//!  1. Upload vertex/edge buffers to GPU
//!  2. Dispatch compute shader (ping-pong between src/dst buffers)
//!  3. Read back positions via map-read buffer

use substrate_core::{GraphVertex, KnowledgeGraph};
use wasm_bindgen::prelude::*;
use wgpu::util::DeviceExt;

/// WGSL compute shader for force-directed graph layout.
///
/// Each invocation computes the net force on one node and writes the
/// new position to `dst_vertices`. Reads come from `src_vertices` so
/// there are no read-write conflicts within a dispatch.
const LAYOUT_SHADER: &str = r#"
struct Params {
    node_count: u32,
    edge_count: u32,
    dt: f32,
    k: f32,
}

struct Vertex {
    pos: vec3<f32>,
    weight: f32,
}

struct Edge {
    source: u32,
    target: u32,
    weight: f32,
    _pad: u32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> src: array<Vertex>;
@group(0) @binding(2) var<storage, read> edges: array<Edge>;
@group(0) @binding(3) var<storage, read_write> dst: array<Vertex>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x;
    if (i >= params.node_count) {
        return;
    }

    let my_pos = src[i].pos;
    var force = vec3<f32>(0.0, 0.0, 0.0);

    // Repulsive forces (all-pairs).
    for (var j: u32 = 0u; j < params.node_count; j++) {
        if (j == i) { continue; }
        let diff = my_pos - src[j].pos;
        let dist = max(length(diff), 0.01);
        let repulsion = (params.k * params.k) / dist;
        force += normalize(diff) * repulsion;
    }

    // Attractive forces along edges.
    for (var e: u32 = 0u; e < params.edge_count; e++) {
        let edge = edges[e];
        if (edge.source == i) {
            let other = src[edge.target].pos;
            let diff = other - my_pos;
            let dist = max(length(diff), 0.01);
            let attraction = (dist * dist) / params.k;
            force += normalize(diff) * attraction;
        } else if (edge.target == i) {
            let other = src[edge.source].pos;
            let diff = other - my_pos;
            let dist = max(length(diff), 0.01);
            let attraction = (dist * dist) / params.k;
            force -= normalize(diff) * attraction;
        }
    }

    dst[i].pos = my_pos + force * params.dt;
    dst[i].weight = src[i].weight;
}
"#;

/// Uniform params matching the WGSL `Params` struct.
#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct Params {
    node_count: u32,
    edge_count: u32,
    dt: f32,
    k: f32,
}

/// GPU-accelerated force-directed layout.
///
/// ```js
/// const gpu = await GpuLayout.create();
/// gpu.loadGraph(graphJson);
/// await gpu.step(0.1);
/// const positions = await gpu.readPositions(); // Float32Array
/// ```
#[wasm_bindgen]
pub struct GpuLayout {
    device: wgpu::Device,
    queue: wgpu::Queue,
    pipeline: wgpu::ComputePipeline,
    bind_group_layout: wgpu::BindGroupLayout,

    src_buffer: wgpu::Buffer,
    dst_buffer: wgpu::Buffer,
    edge_buffer: wgpu::Buffer,
    param_buffer: wgpu::Buffer,

    node_count: usize,
    edge_count: usize,
}

#[wasm_bindgen]
impl GpuLayout {
    /// Create a GPU layout engine. Returns `Err` if WebGPU is unavailable.
    #[wasm_bindgen(js_name = "create")]
    pub async fn create() -> Result<GpuLayout, JsValue> {
        let instance = wgpu::Instance::default();

        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: None,
                force_fallback_adapter: false,
            })
            .await
            .map_err(|_| JsValue::from_str("No suitable GPU adapter found"))?;

        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                label: Some("substrate-gpu"),
                required_features: wgpu::Features::empty(),
                required_limits: wgpu::Limits::downlevel_defaults(),
                memory_hints: wgpu::MemoryHints::default(),
                trace: wgpu::Trace::Off,
                experimental_features: wgpu::ExperimentalFeatures::disabled(),
            })
            .await
            .map_err(|e| JsValue::from_str(&format!("Failed to get GPU device: {e:?}")))?;

        // Bind group layout: params, src_vertices, edges, dst_vertices.
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("layout-bgl"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 3,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("layout-pl"),
            bind_group_layouts: &[&bind_group_layout],
            immediate_size: 0,
        });

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("layout-shader"),
            source: wgpu::ShaderSource::Wgsl(LAYOUT_SHADER.into()),
        });

        let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("layout-pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("main"),
            compilation_options: wgpu::PipelineCompilationOptions::default(),
            cache: None,
        });

        // Pre-allocate empty buffers (resized on load_graph).
        let src_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("src-vertices"),
            size: 0,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let dst_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("dst-vertices"),
            size: 0,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        });
        let edge_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("edges"),
            size: 0,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let param_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("params"),
            contents: bytemuck::bytes_of(&Params {
                node_count: 0,
                edge_count: 0,
                dt: 0.0,
                k: 1.0,
            }),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        Ok(GpuLayout {
            device,
            queue,
            pipeline,
            bind_group_layout,
            src_buffer,
            dst_buffer,
            edge_buffer,
            param_buffer,
            node_count: 0,
            edge_count: 0,
        })
    }

    /// Load a graph from JSON. Reallocates GPU buffers if the size changed.
    #[wasm_bindgen(js_name = "loadGraph")]
    pub fn load_graph(&mut self, json: &str) -> bool {
        let graph = match KnowledgeGraph::from_json(json) {
            Ok(g) => g,
            Err(_) => return false,
        };

        let indexed = graph.index();
        self.node_count = indexed.vertices.len();
        self.edge_count = indexed.edges.len();

        if self.node_count == 0 {
            return true;
        }

        let vertex_bytes = indexed.vertices_bytes();
        let edge_bytes = indexed.edges_bytes();

        // Recreate buffers (GPU buffers are immutable in size).
        self.src_buffer = self
            .device
            .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("src-vertices"),
                contents: vertex_bytes,
                usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            });
        self.dst_buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("dst-vertices"),
            size: vertex_bytes.len() as u64,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        });

        if !edge_bytes.is_empty() {
            self.edge_buffer = self
                .device
                .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                    label: Some("edges"),
                    contents: edge_bytes,
                    usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
                });
        }

        true
    }

    /// Run one compute step with the given temperature (`dt`).
    ///
    /// Dispatches the compute shader, then copies dst → src so the next
    /// step reads the updated positions.
    pub async fn step(&mut self, dt: f32) -> Result<(), JsValue> {
        if self.node_count == 0 {
            return Ok(());
        }

        // Update params.
        self.queue.write_buffer(
            &self.param_buffer,
            0,
            bytemuck::bytes_of(&Params {
                node_count: self.node_count as u32,
                edge_count: self.edge_count as u32,
                dt,
                k: 1.0,
            }),
        );

        let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("layout-bg"),
            layout: &self.bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: self.param_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: self.src_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: self.edge_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: self.dst_buffer.as_entire_binding(),
                },
            ],
        });

        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("layout-encoder"),
            });

        {
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("layout-pass"),
                timestamp_writes: None,
            });
            pass.set_pipeline(&self.pipeline);
            pass.set_bind_group(0, &bind_group, &[]);
            let workgroups = (self.node_count as u32).div_ceil(64);
            pass.dispatch_workgroups(workgroups, 1, 1);
        }

        // Copy dst → src for next iteration.
        encoder.copy_buffer_to_buffer(
            &self.dst_buffer,
            0,
            &self.src_buffer,
            0,
            self.dst_buffer.size(),
        );

        self.queue.submit(std::iter::once(encoder.finish()));
        let _ = self.device.poll(wgpu::PollType::Wait {
            submission_index: None,
            timeout: None,
        });

        Ok(())
    }

    /// Read back vertex positions as a Float32Array.
    ///
    /// Creates a staging buffer, copies data, maps it, and returns the data.
    #[wasm_bindgen(js_name = "readPositions")]
    pub async fn read_positions(&self) -> Result<js_sys::Float32Array, JsValue> {
        if self.node_count == 0 {
            return Ok(js_sys::Float32Array::new(&JsValue::from(0)));
        }

        let size = self.dst_buffer.size();
        let staging = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("staging"),
            size,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("read-encoder"),
            });
        encoder.copy_buffer_to_buffer(&self.dst_buffer, 0, &staging, 0, size);
        self.queue.submit(std::iter::once(encoder.finish()));

        let slice = staging.slice(..);
        slice.map_async(wgpu::MapMode::Read, |_| {});
        let _ = self.device.poll(wgpu::PollType::Wait {
            submission_index: None,
            timeout: None,
        });

        let data = slice.get_mapped_range();
        let vertices: &[GraphVertex] = bytemuck::cast_slice(&data);
        let positions: Vec<f32> = vertices.iter().flat_map(|v| [v.x, v.y, v.z]).collect();

        Ok(js_sys::Float32Array::from(&positions[..]))
    }

    /// Get the number of nodes currently loaded.
    #[wasm_bindgen(js_name = "nodeCount")]
    pub fn node_count(&self) -> usize {
        self.node_count
    }
}
