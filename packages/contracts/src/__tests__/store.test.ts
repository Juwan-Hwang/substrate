/**
 * Unit tests for @substrate-platform/contracts/store — Zustand uiStore.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiStore } from '../store';

// ── Zustand: uiStore ──────────────────────────────────────────────────

describe('uiStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    uiStore.setState({
      theme: 'dark',
      accent: 'purple',
      sidebarOpen: false,
      commandPaletteOpen: false,
      toasts: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('setTheme updates the theme', () => {
    uiStore.getState().setTheme('light');
    expect(uiStore.getState().theme).toBe('light');
  });

  it('toggleSidebar flips the sidebar state', () => {
    expect(uiStore.getState().sidebarOpen).toBe(false);
    uiStore.getState().toggleSidebar();
    expect(uiStore.getState().sidebarOpen).toBe(true);
    uiStore.getState().toggleSidebar();
    expect(uiStore.getState().sidebarOpen).toBe(false);
  });

  it('addToast appends a toast with the given variant', () => {
    uiStore.getState().addToast('Saved', 'success');
    const toasts = uiStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.message).toBe('Saved');
    expect(toasts[0]?.variant).toBe('success');
  });

  it('addToast defaults to the info variant', () => {
    uiStore.getState().addToast('Hello');
    expect(uiStore.getState().toasts[0]?.variant).toBe('info');
  });

  it('removeToast removes the toast by id', () => {
    uiStore.getState().addToast('Hello');
    const id = uiStore.getState().toasts[0]?.id;
    expect(id).toBeDefined();
    if (id) {
      uiStore.getState().removeToast(id);
    }
    expect(uiStore.getState().toasts).toHaveLength(0);
  });

  it('auto-dismisses a toast after 4 seconds', () => {
    uiStore.getState().addToast('Temporary');
    expect(uiStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(4000);
    expect(uiStore.getState().toasts).toHaveLength(0);
  });
});
