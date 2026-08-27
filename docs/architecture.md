# Substrate Platform Architecture

> **Substrate** is a generic Website Operating System and platform foundation designed for modern content, publication, and identity-driven websites.
> It provides reusable, domain-agnostic infrastructure without dictating specific application models or content taxonomies.

---

## 1. Platform vs Application Boundary

Substrate enforces a strict, unidirectional layered dependency model:

```text
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                    │
│   (e.g., Aevum, DemoDocs, Custom Sites, Examples)       │
│                      depends on ↓                       │
├─────────────────────────────────────────────────────────┤
│                     Platform Layer                      │
│   @substrate-platform/contracts   @substrate-platform/db│
│   @substrate-platform/content     @substrate-platform/site│
│   @substrate-platform/ui          @substrate-platform/ai│
│   @substrate-platform/observability                     │
│                      depends on ↓                       │
├─────────────────────────────────────────────────────────┤
│                   External Dependencies                 │
│   (PostgreSQL, Drizzle ORM, Orama, Next.js, Radix UI)   │
└─────────────────────────────────────────────────────────┘
```

### Invariants:
1. **Zero Domain Pollution in Platform**: The platform never imports from application namespaces and never hardcodes domain types (`writing`, `project`, `article`, `product`).
2. **Platform Provides Mechanisms; Application Provides Meanings**:
   - Platform provides `Entity<T>`, `ChangeSet`, `LifecycleEngine`, `two-phase publish protocol`, `AuthorizationPolicy`.
   - Application provides typed schemas (`Writing`, `Media`, `DocPage`), concrete lifecycle states (`draft` $\rightarrow$ `published`), and business authorization rules.

---

## 2. Platform Core Packages

| Package | Purpose | Dependencies |
| :--- | :--- | :--- |
| `@substrate-platform/contracts` | Zero-dependency type contracts, Zod schemas, state-machine engine, publish protocol, authorization interfaces. | `zod` |
| `@substrate-platform/db` | Generic PostgreSQL & Drizzle ORM persistence, `AsyncLocalStorage` transaction context, platform tables. | `drizzle-orm`, `postgres` |
| `@substrate-platform/content` | Content collections, Fumadocs MDX source loading, and Orama search index sync. | `fumadocs-core`, `@orama/orama` |
| `@substrate-platform/site` | Next.js layout shells, partial prerendering, and instrumentation bootstrap. | `next`, `react` |
| `@substrate-platform/ui` | Accessible UI component library and design tokens. | `@radix-ui/*`, `tailwindcss` |
| `@substrate-platform/observability` | OpenTelemetry, structured audit logging, performance telemetry. | `@opentelemetry/*` |

---

## 3. The Two-Phase Publish Protocol

All content publications follow an atomic two-phase protocol:

```text
Phase A (Advisory — Outside Transaction):
  1. Build ChangeSet
  2. Preflight Authorization check
  3. Generate Preview State
  4. Compute Public Impact Assessment
  5. User Confirms (Produces SHA-256 fingerprint)

Phase B (Binding — Inside Atomic Transaction):
  6. CAS pre-write (if external storage enabled)
  7. BEGIN TRANSACTION
  8. Lock affected entities (SELECT ... FOR UPDATE)
  9. Recompute projected state & public impact
 10. Verify confirmation fingerprint matches recomputed impact
 11. Revalidate authorization inside lock
 12. Commit current state writes
 13. Write snapshot reference
 14. COMMIT
```

---

## 4. Multi-Consumer Scalability

Substrate is designed so that multiple distinct websites (personal portfolios, documentation portals, e-commerce storefronts, developer blogs) can run on top of the same engine without modifying a single line of platform code.
