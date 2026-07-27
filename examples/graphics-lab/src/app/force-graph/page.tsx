/**
 * ForceGraphScene — interactive force-directed graph with WASM layout.
 *
 * Uses @substrate/graphics createLayout() which tries WebGPU compute
 * first, falls back to WASM CPU, and renders via SVG.
 *
 * 'use client' — requires browser APIs (navigator, canvas, WASM).
 */
'use client';

import {
  createLayout,
  detectRendererTier,
  type KnowledgeGraph,
  type RendererTier,
} from '@substrate/graphics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { demoGraph } from '../../lib/demo-graph';

export default function ForceGraphScene() {
  const [tier, setTier] = useState<RendererTier>('static');
  const [fps, setFps] = useState(0);
  const [layoutType, setLayoutType] = useState<'gpu' | 'cpu' | 'init'>('init');
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<Map<string, [number, number]>>(new Map());
  const [nodeCount, setNodeCount] = useState(demoGraph.nodes.length);
  const [dt, setDt] = useState(0.1);
  const [showLabels, setShowLabels] = useState(true);
  const [running, setRunning] = useState(true);

  const animRef = useRef<number>(0);
  const layoutRef = useRef<Awaited<ReturnType<typeof createLayout>> | null>(null);

  // Detect renderer tier on mount.
  useEffect(() => {
    setTier(detectRendererTier());
  }, []);

  // Init layout engine.
  const initLayout = useCallback(async () => {
    try {
      const layout = await createLayout(demoGraph);
      layoutRef.current = layout;
      setLayoutType(layout.type);
      setNodeCount(layout.nodeCount());

      let lastTime = performance.now();
      let frameCount = 0;
      let fpsTime = lastTime;

      const tick = async () => {
        if (!running) {
          animRef.current = requestAnimationFrame(tick);
          return;
        }
        const now = performance.now();
        const frameDt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        await layout.step(dt * frameDt * 60);
        const pos = await layout.positions();

        const posMap = new Map<string, [number, number]>();
        for (let i = 0; i < demoGraph.nodes.length && i * 3 + 1 < pos.length; i++) {
          posMap.set(demoGraph.nodes[i].id, [pos[i * 3], pos[i * 3 + 1]]);
        }
        setPositions(posMap);

        frameCount++;
        if (now - fpsTime >= 1000) {
          setFps(Math.round((frameCount * 1000) / (now - fpsTime)));
          frameCount = 0;
          fpsTime = now;
        }

        animRef.current = requestAnimationFrame(tick);
      };

      animRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Layout init failed');
    }
  }, [dt, running]);

  useEffect(() => {
    initLayout();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [initLayout]);

  // ── Project positions to screen ──────────────────────────────────

  const W = 1000;
  const H = 600;
  const project = (x: number, y: number): [number, number] => {
    const scale = 50;
    return [W / 2 + x * scale, H / 2 + y * scale];
  };

  // ── Static fallback ──────────────────────────────────────────────

  if (error) {
    return (
      <div className="lab-card" style={{ marginTop: '1.5rem' }}>
        <p style={{ color: 'var(--warning)' }}>Fallback (static SVG): {error}</p>
        <StaticGraph graph={demoGraph} width={W} height={H} project={project} />
      </div>
    );
  }

  const tierColor: Record<RendererTier, string> = {
    webgpu: 'var(--success)',
    webgl2: 'var(--accent)',
    canvas: 'var(--warning)',
    static: 'var(--text-tertiary)',
  };

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Info bar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          marginBottom: '0.75rem',
          fontSize: '0.875rem',
        }}
      >
        <span className="lab-badge" style={{ background: tierColor[tier], color: '#000' }}>
          {tier.toUpperCase()}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          Layout: {layoutType === 'init' ? '…' : layoutType.toUpperCase()}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>{fps} FPS</span>
        <span style={{ color: 'var(--text-secondary)' }}>{nodeCount} nodes</span>
      </div>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          className={`lab-btn ${running ? 'active' : ''}`}
          onClick={() => setRunning((r) => !r)}
        >
          {running ? 'Pause' : 'Play'}
        </button>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}
        >
          Speed
          <input
            type="range"
            min="0.01"
            max="0.5"
            step="0.01"
            value={dt}
            onChange={(e) => setDt(Number(e.target.value))}
            className="lab-slider"
            style={{ width: 120 }}
          />
          {dt.toFixed(2)}
        </label>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}
        >
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
          />
          Labels
        </label>
      </div>

      {/* SVG canvas */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{
          width: '100%',
          height: H,
          background: 'var(--bg-secondary)',
          borderRadius: 12,
          border: '1px solid var(--border-primary)',
        }}
      >
        <title>Force-directed graph</title>
        {/* Edges */}
        {demoGraph.edges.map((edge) => {
          const src = positions.get(edge.source);
          const tgt = positions.get(edge.target);
          if (!src || !tgt) return null;
          const [sx, sy] = project(src[0], src[1]);
          const [tx, ty] = project(tgt[0], tgt[1]);
          return (
            <line
              key={`${edge.source}-${edge.target}`}
              x1={sx}
              y1={sy}
              x2={tx}
              y2={ty}
              stroke="var(--accent-dim)"
              strokeWidth={1}
            />
          );
        })}
        {/* Nodes */}
        {demoGraph.nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const [x, y] = project(pos[0], pos[1]);
          const r = (node.weight ?? 1) * 6;
          return (
            <g key={node.id}>
              <circle
                cx={x}
                cy={y}
                r={r}
                fill="var(--accent)"
                fillOpacity={0.7}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={1}
              />
              {showLabels && (
                <text
                  x={x}
                  y={y - r - 4}
                  textAnchor="middle"
                  fill="var(--text-secondary)"
                  fontSize={10}
                  fontFamily="var(--font-geist-mono), monospace"
                >
                  {node.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Static SVG fallback — circular layout, no WASM. */
function StaticGraph({
  graph,
  width,
  height,
  project,
}: {
  graph: KnowledgeGraph;
  width: number;
  height: number;
  project: (x: number, y: number) => [number, number];
}) {
  const angleStep = (Math.PI * 2) / graph.nodes.length;
  const staticPos = new Map<string, [number, number]>();
  graph.nodes.forEach((node, i) => {
    const a = i * angleStep;
    staticPos.set(node.id, [Math.cos(a) * 4, Math.sin(a) * 4]);
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height, marginTop: '1rem' }}>
      <title>Static graph fallback</title>
      {graph.edges.map((edge) => {
        const s = staticPos.get(edge.source);
        const t = staticPos.get(edge.target);
        if (!s || !t) return null;
        const [sx, sy] = project(s[0], s[1]);
        const [tx, ty] = project(t[0], t[1]);
        return (
          <line
            key={`${edge.source}-${edge.target}`}
            x1={sx}
            y1={sy}
            x2={tx}
            y2={ty}
            stroke="var(--accent-dim)"
            strokeWidth={1}
          />
        );
      })}
      {graph.nodes.map((node) => {
        const pos = staticPos.get(node.id);
        if (!pos) return null;
        const [x, y] = project(pos[0], pos[1]);
        return (
          <g key={node.id}>
            <circle cx={x} cy={y} r={(node.weight ?? 1) * 6} fill="var(--accent-dim)" />
            <text x={x} y={y + 3} textAnchor="middle" fill="var(--text-tertiary)" fontSize={9}>
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
