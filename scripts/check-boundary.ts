#!/usr/bin/env bun
/**
 * check-boundary.ts — Platform boundary enforcement CI gate (v1.3).
 *
 * Three-layer analysis (see architecture-contract-v1.3.md S13):
 *
 *   Layer 1: Import Graph (primary gate)
 *     No platform package (packages/&#42;/src/) imports from
 *     aevum/, examples/, or any application namespace.
 *     This is the core boundary proof.
 *
 *   Layer 1.5: Search Privacy Gate (S13.3 CI Gate #2)
 *     Files under examples/&#42;/src/app/&#42;&#42; that import a client-side
 *     search library must NOT also import auth-related modules.
 *
 *   Layer 2: Pattern Scan (secondary lint)
 *     Catches application-specific identifiers (brand names,
 *     person identifiers, CSS prefixes, credentials).
 *     NOT the core boundary proof.
 *
 * Usage:
 *   bun run scripts/check-boundary.ts        # CI mode
 *   bun boundary:check                        # via package.json script
 *
 * Zero external dependencies — uses only Node/Bun builtins.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { argv, cwd, exit } from 'node:process';

// ── Types ───────────────────────────────────────────────────────────

type PatternViolation = {
  file: string;
  line: number;
  col: number;
  pattern: string;
  match: string;
  context: string;
};

type ImportViolation = {
  file: string;
  importPath: string;
  line: number;
  message: string;
};

type SearchPrivacyViolation = {
  file: string;
  importPath: string;
  line: number;
  message: string;
};

// ── Excluded paths ──────────────────────────────────────────────────

const EXCLUDED_DIRS = new Set([
  'node_modules', '.next', '.turbo', '.git', 'dist', 'target', 'storybook-static', '.cache',
]);

const EXCLUDED_FILES = new Set([
  'PLATFORM_BOUNDARY.md', 'check-boundary.ts', 'bun.lock', 'bun.lockb', '.gitignore', '.editorconfig',
]);

const EXCLUDED_PATH_PREFIXES = ['crates/wasm/pkg'];

const SCANNABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.jsonc', '.css', '.scss', '.md', '.mdx',
  '.html', '.htm', '.yaml', '.yml', '.toml', '.rs',
  '.env', '.env.example', '.env.local', '.sh', '.bash', '.sql', '.txt',
]);

function shouldExclude(filePath: string): boolean {
  const rel = relative(cwd(), filePath).replace(/\\/g, '/');

  for (const prefix of EXCLUDED_PATH_PREFIXES) {
    if (rel.startsWith(prefix)) return true;
  }

  const parts = rel.split('/');
  for (const part of parts) {
    if (EXCLUDED_DIRS.has(part)) return true;
  }

  const basename = parts[parts.length - 1] ?? '';
  if (EXCLUDED_FILES.has(basename)) return true;

  if (basename.startsWith('.env')) return false;

  const lastDot = basename.lastIndexOf('.');
  if (lastDot === -1) return true;
  const ext = basename.slice(lastDot);
  return !SCANNABLE_EXTENSIONS.has(ext);
}

// ── Import extraction ───────────────────────────────────────────────

function extractImports(
  content: string,
): Array<{ path: string; line: number }> {
  const imports: Array<{ path: string; line: number }> = [];
  const lines = content.split('\n');

  const importRegex =
    /(?:import\s[^;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

  for (let i = 0; i < lines.length; i++) {
    let match: RegExpExecArray | null;
    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(lines[i])) !== null) {
      const importPath = match[1] || match[2] || match[3];
      if (importPath) {
        imports.push({ path: importPath, line: i + 1 });
      }
    }
  }

  return imports;
}

// ═══════════════════════════════════════════════════════════════════
// Layer 1: Import Graph Analysis (PRIMARY GATE)
// ═══════════════════════════════════════════════════════════════════

const FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [
  /(?:^|\/)aevum\//,
  /(?:^|\/)aevum-/,
  /^@aevum\//,
  /(?:^|\/)examples\//,
];

const PLATFORM_DIRS: readonly string[] = [
  'packages/contracts/src',
  'packages/db/src',
  'packages/config/src',
  'packages/auth/src',
  'packages/edge/src',
  'packages/ai/src',
  'packages/graphics/src',
  'packages/observability/src',
  'packages/site/src',
  'packages/ui/src',
  'packages/content/src',
  'packages/tokens/src',
];

function isPlatformFile(filePath: string): boolean {
  const rel = relative(cwd(), filePath).replace(/\\/g, '/');
  return PLATFORM_DIRS.some((dir) => rel.startsWith(dir));
}

function checkImports(filePath: string): ImportViolation[] {
  const violations: ImportViolation[] = [];

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return violations;
  }

  const imports = extractImports(content);
  for (const { path: importPath, line } of imports) {
    for (const forbidden of FORBIDDEN_IMPORT_PATTERNS) {
      if (forbidden.test(importPath)) {
        violations.push({
          file: relative(cwd(), filePath).replace(/\\/g, '/'),
          importPath,
          line,
          message: `Layer 1 import graph violation: platform file imports from application namespace "${importPath}" (S13.1)`,
        });
        break;
      }
    }
  }

  return violations;
}

function scanImportGraph(root: string): ImportViolation[] {
  const violations: ImportViolation[] = [];

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);

      if (shouldExclude(fullPath)) continue;

      let stat: ReturnType<typeof statSync>;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile() && isPlatformFile(fullPath)) {
        violations.push(...checkImports(fullPath));
      }
    }
  }

  walk(root);
  return violations;
}

// ═══════════════════════════════════════════════════════════════════
// Layer 1.5: Search Privacy Gate (S13.3 CI Gate #2)
// ═══════════════════════════════════════════════════════════════════

/**
 * Client-side search library import patterns.
 * Files under examples/&#42;/src/app/&#42;&#42; that import these must NOT
 * also import auth-related modules (S13.3 CI Gate #2).
 */
