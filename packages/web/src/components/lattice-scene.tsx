/**
 * LatticeScene — client-side 3D knowledge graph visualisation.
 *
 * Mounts the @substrate/graphics WebGPU/R3F canvas with a live
 * force-directed layout powered by @substrate/wasm.
 *
 * Fallback chain: WebGPU compute → WASM CPU → static SVG.
 */
'use client';

import {
  createLayout,
  detectRendererTier,
  type KnowledgeGraph,
  type RendererTier,
} from '@substrate/graphics';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';

// Dynamically import the 3D scene (ssr: false — Three.js is client-only).
const GraphScene3D = dynamic(() => import('@substrate/graphics').then((m) => m.GraphScene3D), {
  ssr: false,
  loading: () => null,
});

// ── Demo graph data ─────────────────────────────────────────────────

const DEMO_GRAPH: KnowledgeGraph = {
  nodes: [
    { id: 'core', label: 'Substrate Core', position: [0, 0, 0], weight: 3 },
    { id: 'web', label: 'Web', position: [2, 1, 0], weight: 2 },
    { id: 'edge', label: 'Edge', position: [-2, 1, 0], weight: 2 },
    { id: 'db', label: 'Database', position: [0, -2, 0], weight: 2 },
    { id: 'ai', label: 'AI', position: [3, -1, 0], weight: 1.5 },
    { id: 'graphics', label: 'Graphics', position: [-3, -1, 0], weight: 1.5 },
    { id: 'content', label: 'Content', position: [1, 3, 0], weight: 1 },
    { id: 'contracts', label: 'Contracts', position: [-1, 3, 0], weight: 1 },
    { id: 'obs', label: 'Observability', position: [0, 4, 0], weight: 0.8 },
    { id: 'wasm', label: 'WASM', position: [-4, 0, 0], weight: 1 },
    { id: 'ui', label: 'UI', position: [4, 0, 0], weight: 1 },
    { id: 'tokens', label: 'Tokens', position: [4, 2, 0], weight: 0.5 },
  ],
  edges: [
    { source: 'core', target: 'web' },
    { source: 'core', target: 'edge' },
    { source: 'core', target: 'db' },
    { source: 'core', target: 'contracts' },
    { source: 'web', target: 'ai' },
    { source: 'web', target: 'graphics' },
    { source: 'web', target: 'content' },
    { source: 'web', target: 'ui' },
    { source: 'edge', target: 'db' },
    { source: 'edge', target: 'obs' },
    { source: 'ai', target: 'db' },
    { source: 'graphics', target: 'wasm' },
    { source: 'ui', target: 'tokens' },
    { source: 'contracts', target: 'content' },
    { source: 'contracts', target: 'db' },
  ],
};

// ── Component ───────────────────────────────────────────────────────

