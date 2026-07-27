//! SIMD-accelerated force computation for the Fruchterman–Reingold layout.
//!
//! Uses the `wide` crate for portable SIMD (f32x4) that works on stable Rust.
//! When compiled for wasm32 with `+simd128`, the WASM SIMD intrinsics are used
//! automatically; on x86_64 it uses AVX2/SSE, on aarch64 it uses NEON.
//!
//! The all-pairs repulsive force (O(n²)) is the bottleneck — SIMD processes
//! 4 node pairs per iteration, giving ~3-4× speedup on large graphs.

use wide::f32x4;

/// Compute repulsive forces for one node against all others using SIMD.
///
/// Processes 4 nodes at a time via f32x4. The remaining tail (n % 4) is
/// handled with scalar fallback.
///
/// Returns the accumulated force (fx, fy) on the target node.
pub fn repulsive_forces_simd(
    target_x: f32,
    target_y: f32,
    nodes_x: &[f32],
    nodes_y: &[f32],
    k: f32,
) -> (f32, f32) {
    let n = nodes_x.len();
    let mut fx = 0.0_f32;
    let mut fy = 0.0_f32;

    // SIMD lanes: process 4 nodes at a time.
    let lanes = 4;
    let chunks = n / lanes;

    let target_x_v = f32x4::splat(target_x);
    let target_y_v = f32x4::splat(target_y);
    let k_v = f32x4::splat(k);
    let min_dist = f32x4::splat(0.01);
    let zero = f32x4::splat(0.0);

    let mut acc_fx = f32x4::splat(0.0);
    let mut acc_fy = f32x4::splat(0.0);

    for i in 0..chunks {
        let base = i * lanes;
        let nx = f32x4::from([
            nodes_x[base],
            nodes_x[base + 1],
            nodes_x[base + 2],
            nodes_x[base + 3],
        ]);
        let ny = f32x4::from([
            nodes_y[base],
            nodes_y[base + 1],
            nodes_y[base + 2],
            nodes_y[base + 3],
        ]);

        // diff = target - node
        let dx = target_x_v - nx;
        let dy = target_y_v - ny;

        // dist = max(sqrt(dx² + dy²), 0.01)
        let dist_sq = dx * dx + dy * dy;
        let dist = dist_sq.sqrt().max(min_dist);

        // force = (k²) / dist
        let force = (k_v * k_v) / dist;

        // direction = diff / dist
        let dir_x = dx / dist;
        let dir_y = dy / dist;

        acc_fx += dir_x * force;
        acc_fy += dir_y * force;
    }

    // Horizontal sum of the 4 lanes.
    let fx_arr: [f32; 4] = acc_fx.into();
    let fy_arr: [f32; 4] = acc_fy.into();
    fx += fx_arr.iter().sum::<f32>();
    fy += fy_arr.iter().sum::<f32>();

    // Scalar tail.
    let tail_start = chunks * lanes;
    for i in tail_start..n {
        let dx = target_x - nodes_x[i];
        let dy = target_y - nodes_y[i];
        let dist = (dx * dx + dy * dy).sqrt().max(0.01);
        let force = (k * k) / dist;
        fx += dx / dist * force;
        fy += dy / dist * force;
    }

    let _ = zero; // suppress unused warning
    (fx, fy)
}

/// Compute attractive forces along edges using SIMD.
///
/// Processes 4 edges at a time. Each edge contributes an attractive force
/// pulling the target node toward its neighbor.
pub fn attractive_forces_simd(
    target_x: f32,
    target_y: f32,
    neighbor_x: &[f32],
    neighbor_y: &[f32],
    k: f32,
) -> (f32, f32) {
    let n = neighbor_x.len();
    let mut fx = 0.0_f32;
    let mut fy = 0.0_f32;

    let lanes = 4;
    let chunks = n / lanes;

    let target_x_v = f32x4::splat(target_x);
    let target_y_v = f32x4::splat(target_y);
    let k_v = f32x4::splat(k);
    let min_dist = f32x4::splat(0.01);

    let mut acc_fx = f32x4::splat(0.0);
    let mut acc_fy = f32x4::splat(0.0);

    for i in 0..chunks {
        let base = i * lanes;
        let nx = f32x4::from([
            neighbor_x[base],
            neighbor_x[base + 1],
            neighbor_x[base + 2],
            neighbor_x[base + 3],
        ]);
        let ny = f32x4::from([
            neighbor_y[base],
            neighbor_y[base + 1],
            neighbor_y[base + 2],
            neighbor_y[base + 3],
        ]);

        // diff = neighbor - target (attraction pulls toward neighbor)
        let dx = nx - target_x_v;
        let dy = ny - target_y_v;

        let dist_sq = dx * dx + dy * dy;
        let dist = dist_sq.sqrt().max(min_dist);

        // attractive force = dist² / k
        let force = dist_sq / k_v;

        let dir_x = dx / dist;
        let dir_y = dy / dist;

        acc_fx += dir_x * force;
        acc_fy += dir_y * force;
    }

    let fx_arr: [f32; 4] = acc_fx.into();
    let fy_arr: [f32; 4] = acc_fy.into();
    fx += fx_arr.iter().sum::<f32>();
    fy += fy_arr.iter().sum::<f32>();

    // Scalar tail.
    let tail_start = chunks * lanes;
    for i in tail_start..n {
        let dx = neighbor_x[i] - target_x;
        let dy = neighbor_y[i] - target_y;
        let dist = (dx * dx + dy * dy).sqrt().max(0.01);
        let force = (dist * dist) / k;
        fx += dx / dist * force;
        fy += dy / dist * force;
    }

    (fx, fy)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simd_matches_scalar_repulsive() {
        let nodes_x = vec![1.0, 2.0, 3.0, 4.0, 5.0, 0.5, -1.0, 2.5];
        let nodes_y = vec![0.0, 1.0, 0.5, -1.0, 2.0, 3.0, -0.5, 1.5];

        let (fx_simd, fy_simd) = repulsive_forces_simd(0.0, 0.0, &nodes_x, &nodes_y, 1.0);

        // Scalar reference.
        let mut fx_scalar = 0.0_f32;
        let mut fy_scalar = 0.0_f32;
        for i in 0..nodes_x.len() {
            let dx = 0.0 - nodes_x[i];
            let dy = 0.0 - nodes_y[i];
            let dist = (dx * dx + dy * dy).sqrt().max(0.01);
            let force = 1.0 / dist;
            fx_scalar += dx / dist * force;
            fy_scalar += dy / dist * force;
        }

        // SIMD and scalar should produce nearly identical results.
        assert!(
            (fx_simd - fx_scalar).abs() < 0.001,
            "fx mismatch: simd={fx_simd} scalar={fx_scalar}"
        );
        assert!(
            (fy_simd - fy_scalar).abs() < 0.001,
            "fy mismatch: simd={fy_simd} scalar={fy_scalar}"
        );
    }

    #[test]
    fn simd_handles_empty_input() {
        let (fx, fy) = repulsive_forces_simd(0.0, 0.0, &[], &[], 1.0);
        assert_eq!(fx, 0.0);
        assert_eq!(fy, 0.0);
    }

    #[test]
    fn simd_handles_tail() {
        // 5 nodes — 1 chunk of 4 + 1 tail.
        let nodes_x = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let nodes_y = vec![0.0, 1.0, 0.5, -1.0, 2.0];

        let (fx, fy) = repulsive_forces_simd(0.0, 0.0, &nodes_x, &nodes_y, 1.0);
        assert!(
            fx.abs() > 0.0 || fy.abs() > 0.0,
            "should have nonzero force"
        );
    }
}
