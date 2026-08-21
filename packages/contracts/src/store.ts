/**
 * Zustand — lightweight client-side state store.
 *
 * Provides a generic UI store (theme, sidebar, command palette, toasts).
 * Application-specific stores are defined by the application.
 *
 * The store is SSR-safe (guards `typeof window`).
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

// ── React hook shim ─────────────────────────────────────────────────
//
// In the web app, use `useStore` from `zustand/react` to subscribe:
//
//   import { useStore } from 'zustand/react';
//   import { uiStore } from '@substrate-platform/contracts';
//
//   const theme = useStore(uiStore, (s) => s.theme);
//
// The vanilla store is exported here so it works in any context
// (workers, edge, tests) without React.
