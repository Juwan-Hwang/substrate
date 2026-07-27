/**
 * Unit tests for @substrate/observability — createLogger, LogEntry, Metric.
 */

import { describe, expect, it, vi } from 'vitest';
import { createLogger, type LogEntry, type Metric } from '../index';

// ── createLogger ────────────────────────────────────────────────────

describe('createLogger', () => {
  it('returns a logger with log and metric methods', () => {
    const logger = createLogger('Lattice');
    expect(typeof logger.log).toBe('function');
    expect(typeof logger.metric).toBe('function');
  });

  it('log routes error level to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger('Crucible');
    const entry: LogEntry = {
      level: 'error',
      subsystem: 'Crucible',
      message: 'Experiment failed',
      timestamp: Date.now(),
    };
    logger.log(entry);
    expect(spy).toHaveBeenCalledWith('[Crucible]', 'Experiment failed', '');
    spy.mockRestore();
  });

  it('log routes warn level to console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createLogger('Archive');
    logger.log({
      level: 'warn',
      subsystem: 'Archive',
      message: 'Deprecated API',
      timestamp: Date.now(),
    });
    expect(spy).toHaveBeenCalledWith('[Archive]', 'Deprecated API', '');
    spy.mockRestore();
  });

  it('log routes info level to console.info', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = createLogger('Lattice');
    logger.log({
      level: 'info',
      subsystem: 'Lattice',
      message: 'Render started',
      timestamp: Date.now(),
    });
    expect(spy).toHaveBeenCalledWith('[Lattice]', 'Render started', '');
    spy.mockRestore();
  });

  it('log includes context when provided', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = createLogger('Lattice');
    const ctx = { fps: 60, nodes: 1024 };
    logger.log({
      level: 'info',
      subsystem: 'Lattice',
      message: 'Stats',
      timestamp: Date.now(),
      context: ctx,
    });
    expect(spy).toHaveBeenCalledWith('[Lattice]', 'Stats', ctx);
    spy.mockRestore();
  });

  it('log always tags the subsystem from the logger, not the entry', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = createLogger('Lattice');
    logger.log({
      level: 'info',
      subsystem: 'Crucible' as never, // wrong subsystem in entry
      message: 'Should be tagged Lattice',
      timestamp: Date.now(),
    });
    expect(spy).toHaveBeenCalledWith('[Lattice]', 'Should be tagged Lattice', '');
    spy.mockRestore();
  });

  it('metric logs to console.debug', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = createLogger('Crucible');
    const metric: Metric = {
      name: 'experiment_duration',
      value: 1500,
      unit: 'ms',
      timestamp: Date.now(),
    };
    logger.metric(metric);
    expect(spy).toHaveBeenCalledWith('[metric:Crucible]', 'experiment_duration', 1500, 'ms', '');
    spy.mockRestore();
  });

  it('metric handles missing unit and tags', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = createLogger('Archive');
    logger.metric({
      name: 'page_views',
      value: 42,
      timestamp: Date.now(),
    });
    expect(spy).toHaveBeenCalledWith('[metric:Archive]', 'page_views', 42, '', '');
    spy.mockRestore();
  });

  it('metric includes tags when provided', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = createLogger('Archive');
    const tags = { route: '/articles', method: 'GET' };
    logger.metric({
      name: 'response_time',
      value: 120,
      unit: 'ms',
      tags,
      timestamp: Date.now(),
    });
    expect(spy).toHaveBeenCalledWith('[metric:Archive]', 'response_time', 120, 'ms', tags);
    spy.mockRestore();
  });
});