const CLIENT_SEARCH_IMPORT_PATTERNS: RegExp[] = [
  /@orama\//,
  /@orama\b/,
  /orama$/,
  /\.orama$/,
  /fuse\.js$/,
  /minisearch/,
  /flexsearch/,
  /lunr$/,
];

/**
 * Auth-related module import patterns.
 */
const AUTH_IMPORT_PATTERNS: RegExp[] = [
  /@substrate\/auth/,
  /better-auth/,
  /next-auth/,
  /lucia/,
  /@auth\//,
  /clerk/,
];

function isAppRouteFile(filePath: string): boolean {
  const rel = relative(cwd(), filePath).replace(/\\/g, '/');
  return /(?:^|\/)examples\/[^/]+\/src\/app\//.test(rel);
}

function checkSearchPrivacy(filePath: string): SearchPrivacyViolation[] {
  const violations: SearchPrivacyViolation[] = [];

  if (!isAppRouteFile(filePath)) return violations;

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return violations;
  }

  const imports = extractImports(content);
  const hasSearchImport = imports.some(({ path }) =>
    CLIENT_SEARCH_IMPORT_PATTERNS.some((p) => p.test(path)),
  );
  const hasAuthImport = imports.some(({ path }) =>
    AUTH_IMPORT_PATTERNS.some((p) => p.test(path)),
  );

  if (hasSearchImport && hasAuthImport) {
    const searchImport = imports.find(({ path }) =>
      CLIENT_SEARCH_IMPORT_PATTERNS.some((p) => p.test(path)),
    );
    if (searchImport) {
      violations.push({
        file: relative(cwd(), filePath).replace(/\\/g, '/'),
        importPath: searchImport.path,
        line: searchImport.line,
        message: `Search privacy violation: file imports both client-side search library and auth module (S13.3 Gate #2, S6.1)`,
      });
    }
  }

  return violations;
}

function scanSearchPrivacy(root: string): SearchPrivacyViolation[] {
  const violations: SearchPrivacyViolation[] = [];

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);

      if (shouldExclude(fullPath)) continue;

      let stat: ReturnType<typeof statSync>;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile() && isAppRouteFile(fullPath)) {
        violations.push(...checkSearchPrivacy(fullPath));
      }
    }
  }

  walk(root);
  return violations;
}

// ═══════════════════════════════════════════════════════════════════
// Layer 2: Pattern Scan (SECONDARY LINT)
// ═══════════════════════════════════════════════════════════════════

const PATTERNS: Array<{ regex: RegExp; message: string }> = [
  {
    regex: /\b[Aa]evum\b|\bAEVUM\b/g,
    message: 'Application-specific brand name "Aevum" in platform code',
  },
  { regex: /aevum\.dev/g, message: 'Application-specific URL "aevum.dev"' },
  { regex: /api\.aevum\.dev/g, message: 'Application-specific API URL "api.aevum.dev"' },
  { regex: /aevum-edge/g, message: 'Application-specific infrastructure resource "aevum-edge"' },
  { regex: /aevum-assets/g, message: 'Application-specific infrastructure resource "aevum-assets"' },
  { regex: /aevum-tasks/g, message: 'Application-specific infrastructure resource "aevum-tasks"' },
  { regex: /aevum-web/g, message: 'Application-specific service name "aevum-web"' },
  { regex: /\bSITE_BRAND\b/g, message: 'Hardcoded brand constant "SITE_BRAND" — replaced by SiteIdentity' },
  { regex: /\bSUBSYSTEMS\b/g, message: 'Hardcoded subsystem list "SUBSYSTEMS" — application-specific' },
  { regex: /\bJuwan\b/g, message: 'Person identifier "Juwan" in platform code' },
  { regex: /\bjuwanh\b/gi, message: 'Person identifier "juwanh" in platform code' },
  { regex: /--aevum-/g, message: 'Application-specific CSS variable prefix "--aevum-"' },
  { regex: /\.aevum-/g, message: 'Application-specific CSS class prefix ".aevum-"' },
  { regex: /\b(sk-|pk-|key_)[A-Za-z0-9]{20,}\b/g, message: 'Possible API key or secret — credential in platform code' },
  {
    regex: /\b(AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/g,
    message: 'Possible AWS access key ID',
  },
];

const LINE_EXCLUSIONS: RegExp[] = [
  /(?:https?:\/\/)?(?:www\.)?(?:github|gitlab|bitbucket)\.com\/[A-Za-z0-9_-]+/i,
  /"(?:author|repository|contributors|maintainers)"\s*:/,
  /(?:repository|authors)\s*[:=]/,
];

function scanFilePatterns(filePath: string): PatternViolation[] {
  const violations: PatternViolation[] = [];

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return violations;
  }

  const lines = content.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    const isExcludedLine = LINE_EXCLUSIONS.some((re) => re.test(line));
    if (isExcludedLine) continue;

    for (const { regex, message } of PATTERNS) {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(line)) !== null) {
        const context = line.trim().slice(0, 120);
        violations.push({
          file: relative(cwd(), filePath).replace(/\\/g, '/'),
          line: lineIdx + 1,
          col: match.index + 1,
          pattern: message,
          match: match[0],
          context,
        });
      }
    }
  }

  return violations;
}

