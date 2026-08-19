/**
 * Unit tests for @substrate/contracts — Zod schemas, Result helpers,
 * the tRPC appRouter, XState state machines, and Zustand vanilla stores.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appRouter, articleSchema, err, experimentSchema, ok } from '../index';
import { createExperimentActor, createRendererActor, type Experiment } from '../state-machine';
import { crucibleStore, latticeStore, uiStore } from '../store';

// ── Fixtures ──────────────────────────────────────────────────────────

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_DATETIME = '2024-01-15T12:30:00.000Z';

const validArticle = {
  id: VALID_UUID,
  slug: 'hello-world',
  title: 'Hello World',
  excerpt: 'A short summary.',
  tags: ['intro', 'demo'],
  date: VALID_DATETIME,
};

const validExperiment = {
  id: VALID_UUID,
  name: 'Particle Sim',
  subsystem: 'lattice',
  parameters: { iterations: '500', dt: '0.1' },
};

const sampleExperiment: Experiment = {
  id: 'exp-1',
  name: 'Sample',
  status: 'queued',
  parameters: { n: 1 },
};

// ── Zod: articleSchema ───────────────────────────────────────────────

describe('articleSchema', () => {
  it('parses a valid article', () => {
    const result = articleSchema.safeParse(validArticle);
    expect(result.success).toBe(true);
  });

  it('accepts an article without the optional excerpt', () => {
    const { excerpt: _excerpt, ...rest } = validArticle;
    const result = articleSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it('defaults tags to an empty array when omitted', () => {
    const { tags: _tags, ...rest } = validArticle;
    const parsed = articleSchema.parse(rest);
    expect(parsed.tags).toEqual([]);
  });

  it('rejects an invalid uuid', () => {
    const result = articleSchema.safeParse({ ...validArticle, id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing datetime', () => {
    const { date: _date, ...rest } = validArticle;
    const result = articleSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects a title exceeding 120 characters', () => {
    const result = articleSchema.safeParse({ ...validArticle, title: 'x'.repeat(121) });
    expect(result.success).toBe(false);
  });

  it('rejects a non-datetime string for date', () => {
    const result = articleSchema.safeParse({ ...validArticle, date: '2024-01-15' });
    expect(result.success).toBe(false);
  });
});

// ── Zod: experimentSchema ────────────────────────────────────────────

describe('experimentSchema', () => {
  it('parses a valid experiment', () => {
    const result = experimentSchema.safeParse(validExperiment);
    expect(result.success).toBe(true);
  });

  it('accepts optional result and durationMs', () => {
    const result = experimentSchema.safeParse({
      ...validExperiment,
      result: { output: 42 },
      durationMs: 1500,
    });
    expect(result.success).toBe(true);
  });

  it('accepts any string as subsystem', () => {
    const result = experimentSchema.safeParse({
      ...validExperiment,
      subsystem: 'custom-subsystem',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-positive durationMs', () => {
    const result = experimentSchema.safeParse({ ...validExperiment, durationMs: -5 });
    expect(result.success).toBe(false);
  });

  it('rejects a missing name', () => {
    const { name: _name, ...rest } = validExperiment;
    const result = experimentSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects non-string parameter values', () => {
    const result = experimentSchema.safeParse({
      ...validExperiment,
      parameters: { count: 500 },
    });
    expect(result.success).toBe(false);
  });
});

// ── Result helpers ───────────────────────────────────────────────────

describe('Result helpers', () => {
  it('ok() returns a success Result wrapping the value', () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('err() returns an error Result wrapping the error', () => {
    const result = err(new Error('boom'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('boom');
    }
  });

  it('ok() and err() are discriminated by the `ok` flag', () => {
    const success = ok('yes');
    const failure = err('no');
    if (success.ok) {
      expect(success.value).toBe('yes');
    } else {
      throw new Error('should be a success');
    }
    if (!failure.ok) {
      expect(failure.error).toBe('no');
    } else {
      throw new Error('should be a failure');
    }
  });
});

// ── tRPC appRouter ───────────────────────────────────────────────────

describe('appRouter', () => {
  it('exposes a working health procedure', async () => {
    const caller = appRouter.createCaller({});
    const result = await caller.health();
    expect(result).toEqual({ status: 'ok' });
  });

  it('exposes an articles procedure that echoes the requested slug', async () => {
    const caller = appRouter.createCaller({});
    const result = await caller.articles({ slug: 'hello-world' });
    expect(result).toEqual({ slug: 'hello-world', title: '', body: '' });
  });

  it('rejects articles input missing the slug', async () => {
    const caller = appRouter.createCaller({});
    await expect(caller.articles({} as { slug: string })).rejects.toBeDefined();
  });
});

// ── XState: experimentMachine ────────────────────────────────────────

describe('experimentMachine', () => {
  it('starts in the idle state', () => {
    const actor = createExperimentActor();
    actor.start();
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('transitions idle → queued → running → completed', () => {
    const actor = createExperimentActor();
    actor.start();

    actor.send({ type: 'QUEUE', experiment: sampleExperiment });
    expect(actor.getSnapshot().value).toBe('queued');

    actor.send({ type: 'START' });
    expect(actor.getSnapshot().value).toBe('running');
    expect(actor.getSnapshot().context.startedAt).not.toBeNull();

    actor.send({ type: 'COMPLETE', result: { output: 42 } });
    expect(actor.getSnapshot().value).toBe('completed');
    expect(actor.getSnapshot().context.progress).toBe(1);
    expect(actor.getSnapshot().context.completedAt).not.toBeNull();
    actor.stop();
  });

  it('transitions idle → queued → cancelled', () => {
    const actor = createExperimentActor();
    actor.start();

    actor.send({ type: 'QUEUE', experiment: sampleExperiment });
    expect(actor.getSnapshot().value).toBe('queued');

    actor.send({ type: 'CANCEL' });
    expect(actor.getSnapshot().value).toBe('cancelled');
    actor.stop();
  });

  it('transitions running → failed on FAIL', () => {
    const actor = createExperimentActor();
    actor.start();

    actor.send({ type: 'QUEUE', experiment: sampleExperiment });
    actor.send({ type: 'START' });
    actor.send({ type: 'FAIL', error: 'something broke' });

    expect(actor.getSnapshot().value).toBe('failed');
    expect(actor.getSnapshot().context.error).toBe('something broke');
    actor.stop();
  });

  it('records progress while running without leaving the state', () => {
    const actor = createExperimentActor();
    actor.start();

    actor.send({ type: 'QUEUE', experiment: sampleExperiment });
    actor.send({ type: 'START' });
    actor.send({ type: 'PROGRESS', progress: 0.5 });

    expect(actor.getSnapshot().value).toBe('running');
    expect(actor.getSnapshot().context.progress).toBe(0.5);
    actor.stop();
  });

  it('can be cancelled while running', () => {
    const actor = createExperimentActor();
    actor.start();

    actor.send({ type: 'QUEUE', experiment: sampleExperiment });
    actor.send({ type: 'START' });
    actor.send({ type: 'CANCEL' });

    expect(actor.getSnapshot().value).toBe('cancelled');
    actor.stop();
  });

  it('resets from a terminal state back to idle', () => {
    const actor = createExperimentActor();
    actor.start();

    actor.send({ type: 'QUEUE', experiment: sampleExperiment });
    actor.send({ type: 'START' });
    actor.send({ type: 'COMPLETE', result: {} });
    actor.send({ type: 'RESET' });

    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.experiment).toBeNull();
    actor.stop();
  });
});

// ── XState: rendererMachine ──────────────────────────────────────────

describe('rendererMachine', () => {
  it('starts in the detecting state', () => {
    const actor = createRendererActor();
    actor.start();
    expect(actor.getSnapshot().value).toBe('detecting');
    actor.stop();
  });

  it('transitions detecting → active on DETECT', () => {
    const actor = createRendererActor();
    actor.start();

    actor.send({ type: 'DETECT', tier: 'webgpu' });
    expect(actor.getSnapshot().value).toBe('active');
    expect(actor.getSnapshot().context.tier).toBe('webgpu');
    expect(actor.getSnapshot().context.error).toBeNull();
    actor.stop();
  });

  it('transitions detecting → error on ERROR', () => {
    const actor = createRendererActor();
    actor.start();

    actor.send({ type: 'ERROR', error: 'no gpu' });
    expect(actor.getSnapshot().value).toBe('error');
    expect(actor.getSnapshot().context.error).toBe('no gpu');
    actor.stop();
  });

  it('transitions active → error on ERROR', () => {
    const actor = createRendererActor();
    actor.start();

    actor.send({ type: 'DETECT', tier: 'webgl2' });
    expect(actor.getSnapshot().value).toBe('active');

    actor.send({ type: 'ERROR', error: 'context lost' });
    expect(actor.getSnapshot().value).toBe('error');
    actor.stop();
  });

  it('updates fps while active', () => {
    const actor = createRendererActor();
    actor.start();

    actor.send({ type: 'DETECT', tier: 'webgpu' });
    actor.send({ type: 'FPS_UPDATE', fps: 60 });

    expect(actor.getSnapshot().context.fps).toBe(60);
    actor.stop();
  });

  it('retries from error back to detecting', () => {
    const actor = createRendererActor();
    actor.start();

    actor.send({ type: 'ERROR', error: 'boom' });
    actor.send({ type: 'RETRY' });

    expect(actor.getSnapshot().value).toBe('detecting');
    actor.stop();
  });
});

// ── Zustand: uiStore ─────────────────────────────────────────────────

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

// ── Zustand: latticeStore ────────────────────────────────────────────

describe('latticeStore', () => {
  beforeEach(() => {
    latticeStore.setState({
      rendererTier: 'webgpu',
      selectedNodeId: null,
      layoutIterations: 500,
      dt: 0.1,
      showLabels: true,
      showEdges: true,
      fps: 0,
    });
  });

  it('setRendererTier updates the tier', () => {
    latticeStore.getState().setRendererTier('canvas');
    expect(latticeStore.getState().rendererTier).toBe('canvas');
  });

  it('selectNode sets and clears the selected node', () => {
    latticeStore.getState().selectNode('node-42');
    expect(latticeStore.getState().selectedNodeId).toBe('node-42');
    latticeStore.getState().selectNode(null);
    expect(latticeStore.getState().selectedNodeId).toBeNull();
  });

  it('toggleLabels flips the showLabels flag', () => {
    expect(latticeStore.getState().showLabels).toBe(true);
    latticeStore.getState().toggleLabels();
    expect(latticeStore.getState().showLabels).toBe(false);
    latticeStore.getState().toggleLabels();
    expect(latticeStore.getState().showLabels).toBe(true);
  });
});

// ── Zustand: crucibleStore ───────────────────────────────────────────

describe('crucibleStore', () => {
  beforeEach(() => {
    crucibleStore.setState({
      experiments: [],
      filter: 'all',
      currentExperimentId: null,
    });
  });

  it('addExperiment prepends to the experiment list', () => {
    crucibleStore.getState().addExperiment({
      id: 'e1',
      name: 'First',
      subsystem: 'lattice',
      status: 'queued',
      createdAt: 1,
    });
    crucibleStore.getState().addExperiment({
      id: 'e2',
      name: 'Second',
      subsystem: 'crucible',
      status: 'queued',
      createdAt: 2,
    });

    const list = crucibleStore.getState().experiments;
    expect(list).toHaveLength(2);
    expect(list[0]?.id).toBe('e2'); // most recent first
    expect(list[1]?.id).toBe('e1');
  });

  it('updateExperimentStatus updates the matching experiment only', () => {
    crucibleStore.getState().addExperiment({
      id: 'e1',
      name: 'A',
      subsystem: 'lattice',
      status: 'queued',
      createdAt: 1,
    });
    crucibleStore.getState().addExperiment({
      id: 'e2',
      name: 'B',
      subsystem: 'crucible',
      status: 'running',
      createdAt: 2,
    });

    crucibleStore.getState().updateExperimentStatus('e1', 'completed');

    const list = crucibleStore.getState().experiments;
    expect(list.find((e) => e.id === 'e1')?.status).toBe('completed');
    expect(list.find((e) => e.id === 'e2')?.status).toBe('running');
  });

  it('setFilter updates the active filter', () => {
    crucibleStore.getState().setFilter('lattice');
    expect(crucibleStore.getState().filter).toBe('lattice');
    crucibleStore.getState().setFilter('archive');
    expect(crucibleStore.getState().filter).toBe('archive');
  });
});
