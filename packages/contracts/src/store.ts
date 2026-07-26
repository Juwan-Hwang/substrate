/**
 * Zustand — lightweight client-side state stores.
 *
 * Three stores:
 *  - uiStore: theme, sidebar, command palette, toasts
 *  - latticeStore: graph config, renderer tier, selected node
 *  - crucibleStore: experiment list, current experiment, filter
 *
 * Each store is SSR-safe (guards `typeof window`).
 */
import { createStore } from 'zustand/vanilla';

// ── UI store ────────────────────────────────────────────────────────

export type Toast = {
  id: string;
  message: string;
  variant: 'info' | 'success' | 'error';
};

export type UIState = {
  theme: 'dark' | 'light';
  accent: 'blue' | 'green' | 'orange' | 'pink' | 'purple';
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  toasts: Toast[];
  setTheme: (theme: 'dark' | 'light') => void;
  setAccent: (accent: UIState['accent']) => void;
  toggleSidebar: () => void;
  toggleCommandPalette: () => void;
  addToast: (message: string, variant?: Toast['variant']) => void;
  removeToast: (id: string) => void;
};

export const uiStore = createStore<UIState>((set) => ({
  theme: 'dark',
  accent: 'purple',
  sidebarOpen: false,
  commandPaletteOpen: false,
  toasts: [],
  setTheme: (theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
    set({ theme });
  },
  setAccent: (accent) => {
    if (typeof document !== 'undefined') {
      const themes = ['blue', 'green', 'orange', 'pink', 'purple'];
      for (const t of themes) {
        document.documentElement.classList.remove(`theme-${t}`);
      }
      document.documentElement.classList.add(`theme-${accent}`);
    }
    set({ accent });
  },
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  addToast: (message, variant = 'info') => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    // Auto-dismiss after 4s.
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// ── Lattice store ───────────────────────────────────────────────────

export type LatticeState = {
  rendererTier: 'webgpu' | 'webgl2' | 'canvas' | 'static';
  selectedNodeId: string | null;
  layoutIterations: number;
  dt: number;
  showLabels: boolean;
  showEdges: boolean;
  fps: number;
  setRendererTier: (tier: LatticeState['rendererTier']) => void;
  selectNode: (id: string | null) => void;
  setLayoutIterations: (n: number) => void;
  setDt: (dt: number) => void;
  toggleLabels: () => void;
  toggleEdges: () => void;
  setFps: (fps: number) => void;
};

export const latticeStore = createStore<LatticeState>((set) => ({
  rendererTier: 'webgpu',
  selectedNodeId: null,
  layoutIterations: 500,
  dt: 0.1,
  showLabels: true,
  showEdges: true,
  fps: 0,
  setRendererTier: (rendererTier) => set({ rendererTier }),
  selectNode: (selectedNodeId) => set({ selectedNodeId }),
  setLayoutIterations: (layoutIterations) => set({ layoutIterations }),
  setDt: (dt) => set({ dt }),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleEdges: () => set((s) => ({ showEdges: !s.showEdges })),
  setFps: (fps) => set({ fps }),
}));

// ── Crucible store ──────────────────────────────────────────────────

export type CrucibleState = {
  experiments: Array<{
    id: string;
    name: string;
    subsystem: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    createdAt: number;
  }>;
  filter: 'all' | 'lattice' | 'crucible' | 'archive';
  currentExperimentId: string | null;
  setExperiments: (experiments: CrucibleState['experiments']) => void;
  addExperiment: (exp: CrucibleState['experiments'][number]) => void;
  updateExperimentStatus: (id: string, status: CrucibleState['experiments'][number]['status']) => void;
  setFilter: (filter: CrucibleState['filter']) => void;
  setCurrentExperiment: (id: string | null) => void;
};

export const crucibleStore = createStore<CrucibleState>((set) => ({
  experiments: [],
  filter: 'all',
  currentExperimentId: null,
  setExperiments: (experiments) => set({ experiments }),
  addExperiment: (exp) => set((s) => ({ experiments: [exp, ...s.experiments] })),
  updateExperimentStatus: (id, status) =>
    set((s) => ({
      experiments: s.experiments.map((e) => (e.id === id ? { ...e, status } : e)),
    })),
  setFilter: (filter) => set({ filter }),
  setCurrentExperiment: (currentExperimentId) => set({ currentExperimentId }),
}));

// ── React hook shim ─────────────────────────────────────────────────
//
// In the web app, use `useStore` from `zustand/react` to subscribe:
//
//   import { useStore } from 'zustand/react';
//   import { uiStore } from '@substrate/contracts';
//
//   const theme = useStore(uiStore, (s) => s.theme);
//
// The vanilla store is exported here so it works in any context
// (workers, edge, tests) without React.
