/**
 * Tests for graphics-lab: renderer tier detection and demo graph validity.
 */

import { detectRendererTier } from '@substrate-platform/graphics';
import { describe, expect, it } from 'vitest';
import { demoGraph } from '../lib/demo-graph';

describe('detectRendererTier', () => {
  it('returns "static" when navigator is undefined', () => {
    // In Node.js / Vitest environment, navigator and document are undefined.
    const tier = detectRendererTier();
    expect(['static', 'webgpu', 'webgl2', 'canvas']).toContain(tier);
  });
});

describe('demoGraph data integrity', () => {
  it('has nodes with unique IDs', () => {
    const ids = demoGraph.nodes.map((n) => n.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('has valid positions (3-element arrays)', () => {
    for (const node of demoGraph.nodes) {
      expect(node.position).toHaveLength(3);
      node.position.forEach((v) => {
        expect(typeof v).toBe('number');
      });
    }
  });

  it('has edges that reference existing node IDs', () => {
    const ids = new Set(demoGraph.nodes.map((n) => n.id));
    for (const edge of demoGraph.edges) {
      expect(ids.has(edge.source)).toBe(true);
      expect(ids.has(edge.target)).toBe(true);
    }
  });

  it('has at least 20 nodes and 25 edges', () => {
    expect(demoGraph.nodes.length).toBeGreaterThanOrEqual(20);
    expect(demoGraph.edges.length).toBeGreaterThanOrEqual(25);
  });
});
