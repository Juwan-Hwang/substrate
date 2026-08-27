# Substrate Dual-Layer Authorization Architecture

> **Substrate Authorization** combines **Semantic Policy Evaluation** (for mutation actions and preflight validation) with **Query Constraint Pushdown** (for SQL, in-memory, and search index filtering).

---

## 1. Dual-Layer Model

```text
               Principal + Entity + Operation
                             │
            ┌────────────────┴────────────────┐
            │                                 │
            ▼                                 ▼
   Layer 1: Semantic Policy          Layer 2: Constraint Pushdown
   (AuthorizationPolicy)             (ConstraintCompiler)
   - Preflight Checks                - SQL WHERE clauses
   - In-Transaction Revalidation     - Orama Search filters
   - Fast Boolean Decision           - In-Memory Predicates
```

---

## 2. Authorization Policy (`AuthorizationPolicy`)

A pure async function that evaluates decisions based on caller principal, operation type (`create`, `read`, `update`, `delete`, `publish`, `transition`), and target entity:

```ts
export interface AuthorizationPolicy {
  decide(context: AuthorizationContext): Promise<AuthorizationDecision>;
}

export interface AuthorizationContext {
  readonly principal: Principal;
  readonly entityRef: EntityRef;
  readonly operation: AuthOperation;
  readonly targetLifecycleState?: string;
  readonly targetVisibility?: string;
}
```

---

## 3. Query Constraint Pushdown (`ConstraintCompiler`)

Instead of fetching un-authorized rows and filtering them in memory, Substrate compiles authorization rules into database-native constraints:

* **SQL Compiler**: generates parameterized `WHERE` clauses (e.g. `visibility = 'public' OR owner_id = $1`).
* **Search Privacy Gate**: ensures private documents are never leaked to client-side search bundles. `assertStaticIndexIsPublic()` throws `SearchPrivacyViolation` if non-public documents are added to static index bundles.
