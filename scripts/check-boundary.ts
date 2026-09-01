#!/usr/bin/env bun
/**
 * check-boundary.ts — Platform boundary enforcement CI gate (v1.4).
 *
 * Three-layer analysis (see PLATFORM_BOUNDARY.md §6):
 *
 *   Layer 1: Import Graph (primary gate)
 *     No platform package (packages/&#42;/src/) imports from
 *     a forbidden application namespace (configured in
 *     .boundary-patterns.json) or examples/.
 *     This is the core boundary proof.
 *
 *   Layer 1.5: Search Privacy Gate (S13.3 CI Gate #2)
 *     Files under examples/&#42;/src/app/&#42;&#42; that import a client-side
 *     search library must NOT also import auth-related modules.
 *
 *   Layer 2: Pattern Scan (secondary lint)
 *     Catches application-specific identifiers (brand names,
 *     person identifiers, CSS prefixes, credentials).
 *     Brand patterns are configured in .boundary-patterns.json;
 *     credential detection is built-in.
 *     NOT the core boundary proof.
 *
 * Usage:
 *   bun run scripts/check-boundary.ts        # CI mode
 *   bun boundary:check                        # via package.json script
 *
 * Configuration:
 *   .boundary-patterns.json — forbiddenBrandPatterns + forbiddenImportNamespaces
 *
 * Zero external dependencies — uses only Node/Bun builtins.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { argv, cwd, exit } from 'node:process';
import { fileURLToPath } from 'node:url';

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
  'node_modules',
  '.next',
  '.turbo',
  '.git',
  'dist',
  'target',
  'storybook-static',
  '.cache',
]);

const EXCLUDED_FILES = new Set([
  'PLATFORM_BOUNDARY.md',
  'check-boundary.ts',
  'bun.lock',
  'bun.lockb',
  '.gitignore',
  '.editorconfig',
  '.boundary-patterns.json',
]);

const EXCLUDED_PATH_PREFIXES = ['crates/wasm/pkg'];

const SCANNABLE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.jsonc',
  '.css',
  '.scss',
  '.md',
  '.mdx',
  '.html',
  '.htm',
  '.yaml',
  '.yml',
  '.toml',
  '.rs',
  '.env',
  '.env.example',
  '.env.local',
  '.sh',
  '.bash',
  '.sql',
  '.txt',
  '.wit',
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

function extractImports(content: string): Array<{ path: string; line: number }> {
  const imports: Array<{ path: string; line: number }> = [];
  const lines = content.split('\n');

  const importRegex =
    /(?:import\s[^;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

  for (let i = 0; i < lines.length; i++) {
    let match: RegExpExecArray | null;
    importRegex.lastIndex = 0;
    while (true) {
      match = importRegex.exec(lines[i]);
      if (match === null) break;
      const importPath = match[1] || match[2] || match[3];
      if (importPath) {
        imports.push({ path: importPath, line: i + 1 });
      }
    }
  }

  return imports;
}

// ═══════════════════════════════════════════════════════════════════
// Configuration: .boundary-patterns.json
// ═══════════════════════════════════════════════════════════════════

type BrandPattern = {
  pattern: string;
  flags: string;
  message: string;
};

type BoundaryConfig = {
  forbiddenBrandPatterns: BrandPattern[];
  forbiddenImportNamespaces: string[];
};

/**
 * Read the boundary patterns configuration file.
 *
 * The config lives at the monorepo root as .boundary-patterns.json.
 * Forks replace the brand patterns with their own identifiers;
 * the script reads them at runtime — no recompilation needed.
 *
 * If the file is missing, the gate fails loudly — silent fallback
 * to zero patterns would be a security regression.
 */
function loadBoundaryConfig(): BoundaryConfig {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const configPath = join(scriptDir, '..', '.boundary-patterns.json');

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch {
    console.error(`  \x1b[31mFatal: .boundary-patterns.json not found at ${configPath}\x1b[0m`);
    console.error('  The boundary gate cannot run without its configuration.');
    console.error('  If you forked Substrate, copy .boundary-patterns.json and replace');
    console.error('  the brand patterns with your own identifiers.\n');
    exit(2);
  }

  let config: BoundaryConfig;
  try {
    config = JSON.parse(raw) as BoundaryConfig;
  } catch {
    console.error(`  \x1b[31mFatal: .boundary-patterns.json is not valid JSON.\x1b[0m\n`);
    exit(2);
  }

  if (
    !Array.isArray(config.forbiddenBrandPatterns) ||
    !Array.isArray(config.forbiddenImportNamespaces)
  ) {
    console.error('  \x1b[31mFatal: .boundary-patterns.json missing required fields.\x1b[0m');
    console.error(
      '  Expected: { forbiddenBrandPatterns: [...], forbiddenImportNamespaces: [...] }\n',
    );
    exit(2);
  }

  return config;
}

