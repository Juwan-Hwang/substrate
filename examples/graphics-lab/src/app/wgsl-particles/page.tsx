/**
 * WGSL particle system — GPU compute with Canvas 2D fallback.
 *
 * Attempts to create a WebGPU compute pipeline for particle
 * simulation. If WebGPU is unavailable, runs a JS simulation
 * on the main thread and renders to Canvas 2D.
 */
'use client';

import { detectRendererTier } from '@substrate-platform/graphics';
import { useEffect, useRef, useState } from 'react';

const PARTICLE_COUNT = 500;
const CANVAS_W = 800;
const CANVAS_H = 500;

export default function WgslParticlesPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'webgpu' | 'js' | 'init'>('init');
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!ctx) return;
    const ctx2d: CanvasRenderingContext2D = ctx;

    const tier = detectRendererTier();
    const particles = new Float32Array(PARTICLE_COUNT * 2);
    const velocities = new Float32Array(PARTICLE_COUNT * 2);
    let animationId = 0;
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTime = lastTime;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles[i * 2] = Math.random() * CANVAS_W;
      particles[i * 2 + 1] = Math.random() * CANVAS_H;
      velocities[i * 2] = (Math.random() - 0.5) * 2;
      velocities[i * 2 + 1] = (Math.random() - 0.5) * 2;
    }

    async function tryWebGPU(): Promise<boolean> {
      if (tier !== 'webgpu' || typeof navigator === 'undefined' || !('gpu' in navigator)) {
        return false;
      }
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) return false;
        const device = await adapter.requestDevice();

        // Create buffers.
        const particleBuffer = device.createBuffer({
          size: particles.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        const velocityBuffer = device.createBuffer({
          size: velocities.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        // Write initial data.
        device.queue.writeBuffer(particleBuffer, 0, particles);
        device.queue.writeBuffer(velocityBuffer, 0, velocities);

        // WGSL compute shader.
        const shaderCode = `
          struct Particle { pos: vec2<f32>, vel: vec2<f32> };
          @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
          @group(0) @binding(1) var<storage, read_write> velocities: array<Particle>;

          @compute @workgroup_size(64)
          fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
            let i = gid.x;
            if (i >= ${PARTICLE_COUNT}u) { return; }

            var p = particles[i].pos;
            var v = velocities[i].vel;

            // Attract towards center.
            let center = vec2<f32>(${CANVAS_W}.0 / 2.0, ${CANVAS_H}.0 / 2.0);
            let dir = center - p;
            let dist = length(dir) + 0.001;
            v += dir / dist * 0.05;

            // Damping.
            v *= 0.99;

            // Update position.
            p += v;

            // Bounce off walls.
            if (p.x < 0.0 || p.x > ${CANVAS_W}.0) { v.x = -v.x; }
            if (p.y < 0.0 || p.y > ${CANVAS_H}.0) { v.y = -v.y; }
            p.x = clamp(p.x, 0.0, ${CANVAS_W}.0);
            p.y = clamp(p.y, 0.0, ${CANVAS_H}.0);

            particles[i].pos = p;
            velocities[i].vel = v;
          }
        `;

        const shaderModule = device.createShaderModule({ code: shaderCode });
        const pipeline = device.createComputePipeline({
          layout: 'auto',
          compute: { module: shaderModule, entryPoint: 'main' },
        });

        const bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: particleBuffer } },
            { binding: 1, resource: { buffer: velocityBuffer } },
          ],
        });

        // Read-back buffer.
        const readBuffer = device.createBuffer({
          size: particles.byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        setMode('webgpu');

        const tick = () => {
          const now = performance.now();
          const _dt = Math.min((now - lastTime) / 1000, 0.1);
          lastTime = now;

          // GPU compute.
          const encoder = device.createCommandEncoder();
          const pass = encoder.beginComputePass();
          pass.setPipeline(pipeline);
          pass.setBindGroup(0, bindGroup);
          pass.dispatchWorkgroups(Math.ceil(PARTICLE_COUNT / 64));
          pass.end();

          // Copy to read-back buffer.
          encoder.copyBufferToBuffer(particleBuffer, 0, readBuffer, 0, particles.byteLength);
          device.queue.submit([encoder.finish()]);

          // Read back and render.
          readBuffer.mapAsync(GPUMapMode.READ).then(() => {
            const data = new Float32Array(readBuffer.getMappedRange());
            renderParticles(ctx2d, data, PARTICLE_COUNT);
            readBuffer.unmap();

            frameCount++;
            if (now - fpsTime >= 1000) {
              setFps(Math.round((frameCount * 1000) / (now - fpsTime)));
              frameCount = 0;
              fpsTime = now;
            }
            animationId = requestAnimationFrame(tick);
          });
        };

        animationId = requestAnimationFrame(tick);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'WebGPU compute failed');
        return false;
      }
    }

    function runJSFallback() {
      setMode('js');

      const tick = () => {
        const now = performance.now();
        const _dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        // JS simulation — same physics as WGSL shader.
        const cx = CANVAS_W / 2;
        const cy = CANVAS_H / 2;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const px = particles[i * 2];
          const py = particles[i * 2 + 1];
          const dx = cx - px;
          const dy = cy - py;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
          velocities[i * 2] += (dx / dist) * 0.05;
          velocities[i * 2 + 1] += (dy / dist) * 0.05;
          velocities[i * 2] *= 0.99;
          velocities[i * 2 + 1] *= 0.99;
          particles[i * 2] += velocities[i * 2];
          particles[i * 2 + 1] += velocities[i * 2 + 1];

          if (particles[i * 2] < 0 || particles[i * 2] > CANVAS_W)
            velocities[i * 2] = -velocities[i * 2];
          if (particles[i * 2 + 1] < 0 || particles[i * 2 + 1] > CANVAS_H)
            velocities[i * 2 + 1] = -velocities[i * 2 + 1];
          particles[i * 2] = Math.max(0, Math.min(CANVAS_W, particles[i * 2]));
          particles[i * 2 + 1] = Math.max(0, Math.min(CANVAS_H, particles[i * 2 + 1]));
        }

        renderParticles(ctx2d, particles, PARTICLE_COUNT);

        frameCount++;
        if (now - fpsTime >= 1000) {
          setFps(Math.round((frameCount * 1000) / (now - fpsTime)));
          frameCount = 0;
          fpsTime = now;
        }
        animationId = requestAnimationFrame(tick);
      };

      animationId = requestAnimationFrame(tick);
    }

    tryWebGPU().then((ok) => {
      if (!ok) runJSFallback();
    });

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          marginBottom: '1rem',
          fontSize: '0.875rem',
        }}
      >
        <span
          className="lab-badge"
          style={{
            background:
              mode === 'webgpu'
                ? 'var(--success)'
                : mode === 'js'
                  ? 'var(--warning)'
                  : 'var(--text-tertiary)',
            color: '#000',
          }}
        >
          {mode === 'init' ? 'INIT…' : mode === 'webgpu' ? 'WEBGPU COMPUTE' : 'JS FALLBACK'}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>{fps} FPS</span>
        <span style={{ color: 'var(--text-secondary)' }}>{PARTICLE_COUNT} particles</span>
        {error && <span style={{ color: 'var(--danger)' }}>{error}</span>}
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{
          width: '100%',
          borderRadius: 12,
          border: '1px solid var(--border-primary)',
          background: '#060608',
        }}
      />

      <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
        Particles are attracted to the centre with damping. The WGSL compute shader runs the same
        physics on the GPU; if WebGPU is unavailable, a JavaScript fallback runs the identical
        simulation on CPU.
      </p>
    </div>
  );
}

/** Render particles to Canvas 2D. */
function renderParticles(ctx: CanvasRenderingContext2D, data: Float32Array, count: number) {
  ctx.fillStyle = 'rgba(6, 6, 8, 0.15)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = 'rgba(124, 139, 160, 0.8)';
  for (let i = 0; i < count; i++) {
    const x = data[i * 2];
    const y = data[i * 2 + 1];
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
