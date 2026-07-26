/** Home — list of available graphics experiments. */
import Link from 'next/link';

const EXPERIMENTS = [
  {
    href: '/force-graph',
    title: 'Force-Directed Graph',
    desc: 'WASM-accelerated force-directed layout with WebGPU compute and CPU fallback.',
    tags: ['WASM', 'WebGPU', 'SVG'],
  },
  {
    href: '/webgpu-detect',
    title: 'WebGPU Capability Detection',
    desc: 'Detects WebGPU support, queries adapter info, and displays available features.',
    tags: ['WebGPU', 'Detection'],
  },
  {
    href: '/wgsl-particles',
    title: 'WGSL Particle System',
    desc: 'GPU compute shader particle simulation with Canvas 2D rendering fallback.',
    tags: ['WGSL', 'Compute', 'Canvas'],
  },
] as const;

export default function HomePage() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '6rem 1.5rem' }}>
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700 }}>Graphics Lab</h1>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
          WebGPU/WGSL, React Three Fiber, Rust/WASM — with full fallback chain.
        </p>
      </header>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {EXPERIMENTS.map((exp) => (
          <Link key={exp.href} href={exp.href} className="lab-card" style={{ display: 'block' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{exp.title}</h2>
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {exp.desc}
            </p>
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              {exp.tags.map((t) => (
                <span key={t} className="lab-badge" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                  {t}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
