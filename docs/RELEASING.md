# Releasing Substrate Packages

Substrate uses [Changesets](https://github.com/changesets/changesets) for
version management and GitHub Actions for automated publishing to npm via
[Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC).

---

## Release Pipeline

```text
Changeset (.changeset/*.md)
    ↓
GitHub Actions (workflow_dispatch)
    ↓
Changesets prerelease (canary) or stable (latest)
    ↓
npm Trusted Publishing (OIDC, no long-lived tokens)
    ↓
npm Registry (@substrate-platform/*)
```

---

## Channels

| Channel | Tag | When | Provenance |
|---------|-----|------|------------|
| Canary | `@canary` | Bleeding-edge, manual dispatch | Yes (`--provenance`) |
| Stable | `@latest` | Production release | Yes (`--provenance`) |

Install from a specific channel:

```bash
npm install @substrate-platform/site@canary
npm install @substrate-platform/site@latest
```

---

## Publishing via GitHub Actions

1. **Add a changeset** describing the version bump:

   ```bash
   bunx changeset
   ```

   This creates a `.changeset/*.md` file with the package(s) and bump type
   (`patch`, `minor`, or `major`).

2. **Commit the changeset** and push to `main`.

3. **Trigger the workflow**:
   - Go to Actions → "Publish npm" → "Run workflow"
   - Select channel: `canary` or `latest`
   - Click "Run workflow"

4. **The workflow**:
   - Enters Changesets prerelease mode (canary only)
   - Runs `changeset version` (bumps all linked packages)
   - Replaces `workspace:*` with semver ranges
   - Publishes in topological order (12 packages, Layer 0 → 3)
   - Exits prerelease mode
   - Pushes version commits back to `main`

---

## Trusted Publishing Setup

npm Trusted Publishing uses GitHub Actions OIDC tokens — no `NPM_TOKEN`
secret needed. Configure **once per package** on npmjs.com:

For each of the 12 `@substrate-platform/*` packages:

1. Go to the package page → **Settings** → **Trusted Publishing**
2. Add a trusted publisher with exactly:
   - **Repository:** `Juwan-Hwang/substrate`
   - **Workflow:** `.github/workflows/publish-npm.yml`
   - **Environment:** (leave blank)
3. Enable "Publish provenance" for SLSA provenance.

If any value doesn't match exactly, the OIDC exchange will fail.

---

## Topological Publish Order

Packages are published in dependency order to ensure consumers can resolve
transitive dependencies immediately:

```text
Layer 0: contracts, config, tokens        (no internal deps)
Layer 1: wasm                               (no internal deps)
Layer 2: ui, content, db, observability     (depend on Layer 0)
Layer 3: edge, ai, site, graphics           (depend on Layer 0–2)
```

**Critical:** `@substrate-platform/wasm` must be published before
`@substrate-platform/graphics` — graphics depends on wasm at runtime.

---

## Linked Group

All 12 packages are in a Changesets `linked` group (see
`.changeset/config.json`). This ensures version coordination: when any
package is bumped, all linked packages receive the same version. This
guarantees a consistent release set — no package is left at a stale
version while its dependencies move forward.

---

## First Bootstrap (completed)

The first canary release (`0.2.0-canary.0`) was published manually from
a local machine using a one-time `bootstrap-npm-canary.ts` script. That
script has been deleted — subsequent releases must use the GitHub Actions
workflow with Trusted Publishing.
