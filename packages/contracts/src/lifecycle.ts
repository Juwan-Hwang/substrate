/**
 * @substrate/contracts/lifecycle — Lifecycle Primitive.
 *
 * The platform provides the *mechanism*: a generic state-machine
 * definition with transitions keyed by event. The application supplies
 * the *values*: concrete state names ('draft', 'published', etc.) and
 * event names.
 *
 * The platform NEVER imports or hardcodes any lifecycle state name.
 * See: architecture-contract-v1.3.md §2.1.
 */

// ── Lifecycle Definition ───────────────────────────────────────────

/**
 * A declarative state-machine definition.
 *
 * The application creates a `LifecycleDefinition<string, string>` with
 * its own state and event names. The platform validates transitions
 * against this definition at runtime.
 *
 * @example
 * ```typescript
 * const myLifecycle: LifecycleDefinition<string, string> = {
 *   initial: 'draft',
 *   states: ['draft', 'published'] as const,
 *   transitions: {
 *     publish: ['draft', 'published'] as const,
 *     unpublish: ['published', 'draft'] as const,
 *   },
 * };
 * ```
 */
export interface LifecycleDefinition<State extends string = string, Event extends string = string> {
  /** The initial state a new entity occupies. */
  readonly initial: State;
  /** Every state this lifecycle can occupy. */
  readonly states: readonly State[];
  /** Allowed transitions keyed by event. Each value is [from, to]. */
  readonly transitions: Readonly<Record<Event, readonly [from: State, to: State]>>;
}

// ── Validation ─────────────────────────────────────────────────────

/**
 * Result of validating a lifecycle definition for internal consistency.
 */
export interface LifecycleValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validate that a LifecycleDefinition is internally consistent:
 *
 * 1. `initial` is in `states`.
 * 2. Every transition's `from` and `to` are in `states`.
 * 3. No duplicate states.
 * 4. At least one state exists.
 *
 * This is a pure function — no side effects, no I/O.
 */
export function validateLifecycle<S extends string, E extends string>(
  def: LifecycleDefinition<S, E>,
): LifecycleValidationResult {
  const errors: string[] = [];

  if (def.states.length === 0) {
    errors.push('LifecycleDefinition must have at least one state.');
  }

  const stateSet = new Set(def.states);
  if (def.states.length !== stateSet.size) {
    errors.push('LifecycleDefinition has duplicate states.');
  }

  if (!stateSet.has(def.initial)) {
    errors.push(`Initial state "${def.initial}" is not in states.`);
  }

  const entries = Object.entries(def.transitions) as unknown as ReadonlyArray<
    readonly [E, readonly [S, S]]
  >;
  for (const [event, [from, to]] of entries) {
    if (!stateSet.has(from)) {
      errors.push(`Transition "${event}": from-state "${from}" is not in states.`);
    }
    if (!stateSet.has(to)) {
      errors.push(`Transition "${event}": to-state "${to}" is not in states.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Resolve the target state for a given event from a given current state.
 *
 * Returns `null` if the transition is not defined or the current state
 * does not match the transition's `from`.
 *
 * Pure function — no side effects.
 */
export function resolveTransition<S extends string, E extends string>(
  def: LifecycleDefinition<S, E>,
  current: S,
  event: E,
): S | null {
  const transition = def.transitions[event];
  if (!transition) return null;
  const [from, to] = transition;
  return from === current ? to : null;
}

/**
 * Returns all events that can be fired from the given state.
 *
 * Pure function — no side effects.
 */
export function availableTransitions<S extends string, E extends string>(
  def: LifecycleDefinition<S, E>,
  current: S,
): readonly E[] {
  const entries = Object.entries(def.transitions) as unknown as ReadonlyArray<
    readonly [E, readonly [S, S]]
  >;
  return entries.filter(([, [from]]) => from === current).map(([event]) => event);
}
