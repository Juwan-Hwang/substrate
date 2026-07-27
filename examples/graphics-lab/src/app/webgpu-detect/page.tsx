/**
 * WebGPU capability detection page.
 *
 * Queries navigator.gpu, requests an adapter, and displays
 * vendor/architecture/device info and supported features.
 */
'use client';

import { detectRendererTier, type RendererTier } from '@substrate/graphics';
import { useEffect, useState } from 'react';

type GpuInfo = {
  tier: RendererTier;
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
  features: string[];
  limits: Record<string, number>;
};

export default function WebGPUDetectPage() {
  const [info, setInfo] = useState<GpuInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function detect() {
      const tier = detectRendererTier();
      const base: GpuInfo = { tier, features: [], limits: {} };

      if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
        setInfo(base);
        return;
      }

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          setInfo({ ...base, tier: 'static' });
          return;
        }

        // adapter.info is available in recent browsers.
        const adapterInfo = (adapter as unknown as { info?: Partial<GPUAdapterInfo> }).info ?? {};
        const features = [...adapter.features].sort();
        const limits = Object.fromEntries(
          Object.entries(adapter.limits as unknown as Record<string, number>).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        );

        setInfo({
          ...base,
          tier: 'webgpu',
          vendor: adapterInfo.vendor,
          architecture: adapterInfo.architecture,
          device: adapterInfo.device,
          description: adapterInfo.description,
          features,
          limits,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'GPU detection failed');
        setInfo(base);
      }
    }
    detect();
  }, []);

  if (!info) {
    return <p style={{ color: 'var(--text-secondary)' }}>Detecting GPU…</p>;
  }

  const tierColors: Record<RendererTier, string> = {
    webgpu: 'var(--success)',
    webgl2: 'var(--accent)',
    canvas: 'var(--warning)',
    static: 'var(--danger)',
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div
        style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem' }}
      >
        <span
          className="lab-badge"
          style={{ background: tierColors[info.tier], color: '#000', fontSize: 13 }}
        >
          {info.tier.toUpperCase()}
        </span>
        {error && <span style={{ color: 'var(--danger)' }}>{error}</span>}
      </div>

      {info.tier === 'static' && (
        <div className="lab-card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--warning)' }}>WebGPU not available</h2>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Your browser does not support WebGPU. The platform will use WebGL2, Canvas 2D, or static
            SVG fallback depending on context. Try Chrome 113+ or Edge 113+ with WebGPU enabled.
          </p>
        </div>
      )}

      {info.tier === 'webgpu' && (
        <>
          <div className="lab-card" style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Adapter Info</h2>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: 'max-content 1fr',
                gap: '0.5rem 1rem',
                fontSize: '0.875rem',
              }}
            >
              <dt style={{ color: 'var(--text-tertiary)' }}>Vendor</dt>
              <dd>{info.vendor ?? 'unknown'}</dd>
              <dt style={{ color: 'var(--text-tertiary)' }}>Architecture</dt>
              <dd>{info.architecture ?? 'unknown'}</dd>
              <dt style={{ color: 'var(--text-tertiary)' }}>Device</dt>
              <dd>{info.device ?? 'unknown'}</dd>
              <dt style={{ color: 'var(--text-tertiary)' }}>Description</dt>
              <dd>{info.description ?? 'N/A'}</dd>
            </dl>
          </div>

          <div className="lab-card" style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
              Supported Features ({info.features.length})
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {info.features.map((f) => (
                <span
                  key={f}
                  className="lab-badge"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 10 }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          <div className="lab-card">
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
              Limits ({Object.keys(info.limits).length})
            </h2>
            <details>
              <summary
                style={{ cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)' }}
              >
                Show all limits
              </summary>
              <dl
                style={{
                  marginTop: '0.75rem',
                  display: 'grid',
                  gridTemplateColumns: 'max-content 1fr',
                  gap: '0.25rem 1rem',
                  fontSize: '0.75rem',
                }}
              >
                {Object.entries(info.limits).map(([k, v]) => (
                  <div key={k} style={{ display: 'contents' }}>
                    <dt style={{ color: 'var(--text-tertiary)' }}>{k}</dt>
                    <dd style={{ fontFamily: 'var(--font-geist-mono), monospace' }}>
                      {v.toLocaleString()}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          </div>
        </>
      )}
    </div>
  );
}
