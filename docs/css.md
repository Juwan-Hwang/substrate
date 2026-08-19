# CSS Package Boundary

Substrate defines a three-tier CSS contract. A consumer's `globals.css`
should look like:

```css
/* Tier 1: Tailwind v4 entry — processed by @tailwindcss/postcss */
@import "tailwindcss";

/* Tier 2: Platform design tokens + component styles */
@import "@substrate/ui/styles.css";

/* Tier 3: Tailwind theme bridge + platform utilities (optional) */
@import "@substrate/site/globals.css";

/* Application-specific tokens */
:root {
  --accent-primary: #your-brand-color;
  --bg-primary: #your-bg;
}
```

## Tier breakdown

| Tier | Package | What it provides | External deps |
|------|---------|-----------------|---------------|
| 1 | Application | `@import "tailwindcss"` | Resolved by consumer's PostCSS |
| 2 | `@substrate/ui` | `--substrate-*` tokens, `.substrate-*` components | Relative `@import` only |
| 3 | `@substrate/site` | `@theme` bridge, `.glass`, `.text-gradient`, paint worklets | None (no `@import "tailwindcss"`) |

## Why `@substrate/site/globals.css` does NOT `@import "tailwindcss"`

Turbopack resolves CSS `@import` from the source file's directory. If a
platform package contains `@import "tailwindcss"`, the resolver searches
`packages/site/node_modules/` — but `tailwindcss` is installed in the
consumer's `node_modules`, causing a build error. The Tailwind entry must
be declared by the consumer, where the PostCSS environment can resolve it.