export function LatticeScene() {
  const [tier, setTier] = useState<RendererTier>('static');
  const [fps, setFps] = useState(0);
  const [layoutType, setLayoutType] = useState<'gpu' | 'cpu' | 'init'>('init');
  const [error, setError] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Map<string, [number, number]>>(new Map());
  const animationRef = useRef<number>(0);
  const layoutRef = useRef<Awaited<ReturnType<typeof createLayout>> | null>(null);

  // Detect renderer tier on mount.
  useEffect(() => {
    const detected = detectRendererTier();
    setTier(detected);
  }, []);

  // Initialise layout engine and run simulation.
  const initLayout = useCallback(async () => {
    try {
      const layout = await createLayout(DEMO_GRAPH);
      layoutRef.current = layout;
      setLayoutType(layout.type);

      let lastTime = performance.now();
      let frameCount = 0;
      let fpsTime = lastTime;

      const tick = async () => {
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        await layout.step(dt);
        const positions = await layout.positions();

        // Update node positions for rendering.
        const posMap = new Map<string, [number, number]>();
        const nodeArray = DEMO_GRAPH.nodes;
        for (let i = 0; i < nodeArray.length && i * 3 + 1 < positions.length; i++) {
          posMap.set(nodeArray[i].id, [positions[i * 3], positions[i * 3 + 1]]);
        }
        setNodePositions(posMap);

        // FPS tracking.
        frameCount++;
        if (now - fpsTime >= 1000) {
          setFps(Math.round((frameCount * 1000) / (now - fpsTime)));
          frameCount = 0;
          fpsTime = now;
        }

        animationRef.current = requestAnimationFrame(tick);
      };

      animationRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to initialise layout');
    }
  }, []);

  useEffect(() => {
    initLayout();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [initLayout]);

  // ── Render ────────────────────────────────────────────────────────

  const tierColor: Record<RendererTier, string> = {
    webgpu: '#7C8BA0',
    webgl2: '#5B8DB8',
    canvas: '#8B7355',
    static: '#666',
  };

  // If WASM failed to load, render static SVG fallback.
  if (error) {
    return (
      <div className="mt-12 h-[600px] w-full aevum-glass-card p-8">
        <p className="text-text-secondary">Graphics fallback (static): {error}</p>
        <StaticGraph graph={DEMO_GRAPH} />
      </div>
    );
  }

  // Convert 2D positions to 3D for the R3F scene.
  const positions3D = new Map<string, [number, number, number]>();
  for (const [id, [x, y]] of nodePositions) {
    positions3D.set(id, [x, y, 0]);
  }

  const use3D = tier === 'webgpu' || tier === 'webgl2';

  return (
    <div className="mt-12">
      {/* Renderer info bar */}
      <div className="mb-4 flex items-center gap-4 text-sm">
        <span className="aevum-badge" style={{ background: tierColor[tier] }}>
          {tier.toUpperCase()}
        </span>
        <span className="text-text-secondary">
          Layout: {layoutType === 'init' ? 'initialising…' : layoutType.toUpperCase()}
        </span>
        <span className="text-text-secondary">{fps} FPS</span>
        <span className="text-text-secondary">{DEMO_GRAPH.nodes.length} nodes</span>
      </div>

      {/* 3D R3F canvas (WebGPU/WebGL2) or 2D SVG fallback (canvas/static) */}
      <div className="h-[600px] w-full aevum-glass-card overflow-hidden">
        {use3D && nodePositions.size > 0 ? (
          <GraphScene3D graph={DEMO_GRAPH} positions={positions3D} />
        ) : (
          <LiveGraph graph={DEMO_GRAPH} positions={nodePositions} width={1200} height={600} />
        )}
      </div>
    </div>
  );
}

// ── Live 2D graph renderer (canvas-tier fallback + primary view) ────

function LiveGraph({
  graph,
  positions,
  width,
  height,
}: {
  graph: KnowledgeGraph;
  positions: Map<string, [number, number]>;
  width: number;
  height: number;
}) {
  // Project positions to screen coordinates.
  const project = (x: number, y: number): [number, number] => {
    const scale = 60;
    const cx = width / 2;
    const cy = height / 2;
    return [cx + x * scale, cy + y * scale];
  };

  return (
    <svg
      className="h-full w-full"
      viewBox={`0 0 ${width} ${height}`}
      style={{ pointerEvents: 'none' }}
    >
      <title>Live knowledge graph</title>
      {/* Edges */}
      {graph.edges.map((edge) => {
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
            stroke="rgba(124, 139, 160, 0.3)"
            strokeWidth={1}
          />
        );
      })}

      {/* Nodes */}
      {graph.nodes.map((node) => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        const [x, y] = project(pos[0], pos[1]);
        const r = (node.weight ?? 1) * 8;
        return (
          <g key={node.id}>
            <circle
              cx={x}
              cy={y}
              r={r}
              fill="rgba(124, 139, 160, 0.8)"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={1}
            />
            <text
              x={x}
              y={y - r - 4}
              textAnchor="middle"
              className="fill-current text-text-secondary"
              style={{ fontSize: '11px', fontFamily: 'var(--font-geist-mono, monospace)' }}
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Static fallback (no WASM, no canvas) ────────────────────────────

function StaticGraph({ graph }: { graph: KnowledgeGraph }) {
  return (
    <svg viewBox="0 0 800 400" className="mt-4 h-[400px] w-full">
      <title>Static graph fallback</title>
      {graph.nodes.map((node, i) => {
        const angle = (i / graph.nodes.length) * Math.PI * 2;
        const x = 400 + Math.cos(angle) * 150;
        const y = 200 + Math.sin(angle) * 100;
        return (
          <g key={node.id}>
            <circle cx={x} cy={y} r={20} fill="rgba(124, 139, 160, 0.3)" />
            <text x={x} y={y + 4} textAnchor="middle" fill="#999" fontSize="10">
              {node.label}
            </text>
          </g>
        );
      })}
      {graph.edges.map((edge) => {
        const srcIdx = graph.nodes.findIndex((n) => n.id === edge.source);
        const tgtIdx = graph.nodes.findIndex((n) => n.id === edge.target);
        if (srcIdx < 0 || tgtIdx < 0) return null;
        const sAngle = (srcIdx / graph.nodes.length) * Math.PI * 2;
        const tAngle = (tgtIdx / graph.nodes.length) * Math.PI * 2;
        return (
          <line
            key={`${edge.source}-${edge.target}`}
            x1={400 + Math.cos(sAngle) * 150}
            y1={200 + Math.sin(sAngle) * 100}
            x2={400 + Math.cos(tAngle) * 150}
            y2={200 + Math.sin(tAngle) * 100}
            stroke="rgba(124, 139, 160, 0.15)"
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}
