//! substrate-wasm — WASM bindings for Aevum.
//!
//! Two build modes:
//!
//! 1. **Browser/JS** (`default` / `js` feature, target `wasm32-unknown-unknown`):
//!    Exposes the core domain logic to the browser via wasm-bindgen, enabling
//!    in-page GPU-accelerated graph layout (Lattice) and client-side experiment
//!    execution (Crucible) without a server round-trip.
//!
//! 2. **Component Model** (`component` feature, target `wasm32-wasip2`):
//!    Produces a standalone WASM Component via wit-bindgen that can run in any
//!    WASI Preview 2 runtime (wasmtime, wasmer) without JavaScript glue.
//!
//! Build commands:
//!   Browser:  wasm-pack build crates/wasm --target web --release
//!   WASI:     cargo build -p substrate-wasm --no-default-features --features component --target wasm32-wasip2 --release

// ── Browser/JS bindings (wasm-bindgen + wgpu) ───────────────────────

#[cfg(feature = "js")]
pub mod graph;
#[cfg(feature = "js")]
pub mod gpu;

#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "js")]
pub use graph::WasmGraph;
#[cfg(feature = "js")]
pub use gpu::GpuLayout;

/// Returns the site brand.
#[cfg(feature = "js")]
#[wasm_bindgen]
pub fn site_brand() -> String {
    substrate_core::SITE_BRAND.to_string()
}

/// Returns the three subsystem names as a comma-separated string.
#[cfg(feature = "js")]
#[wasm_bindgen]
pub fn subsystems() -> String {
    substrate_core::SUBSYSTEMS.join(",")
}

/// Detect WebGPU availability in the current browser.
#[cfg(feature = "js")]
#[wasm_bindgen]
pub fn has_webgpu() -> bool {
    let Some(window) = web_sys::window() else { return false };
    let navigator = window.navigator();
    // navigator.gpu is a non-standard property — check via Reflect.
    let gpu = js_sys::Reflect::get(&navigator, &"gpu".into()).unwrap_or(JsValue::UNDEFINED);
    !gpu.is_undefined() && !gpu.is_null()
}

/// Parse frontmatter content (Archive subsystem).
#[cfg(feature = "js")]
#[wasm_bindgen]
pub fn parse_content(raw: &str) -> JsValue {
    let entry = substrate_core::parse_content(raw);
    serde_wasm_bindgen::to_value(&entry).unwrap_or(JsValue::NULL)
}

/// Initialize the WASM panic hook for better error messages in the console.
#[cfg(feature = "js")]
#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

// ── Component Model bindings (wit-bindgen + WASI Preview 2) ─────────

#[cfg(feature = "component")]
pub mod component;