function scanPatterns(dir: string): PatternViolation[] {
  const violations: PatternViolation[] = [];

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return violations;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    if (shouldExclude(fullPath)) continue;

    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      violations.push(...scanPatterns(fullPath));
    } else if (stat.isFile()) {
      violations.push(...scanFilePatterns(fullPath));
    }
  }

  return violations;
}

// ── Main ────────────────────────────────────────────────────────────

function main(): void {
  const root = argv[2] ?? cwd();

  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
check-boundary — platform boundary enforcement gate (v1.3)

Usage:
  bun run scripts/check-boundary.ts [path]

Three-layer analysis:
  Layer 1: Import graph — no platform file imports from aevum/ or examples/
  Layer 1.5: Search privacy — no client-side search + auth in same route file
  Layer 2: Pattern scan — secondary lint for brand names, credentials, etc.

Exits with code 1 if any violations are found.
`);
    exit(0);
  }

  console.log('  Boundary check (v1.3)\n');
  console.log(`  Scanning:  ${relative(cwd(), root) || root}\n`);

  let hasViolations = false;

  // ── Layer 1: Import Graph (primary) ───────────────────────────
  console.log('  Layer 1: Import Graph Analysis (primary gate)');
  const importViolations = scanImportGraph(root);

  if (importViolations.length === 0) {
    console.log('  \x1b[32m\u2713 No import violations found.\x1b[0m\n');
  } else {
    console.log(`  \x1b[31m\u2717 ${importViolations.length} import violation(s) found:\x1b[0m\n`);
    for (const v of importViolations) {
      console.log(`  \x1b[31m${v.file}:${v.line}\x1b[0m`);
      console.log(`    Import:  ${v.importPath}`);
      console.log(`    Reason: ${v.message}\n`);
    }
    hasViolations = true;
  }

  // ── Layer 1.5: Search Privacy Gate (S13.3 Gate #2) ──────────
  console.log('  Layer 1.5: Search Privacy Gate (S13.3 Gate #2)');
  const searchViolations = scanSearchPrivacy(root);

  if (searchViolations.length === 0) {
    console.log('  \x1b[32m\u2713 No search privacy violations found.\x1b[0m\n');
  } else {
    console.log(`  \x1b[31m\u2717 ${searchViolations.length} search privacy violation(s) found:\x1b[0m\n`);
    for (const v of searchViolations) {
      console.log(`  \x1b[31m${v.file}:${v.line}\x1b[0m`);
      console.log(`    Import:  ${v.importPath}`);
      console.log(`    Reason: ${v.message}\n`);
    }
    hasViolations = true;
  }

  // ── Layer 2: Pattern Scan (secondary) ──────────────────────────
  console.log('  Layer 2: Pattern Scan (secondary lint)');
  const patternViolations = scanPatterns(root);

  if (patternViolations.length === 0) {
    console.log('  \x1b[32m\u2713 No pattern violations found.\x1b[0m\n');
  } else {
    console.log(`  \x1b[31m\u2717 ${patternViolations.length} pattern violation(s) found:\x1b[0m\n`);
    for (const v of patternViolations) {
      console.log(`  \x1b[31m${v.file}:${v.line}:${v.col}\x1b[0m`);
      console.log(`    Pattern: ${v.pattern}`);
      console.log(`    Match:   "${v.match}"`);
      console.log(`    Context: ${v.context}\n`);
    }
    hasViolations = true;
  }

  if (hasViolations) {
    exit(1);
  }

  console.log('  \x1b[32m\u2713 All boundary checks passed.\x1b[0m\n');
  exit(0);
}

main();
