// fix-import-extensions.ts — Post-build import path fixer.
//
// tsc with moduleResolution: Bundler preserves extensionless relative
// imports (from './foo'). Node.js ESM requires explicit .js extensions.
//
// This script scans dist/** and rewrites relative import/export
// specifiers to include .js. It does NOT touch bare imports (package names).
//
// Zero dependencies — Node builtins only.
//
// Usage:
//   bun run scripts/fix-import-extensions.ts <dist-dir>
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { argv } from 'node:process';

// Match relative import/export specifiers without a file extension.
// Group 1: keyword + opening quote (e.g. from ' or import(")
// Group 2: the specifier path (e.g. ./foo or ../bar/baz)
// Group 3: closing quote
const RELATIVE_SPECIFIER = /(\bfrom\s+['"]|import\s*\(\s*['"])(\.\.?\/[^'"]+)(['"])/g;

// Extensions that are valid for ESM — don't double-fix.
const HAS_EXTENSION = /\.(js|mjs|cjs|json|node|wasm|css)$/;

function fixFile(filePath: string): number {
  const content = readFileSync(filePath, 'utf-8');
  let changes = 0;

  const fixed = content.replace(
    RELATIVE_SPECIFIER,
    (match, prefix: string, spec: string, quote: string) => {
      // Skip if already has an extension.
      if (HAS_EXTENSION.test(spec)) return match;
      // Skip CSS imports (they'll be handled by the bundler).
      if (spec.endsWith('.css')) return match;
      // Add .js extension.
      changes++;
      return `${prefix}${spec}.js${quote}`;
    },
  );

  if (changes > 0) {
    writeFileSync(filePath, fixed);
  }
  return changes;
}

function walk(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walk(full));
    } else if (full.endsWith('.js') || full.endsWith('.mjs')) {
      results.push(full);
    }
  }
  return results;
}

function main(): void {
  const distDir = argv[2];
  if (!distDir) {
    console.error('Usage: node fix-import-extensions.ts <dist-dir>');
    process.exit(1);
  }

  let totalFiles = 0;
  let totalChanges = 0;

  for (const file of walk(distDir)) {
    const changes = fixFile(file);
    if (changes > 0) {
      totalFiles++;
      totalChanges += changes;
    }
  }

  if (totalChanges > 0) {
    console.log(`  Fixed ${totalChanges} import path(s) in ${totalFiles} file(s).`);
  }
}

main();
