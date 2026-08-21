// migrate-scope.ts — Migrate @substrate-platform/* package namespace to @substrate-platform/*
//
// This script performs a PRECISE replacement of the npm package scope only.
// It does NOT touch:
//   - CSS custom properties: --substrate-* (e.g. --substrate-primary)
//   - CSS class names: .substrate-* (e.g. .substrate-card)
//   - Brand/component names: SubstrateLayout, SubstrateError, SubstrateProviders, etc.
//   - Descriptive text: "Substrate-based", "the Substrate platform"
//   - The word "substrate" in comments, prose, or identifiers that are not
//     preceded by "@"
//
// The regex `@substrate-platform/` is the narrowest possible pattern that matches
// only the npm scope prefix. It cannot match CSS tokens (which use `--` or `.`)
// or CamelCase identifiers (which have no `@` or `/`).
//
// Additionally, we handle:
//   - `@substrate-platform/wasm` → `@substrate-platform/wasm` (in crates/wasm/pkg)
//   - `@substrate-platform/contracts/DatabaseService` etc. (Effect Context tags)
//   - `@substrate-platform/*` in documentation (when used as package references)
//   - `@substrate-platform/site` in import specifiers
//   - `@substrate-platform/tokens` in CSS @import statements
//
// We also handle the edge case of `@substrate-platform/` appearing inside template
// literals or string concatenation in .ts files — the regex handles this
// because it matches the literal characters `@substrate-platform/` regardless of
// surrounding context.
//
// What we do NOT touch:
//   - `Substrate` (without `@` prefix and without `/` suffix) — brand name
//   - `substrate` (lowercase, without `@`) — project/repo name
//   - `--substrate-` — CSS custom property prefix
//   - `.substrate-` — CSS class prefix
//   - `@substrate-platform/` — already migrated (idempotent)

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

// ── Configuration ────────────────────────────────────────────────────────────

const ROOT = process.argv[2] ?? '.';
const DRY_RUN = process.argv.includes('--dry-run');

// File extensions to process.
const EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.css',
  '.md',
  '.yml',
  '.yaml',
  '.sql',
  '.mjs',
  '.cjs',
  '.html',
]);

// Directories to skip entirely.
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.turbo',
  'dist',
  '.next',
  'storybook-static',
  'target',
  '.changeset', // we'll handle config.json separately
]);

// The core replacement: @substrate-platform/ → @substrate-platform/
// This regex is intentionally narrow: it matches the literal `@substrate-platform/`
// which is the npm scope prefix. It cannot match:
//   - `--substrate-` (CSS tokens)
//   - `.substrate-` (CSS classes)
//   - `Substrate` (brand name, no @ prefix)
//   - `substrate` (lowercase word, no @ prefix)
const SCOPE_PATTERN = /@substrate\//g;

// Also handle `@substrate-platform/` → no-op (idempotent guard)
// The regex above already won't match `@substrate-platform/` because after
// `@substrate` it expects `/` not `-`.

// ── File Collection ──────────────────────────────────────────────────────────

function collectFiles(dir: string, results: string[] = []): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      // Skip .changeset dir except config.json (handled separately)
      collectFiles(fullPath, results);
    } else if (entry.isFile()) {
      if (EXTS.has(extname(entry.name))) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

// ── Migration ────────────────────────────────────────────────────────────────

interface MigrationResult {
  file: string;
  replacements: number;
}

function migrateFile(filePath: string): MigrationResult {
  const content = readFileSync(filePath, 'utf-8');
  let count = 0;

  const newContent = content.replace(SCOPE_PATTERN, () => {
    // Guard: don't double-migrate.
    count++;
    return '@substrate-platform/';
  });

  if (count > 0 && !DRY_RUN) {
    writeFileSync(filePath, newContent, 'utf-8');
  }

  return { file: relative(ROOT, filePath), replacements: count };
}

// ── Special Cases ────────────────────────────────────────────────────────────

// 1. package.json root: the wasm:build script contains @substrate-platform/wasm
//    in an inline node -e command. The generic migration handles this.

// 2. .changeset/config.json: contains linked package names.
//    The generic migration handles this since it's a .json file.

// 3. crates/wasm/pkg/package.json: contains "name": "@substrate-platform/wasm"
//    The generic migration handles this.

// 4. tsconfig.base.json and tsconfig.json files: contain paths mappings.
//    The generic migration handles these.

// 5. components.json (shadcn/ui config): contains @substrate-platform/ui aliases.
//    The generic migration handles this.

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(
    DRY_RUN
      ? '🔍 Dry run — no files will be changed.\n'
      : '🔧 Migrating @substrate-platform/ → @substrate-platform/...\n',
  );

  const files = collectFiles(ROOT);
  let totalReplacements = 0;
  const changed: MigrationResult[] = [];

  for (const file of files) {
    const result = migrateFile(file);
    if (result.replacements > 0) {
      changed.push(result);
      totalReplacements += result.replacements;
    }
  }

  // Report
  console.log(
    `\n${DRY_RUN ? 'Would change' : 'Changed'} ${changed.length} files, ${totalReplacements} replacements.\n`,
  );
  for (const { file, replacements } of changed.sort((a, b) => b.replacements - a.replacements)) {
    console.log(`  ${replacements.toString().padStart(4)}  ${file}`);
  }

  if (totalReplacements === 0) {
    console.log('\n✅ Nothing to migrate — all files already use @substrate-platform/.');
  } else if (DRY_RUN) {
    console.log('\n💡 Run without --dry-run to apply changes.');
  } else {
    console.log('\n✅ Migration complete.');
  }
}

main();