const BOUNDARY_CONFIG = loadBoundaryConfig();

// ═══════════════════════════════════════════════════════════════════
// Layer 1: Import Graph Analysis (PRIMARY GATE)
// ═══════════════════════════════════════════════════════════════════

/**
 * Build forbidden import patterns from config namespaces.
 *
 * Each namespace (e.g. 'aevum') generates three patterns:
 *   /(^|\/)namespace\//   — matches 'aevum/' path segments
 *   /(^|\/)namespace-/    — matches 'aevum-*' packages
 *   /^@namespace\//       — matches '@aevum/' scoped packages
 *
 * 'examples/' is always forbidden — it's a structural rule, not a brand.
 */
function buildForbiddenImportPatterns(namespaces: readonly string[]): RegExp[] {
  const patterns: RegExp[] = [/(?:^|\/)examples\//];
  for (const ns of namespaces) {
    const escaped = ns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    patterns.push(new RegExp(`(?:^|/)${escaped}/`));
    patterns.push(new RegExp(`(?:^|/)${escaped}-`));
    patterns.push(new RegExp(`^@${escaped}/`));
  }
  return patterns;
}

const FORBIDDEN_IMPORT_PATTERNS: RegExp[] = buildForbiddenImportPatterns(
  BOUNDARY_CONFIG.forbiddenImportNamespaces,
);

const PLATFORM_DIRS: readonly string[] = [
  'packages/contracts/src',
  'packages/auth/src',
  'packages/db/src',
  'packages/config/src',
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
  const hasAuthImport = imports.some(({ path }) => AUTH_IMPORT_PATTERNS.some((p) => p.test(path)));

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

/**
 * Build brand pattern entries from config.
 *
 * Each config entry has { pattern, flags, message } — compiled to a
 * RegExp at load time. Forks edit .boundary-patterns.json to add or
 * remove their own identifiers without touching this script.
 */
function buildBrandPatterns(
  entries: readonly BrandPattern[],
): Array<{ regex: RegExp; message: string }> {
  return entries.map(({ pattern, flags, message }) => ({
    regex: new RegExp(pattern, flags),
    message,
  }));
}

const PATTERNS: Array<{ regex: RegExp; message: string }> = [
  // ── Config-driven brand patterns (.boundary-patterns.json) ──────
  ...buildBrandPatterns(BOUNDARY_CONFIG.forbiddenBrandPatterns),

  // ── Built-in architectural anti-patterns (not brand-specific) ────
  //
  // These detect known anti-pattern constant names that were removed
  // from the platform. They are structural rules — any fork that names
  // a constant SITE_BRAND or SUBSYSTEMS is violating the platform
  // boundary, regardless of their brand.
  {
    regex: /\bSITE_BRAND\b/g,
    message: 'Hardcoded brand constant "SITE_BRAND" — replaced by SiteIdentity',
  },
  {
    regex: /\bSUBSYSTEMS\b/g,
    message: 'Hardcoded subsystem list "SUBSYSTEMS" — application-specific',
  },

  // ── Built-in credential detection (security lint, not brand) ─────
  //
  // These are universal security patterns — never configurable. No
  // legitimate platform code should contain API keys or AWS credentials.
  {
    regex: /\b(sk-|pk-|key_)[A-Za-z0-9]{20,}\b/g,
    message: 'Possible API key or secret — credential in platform code',
  },
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

      while (true) {
        match = regex.exec(line);
        if (match === null) break;
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
check-boundary — platform boundary enforcement gate (v1.4)

Usage:
  bun run scripts/check-boundary.ts [path]

Three-layer analysis:
  Layer 1: Import graph — no platform file imports from configured namespaces or examples/
  Layer 1.5: Search privacy — no client-side search + auth in same route file
  Layer 2: Pattern scan — secondary lint for brand names, credentials, etc.

Configuration:
  .boundary-patterns.json — forbiddenBrandPatterns + forbiddenImportNamespaces

Exits with code 1 if any violations are found.
`);
    exit(0);
  }

  console.log('  Boundary check (v1.4)\n');
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
    console.log(
      `  \x1b[31m\u2717 ${searchViolations.length} search privacy violation(s) found:\x1b[0m\n`,
    );
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
    console.log(
      `  \x1b[31m\u2717 ${patternViolations.length} pattern violation(s) found:\x1b[0m\n`,
    );
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
