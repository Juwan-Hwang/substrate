/**
 * Unit tests for @substrate-platform/observability — createLogger, LogEntry, Metric.
 */

import { describe, expect, it, vi } from 'vitest';
import { createLogger, type LogEntry, type Metric } from '../index';

// ── createLogger ────────────────────────────────────────────────────

describe('createLogger', () => {
  it('returns a logger with log and metric methods', () => {
    const logger = createLogger('graph');
    expect(typeof logger.log).toBe('function');
    expect(typeof logger.metric).toBe('function');
  });

  it('log routes error level to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger('content');
    const entry: LogEntry = {
      level: 'error',
      scope: 'content',
      message: 'Operation failed',
      timestamp: Date.now(),
    };
    logger.log(entry);
    expect(spy).toHaveBeenCalledWith('[content]', 'Operation failed', '');
    spy.mockRestore();
  });

  it('log routes warn level to console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createLogger('content');
    logger.log({
      level: 'warn',
      scope: 'content',
      message: 'Deprecated API',
      timestamp: Date.now(),
    });
    expect(spy).toHaveBeenCalledWith('[content]', 'Deprecated API', '');
    spy.mockRestore();
  });

  it('log routes info level to console.info', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = createLogger('graph');
    logger.log({
      level: 'info',
      scope: 'graph',
      message: 'Render started',
      timestamp: Date.now(),
    });
    expect(spy).toHaveBeenCalledWith('[graph]', 'Render started', '');
    spy.mockRestore();
  });

  it('log includes context when provided', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = createLogger('graph');
    const ctx = { fps: 60, nodes: 1024 };
    logger.log({
      level: 'info',
      scope: 'graph',
      message: 'Stats',
      timestamp: Date.now(),
      context: ctx,
    });
    expect(spy).toHaveBeenCalledWith('[graph]', 'Stats', ctx);
    spy.mockRestore();
  });

  it('log always tags the scope from the logger, not the entry', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = createLogger('graph');
    logger.log({
      level: 'info',
      scope: 'content',
      message: 'Should be tagged graph',
      timestamp: Date.now(),
    });
    expect(spy).toHaveBeenCalledWith('[graph]', 'Should be tagged graph', '');
    spy.mockRestore();
  });

  it('metric logs to console.debug', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = createLogger('content');
    const metric: Metric = {
      name: 'operation_duration',
      value: 1500,
      unit: 'ms',
      timestamp: Date.now(),
    };
    logger.metric(metric);
    expect(spy).toHaveBeenCalledWith('[metric:content]', 'operation_duration', 1500, 'ms', '');
    spy.mockRestore();
  });

  it('metric handles missing unit and tags', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = createLogger('content');
    logger.metric({
      name: 'page_views',
      value: 42,
      timestamp: Date.now(),
    });
    expect(spy).toHaveBeenCalledWith('[metric:content]', 'page_views', 42, '', '');
    spy.mockRestore();
  });

  it('metric includes tags when provided', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = createLogger('content');
    const tags = { route: '/content', method: 'GET' };
    logger.metric({
      name: 'response_time',
      value: 120,
      unit: 'ms',
      tags,
      timestamp: Date.now(),
    });
    expect(spy).toHaveBeenCalledWith('[metric:content]', 'response_time', 120, 'ms', tags);
    spy.mockRestore();
  });
});
