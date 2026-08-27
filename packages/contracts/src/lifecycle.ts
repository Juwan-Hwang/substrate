/**
 * @substrate-platform/contracts/lifecycle — Lifecycle Primitive.
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

// ── Lifecycle Engine ───────────────────────────────────────────────

export interface LifecycleEngine<State extends string = string, Event extends string = string> {
  readonly definition: LifecycleDefinition<State, Event>;
  canTransition(current: State, event: Event): boolean;
  transition(current: State, event: Event): State | null;
  getAvailableEvents(current: State): readonly Event[];
}

/**
 * Create a validated LifecycleEngine instance.
 */
export function createLifecycleEngine<S extends string, E extends string>(
  def: LifecycleDefinition<S, E>,
): LifecycleEngine<S, E> {
  const validation = validateLifecycle(def);
  if (!validation.valid) {
    throw new Error(`Invalid LifecycleDefinition: ${validation.errors.join(', ')}`);
  }

  return {
    definition: def,
    canTransition(current: S, event: E): boolean {
      return resolveTransition(def, current, event) !== null;
    },
    transition(current: S, event: E): S | null {
      return resolveTransition(def, current, event);
    },
    getAvailableEvents(current: S): readonly E[] {
      return availableTransitions(def, current);
    },
  };
}
