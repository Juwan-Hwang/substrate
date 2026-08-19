/**
 * GraphScene3D — R3F-powered 3D knowledge graph renderer.
 *
 * Renders graph nodes as 3D spheres and edges as lines,
 * with camera controls and optional post-processing.
 *
 * This component is dynamically imported (ssr: false) by the web app
 * to avoid pulling Three.js into the server bundle.
 */
import { Html, Line, OrbitControls, Sphere } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { Canvas } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { KnowledgeGraph } from './index';

export type GraphScene3DProps = {
  graph: KnowledgeGraph;
  positions: Map<string, [number, number, number]>;
  onNodeClick?: (nodeId: string) => void;
};

const NODE_COLOR = '#7C8BA0';
const EDGE_COLOR = '#7C8BA0';

function GraphNode3D({
  node,
  position,
  onClick,
}: {
  node: KnowledgeGraph['nodes'][number];
  position: [number, number, number];
  onClick?: (id: string) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const radius = Math.max(0.15, (node.weight ?? 1) * 0.2);

  return (
    <group position={position}>
      <Sphere
        ref={meshRef}
        args={[radius, 24, 24]}
        onClick={(e: ThreeEvent) => {
          e.stopPropagation();
          onClick?.(node.id);
        }}
        onPointerOver={(e: ThreeEvent) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
          if (meshRef.current) {
            meshRef.current.scale.setScalar(1.3);
          }
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
          if (meshRef.current) {
            meshRef.current.scale.setScalar(1);
          }
        }}
      >
        <meshStandardMaterial
          color={NODE_COLOR}
          emissive={NODE_COLOR}
          emissiveIntensity={0.3}
          roughness={0.4}
          metalness={0.6}
        />
      </Sphere>
      <Html distanceFactor={10} position={[0, radius + 0.3, 0]} center>
        <div
          style={{
            color: '#c8d0dc',
            fontSize: '12px',
            fontFamily: 'var(--font-geist-mono, monospace)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            textShadow: '0 0 4px rgba(0,0,0,0.8)',
          }}
        >
          {node.label}
        </div>
      </Html>
    </group>
  );
}

function GraphEdge3D({
  start,
  end,
}: {
  start: [number, number, number];
  end: [number, number, number];
}) {
  const points = useMemo(() => {
    const s = new THREE.Vector3(...start);
    const e = new THREE.Vector3(...end);
    return [s, e];
  }, [start, end]);

  return <Line points={points} color={EDGE_COLOR} lineWidth={1} transparent opacity={0.4} />;
}

export function GraphScene3D({ graph, positions, onNodeClick }: GraphScene3DProps) {
  const nodeArray = graph.nodes;
  const edgeArray = graph.edges;

  return (
    <Canvas
      camera={{ position: [0, 0, 12], fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#7C8BA0" />
      <pointLight position={[-10, -10, -5]} intensity={0.5} color="#5B8DB8" />

      {nodeArray.map((node) => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        const p3d: [number, number, number] = [pos[0], pos[1], pos[2] ?? 0];
        return <GraphNode3D key={node.id} node={node} position={p3d} onClick={onNodeClick} />;
      })}

      {edgeArray.map((edge) => {
        const src = positions.get(edge.source);
        const tgt = positions.get(edge.target);
        if (!src || !tgt) return null;
        const s: [number, number, number] = [src[0], src[1], src[2] ?? 0];
        const t: [number, number, number] = [tgt[0], tgt[1], tgt[2] ?? 0];
        return <GraphEdge3D key={`${edge.source}-${edge.target}`} start={s} end={t} />;
      })}

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={3}
        maxDistance={30}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </Canvas>
  );
}
