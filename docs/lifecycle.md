# Substrate Declarative Lifecycle Engine

> The **Lifecycle Engine** is a generic, type-safe finite state machine provider that validates transitions, resolves target states, and verifies complete definition graphs without hardcoding any specific states.

---

## 1. Principles

1. **Zero Hardcoded States in Platform**:
   - The platform never assumes `draft`, `published`, `archived`, or `review` as default states.
   - States and events are defined strictly by the application via generic parameters `<State, Event>`.

2. **Compile-time & Runtime Validation**:
   - `validateLifecycle(definition)`: validates that initial state is in the state set, there are no duplicate states, and all transitions map to existing states.
   - `createLifecycleEngine(definition)`: builds an active engine instance offering `canTransition()`, `transition()`, and `getAvailableEvents()`.

---

## 2. Defining a Custom Lifecycle

```ts
import {
  type LifecycleDefinition,
  createLifecycleEngine,
} from '@substrate-platform/contracts';

type ArticleState = 'draft' | 'under_review' | 'published' | 'archived';
type ArticleEvent = 'submit_review' | 'publish' | 'archive' | 'revert';

const articleLifecycle: LifecycleDefinition<ArticleState, ArticleEvent> = {
  initial: 'draft',
  states: ['draft', 'under_review', 'published', 'archived'],
  transitions: {
    submit_review: ['draft', 'under_review'],
    publish: ['under_review', 'published'],
    archive: ['published', 'archived'],
    revert: ['under_review', 'draft'],
  },
};

const engine = createLifecycleEngine(articleLifecycle);

// Querying transitions
engine.canTransition('draft', 'submit_review'); // true
engine.canTransition('draft', 'publish');       // false (must be reviewed first)

// Executing transitions
const nextState = engine.transition('draft', 'submit_review'); // 'under_review'
```
