/**
 * Minimal structured logger for the edge runtime.
 *
 * `@substrate-platform/observability` targets the Node OpenTelemetry SDK and
 * cannot run inside the Cloudflare Workers runtime, so this lightweight
 * logger tags every line with `[edge:<component>]` and forwards
 * structured context to the console — a drop-in replacement for raw
 * `console.*` calls that keeps edge logs greppable and consistent.
 */
export type EdgeLogContext = Record<string, unknown>;

export interface EdgeLogger {
  error(message: string, context?: EdgeLogContext): void;
  warn(message: string, context?: EdgeLogContext): void;
  info(message: string, context?: EdgeLogContext): void;
}

/**
 * Create a component-scoped logger. The `component` is folded into the
 * tag (e.g. `createEdgeLogger('turnstile')` → `[edge:turnstile]`) so
 * logs stay attributable without ad-hoc string prefixes at call sites.
 */
export function createEdgeLogger(component: string): EdgeLogger {
  const tag = `[edge:${component}]`;
  return {
    error: (message, context) => console.error(tag, message, context ?? ''),
    warn: (message, context) => console.warn(tag, message, context ?? ''),
    info: (message, context) => console.info(tag, message, context ?? ''),
  };
}
