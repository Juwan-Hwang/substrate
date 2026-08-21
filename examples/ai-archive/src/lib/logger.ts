/**
 * Minimal structured logger for the AI Archive example.
 *
 * This example does not depend on `@substrate-platform/observability`, so we tag
 * console output with `[ai-archive:<component>]` and pass structured
 * context objects for consistent, greppable logs — a drop-in replacement
 * for raw `console.*` calls.
 */
export type ArchiveLogContext = Record<string, unknown>;

export interface ArchiveLogger {
  error(message: string, context?: ArchiveLogContext): void;
  warn(message: string, context?: ArchiveLogContext): void;
  info(message: string, context?: ArchiveLogContext): void;
}

/**
 * Create a component-scoped logger. The `component` is folded into the
 * tag (e.g. `createArchiveLogger('search')` → `[ai-archive:search]`).
 */
export function createArchiveLogger(component: string): ArchiveLogger {
  const tag = `[ai-archive:${component}]`;
  return {
    error: (message, context) => console.error(tag, message, context ?? ''),
    warn: (message, context) => console.warn(tag, message, context ?? ''),
    info: (message, context) => console.info(tag, message, context ?? ''),
  };
}
