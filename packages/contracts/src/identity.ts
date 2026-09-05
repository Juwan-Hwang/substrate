/**
 * @substrate-platform/contracts — Identity & Operation Context Contracts.
 *
 * Single source of truth for platform administrative identity and operation context.
 */

/**
 * A resolved administrative identity — the answer to "who is making this request".
 * Carried into audit entries and operation contexts.
 */
export interface AdminIdentity {
  /** Who — a stable identifier for audit trails (e.g. 'admin', 'developer'). */
  readonly subject: string;
  /** How the identity was established (e.g. 'static-token', 'session-cookie', 'dev-trust'). */
  readonly mechanism: string;
  /** Authentication Methods References (e.g. 'pwd', 'fido2', 'hwk') indicating the factor used. */
  readonly amr?: string;
}

/**
 * Per-operation context propagated from route handlers into application services.
 * Used exclusively for audit trails and tracing. The domain never sees this.
 */
export interface OperationContext {
  /** The authenticated identity subject (from the auth guard). */
  readonly identity?: string;
  /** A route-generated operation id (used by operational endpoints). */
  readonly operationId?: string;
}

/**
 * Resolves the identity of an incoming request.
 * Returns `null` when the request cannot be authenticated — callers must treat that as "deny".
 * Implementations must never throw for ordinary unauthenticated requests.
 */
export interface AdminIdentityProvider {
  resolve(request: Request): Promise<AdminIdentity | null> | AdminIdentity | null;
}
