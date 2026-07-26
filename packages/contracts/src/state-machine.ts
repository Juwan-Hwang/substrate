/**
 * XState — state machines for complex async workflows.
 *
 * Experiment lifecycle machine:
 *   idle → queued → running → completed
 *                       ↘ failed
 *   (any state) → cancelled
 *
 * Used by the Crucible subsystem to manage experiment execution.
 */
import { setup, assign, createActor } from 'xstate';
import type { Experiment } from './index';

// ── Experiment lifecycle ────────────────────────────────────────────

export type ExperimentStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ExperimentContext = {
  experiment: Experiment | null;
  error: string | null;
  startedAt: number | null;
  completedAt: number | null;
  progress: number;
};

export type ExperimentEvent =
  | { type: 'QUEUE'; experiment: Experiment }
  | { type: 'START' }
  | { type: 'PROGRESS'; progress: number }
  | { type: 'COMPLETE'; result: Record<string, unknown> }
  | { type: 'FAIL'; error: string }
  | { type: 'CANCEL' }
  | { type: 'RESET' };

export const experimentMachine = setup({
  types: {
    context: {} as ExperimentContext,
    events: {} as ExperimentEvent,
  },
  actions: {
    setExperiment: assign(({ event }) => {
      if (event.type !== 'QUEUE') return {};
      return {
        experiment: event.experiment,
        startedAt: null,
        completedAt: null,
        error: null,
        progress: 0,
      };
    }),
    setRunning: assign(() => ({
      startedAt: Date.now(),
    })),
    setProgress: assign(({ event }) => {
      if (event.type !== 'PROGRESS') return {};
      return { progress: event.progress };
    }),
    setCompleted: assign(({ event }) => {
      if (event.type !== 'COMPLETE') return {};
      return { completedAt: Date.now(), progress: 1 };
    }),
    setFailed: assign(({ event }) => {
      if (event.type !== 'FAIL') return {};
      return { error: event.error, completedAt: Date.now() };
    }),
    reset: assign(() => ({
      experiment: null,
      error: null,
      startedAt: null,
      completedAt: null,
      progress: 0,
    })),
  },
}).createMachine({
  id: 'experiment',
  initial: 'idle',
  context: {
    experiment: null,
    error: null,
    startedAt: null,
    completedAt: null,
    progress: 0,
  },
  states: {
    idle: {
      on: {
        QUEUE: { target: 'queued', actions: 'setExperiment' },
      },
    },
    queued: {
      on: {
        START: { target: 'running', actions: 'setRunning' },
        CANCEL: { target: 'cancelled' },
      },
    },
    running: {
      on: {
        PROGRESS: { actions: 'setProgress' },
        COMPLETE: { target: 'completed', actions: 'setCompleted' },
        FAIL: { target: 'failed', actions: 'setFailed' },
        CANCEL: { target: 'cancelled' },
      },
    },
    completed: {
      on: {
        RESET: { target: 'idle', actions: 'reset' },
      },
    },
    failed: {
      on: {
        RESET: { target: 'idle', actions: 'reset' },
        QUEUE: { target: 'queued', actions: 'setExperiment' },
      },
    },
    cancelled: {
      on: {
        RESET: { target: 'idle', actions: 'reset' },
      },
    },
  },
});

// ── Actor factory ───────────────────────────────────────────────────

/**
 * Create a running experiment actor.
 * Subscribe to state changes via `actor.subscribe(callback)`.
 *
 * ```ts
 * const actor = createExperimentActor();
 * actor.subscribe((state) => console.log(state.value, state.context));
 * actor.start();
 * actor.send({ type: 'QUEUE', experiment });
 * ```
 */
export function createExperimentActor() {
  return createActor(experimentMachine);
}

// ── Lattice renderer state machine ──────────────────────────────────

export type RendererStatus = 'detecting' | 'webgpu' | 'webgl2' | 'canvas' | 'static' | 'error';

export type RendererContext = {
  tier: RendererStatus;
  error: string | null;
  fps: number;
};

export type RendererEvent =
  | { type: 'DETECT'; tier: RendererStatus }
  | { type: 'FALLBACK' }
  | { type: 'FPS_UPDATE'; fps: number }
  | { type: 'ERROR'; error: string }
  | { type: 'RETRY' };

export const rendererMachine = setup({
  types: {
    context: {} as RendererContext,
    events: {} as RendererEvent,
  },
  actions: {
    setTier: assign(({ event }) => {
      if (event.type !== 'DETECT') return {};
      return { tier: event.tier, error: null };
    }),
    fallback: assign(({ context }) => {
      const order: RendererStatus[] = ['webgpu', 'webgl2', 'canvas', 'static'];
      const idx = order.indexOf(context.tier);
      const next = order[Math.min(idx + 1, order.length - 1)];
      return { tier: next };
    }),
    setFps: assign(({ event }) => {
      if (event.type !== 'FPS_UPDATE') return {};
      return { fps: event.fps };
    }),
    setError: assign(({ event }) => {
      if (event.type !== 'ERROR') return {};
      return { error: event.error };
    }),
  },
}).createMachine({
  id: 'renderer',
  initial: 'detecting',
  context: {
    tier: 'detecting',
    error: null,
    fps: 0,
  },
  states: {
    detecting: {
      on: {
        DETECT: { target: 'active', actions: 'setTier' },
        ERROR: { target: 'error', actions: 'setError' },
      },
    },
    active: {
      on: {
        FPS_UPDATE: { actions: 'setFps' },
        FALLBACK: { actions: 'fallback' },
        ERROR: { target: 'error', actions: 'setError' },
      },
    },
    error: {
      on: {
        RETRY: { target: 'detecting' },
        FALLBACK: { target: 'active', actions: 'fallback' },
      },
    },
  },
});

export function createRendererActor() {
  return createActor(rendererMachine);
}
