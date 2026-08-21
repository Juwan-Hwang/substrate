#!/usr/bin/env bun
/**
 * create-substrate-site — scaffolding CLI for Substrate.
 *
 * Scaffolds a new site from the `northstar` consumer fixture, rewriting
 * branding, metadata, feature preset, and package identity.
 *
 * ## Usage
 *
 * From the monorepo root (workspace mode — `workspace:*` deps):
 *   bun create-site my-site
 *   bun create-site my-site --preset minimal --author Alice --url https://alice.dev
 *
 * From any directory (standalone mode — versioned npm deps):
 *   bun run ./scripts/create-substrate-site.ts my-site --preset minimal
 *
 *   NOTE: Standalone mode is not yet functional — Substrate packages
 *   are not published to npm. Use monorepo (workspace) mode for now.
 *
 * ## Interactive mode
 *
 * When run without enough flags, the CLI prompts for:
 *   1. Site name (kebab-case)
 *   2. Feature preset (numbered menu)
 *   3. Author name
 *   4. Site URL
 *
 * Zero external dependencies — uses only Bun builtins.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { argv, cwd, exit, platform } from 'node:process';

// ── Types ───────────────────────────────────────────────────────────

type Preset = 'minimal' | 'graphics' | 'ai-archive' | 'realtime' | 'reference';

type ContentModel = 'generic' | 'article' | 'none';

type Answers = {
  name: string;
  preset: Preset;
  author: string;
  siteUrl: string;
  contentModel: ContentModel;
};

// ── Constants ───────────────────────────────────────────────────────

const PRESET_TO_MANIFEST: Record<Preset, string> = {
  minimal: 'minimalSiteFeatures',
  graphics: 'graphicsLabFeatures',
  'ai-archive': 'aiArchiveFeatures',
  realtime: 'realtimeRoomFeatures',
  reference: 'referenceFeatures',
};

const PRESET_DESCRIPTIONS: Record<Preset, string> = {
  minimal: 'Pure static content site — no backend, no database',
  graphics: 'WebGPU / WASM / R3F interactive graphics demos',
  'ai-archive': 'AI-powered knowledge base with RAG, hybrid search, chat',
  realtime: 'Realtime collaboration via Cloudflare Durable Objects',
  reference: 'All features enabled — platform reference surface',
};

const CONTENT_MODEL_DESCRIPTIONS: Record<ContentModel, string> = {
  generic: 'Neutral content model — no assumed content type (default)',
  article: 'Article/blog model — content named "articles"',
  none: 'No content model — blank slate',
};

/**
 * The plural noun used in routes, imports, and variable names.
 */
function contentNoun(model: ContentModel): string {
  if (model === 'article') return 'articles';
  return 'content';
}

/**
 * The type name in PascalCase (e.g. for type definitions).
 */
function contentTypeName(model: ContentModel): string {
  if (model === 'article') return 'Article';
  return 'ContentEntry';
}

/**
 * The singular variable name used in loops and destructuring.
 */
function contentSingular(model: ContentModel): string {
  if (model === 'article') return 'article';
  return 'entry';
}

/**
 * The display heading shown on the home page (e.g. "Articles", "Content").
 */
function contentHeading(model: ContentModel): string {
  if (model === 'article') return 'Articles';
  return 'Content';
}

/**
 * The base template is always `northstar` — it exercises the full platform
 * API surface (@substrate-platform/site primitives, @substrate-platform/ui, @substrate-platform/content),
 * so scaffolding from it guarantees the generated site uses every integration
 * point a consumer would need.
 */
const TEMPLATE_DIR = 'northstar';

/**
 * Substrate platform packages that consumers depend on.
 * In monorepo mode, these stay as `workspace:*`.
 * In standalone mode, they are replaced with the Substrate version
 * read from the monorepo's root package.json — so `create-site`
 * always pins the version it was shipped from, not a hardcoded constant.
 */
const PLATFORM_PACKAGE_NAMES = [
  '@substrate-platform/site',
  '@substrate-platform/ui',
  '@substrate-platform/content',
  '@substrate-platform/config',
  '@substrate-platform/contracts',
] as const;

// ── Helpers ─────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCase(s: string): string {
  return s
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Read a line from stdin. Uses Bun's global prompt() when available
 * (works on all platforms including Windows), falls back to synchronous
 * stdin read on POSIX.
 */
function ask(question: string, defaultValue?: string): string {
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  const promptText = `${question}${suffix}: `;

  // Bun provides a global `prompt` function (like the browser one).
  // This works on all platforms including Windows.
  if (typeof globalThis.prompt === 'function') {
    const answer = globalThis.prompt(promptText);
    return (answer ?? '').trim() || defaultValue || '';
  }

  // Fallback: synchronous stdin read (POSIX only — won't work on Windows).
  process.stdout.write(promptText);
  const { openSync, readSync, closeSync } = require('node:fs') as typeof import('node:fs');
  const fd = existsSync('/dev/stdin') ? openSync('/dev/stdin', 'rs') : 0;
  const buf = Buffer.alloc(256);
  const bytes = readSync(fd, buf, 0, 256, null);
  if (fd !== 0) closeSync(fd);
  return buf.toString('utf8', 0, bytes).trim() || defaultValue || '';
}

/**
 * Interactive preset selector — displays a numbered menu and returns
 * the chosen preset. Falls back to text input if the number is invalid.
 */
function askPreset(defaultPreset?: Preset): Preset {
  const entries = Object.entries(PRESET_DESCRIPTIONS) as [Preset, string][];
  console.log('\n  Feature presets:\n');
  for (let i = 0; i < entries.length; i++) {
    const [key, desc] = entries[i];
    const marker = key === defaultPreset ? ' (default)' : '';
    console.log(`    \x1b[36m${i + 1}\x1b[0m. ${key.padEnd(12)} ${desc}${marker}`);
  }
  console.log('');

  const input = ask('Choose preset (1-5)', defaultPreset ?? 'minimal');
  const num = Number(input);
  if (Number.isInteger(num) && num >= 1 && num <= entries.length) {
    return entries[num - 1][0];
  }
  // Allow direct text input too.
  if (PRESET_TO_MANIFEST[input as Preset]) {
    return input as Preset;
  }
  return defaultPreset ?? 'minimal';
}

/**
 * Interactive content model selector — displays a numbered menu and returns
 * the chosen content model. Falls back to text input if the number is invalid.
 */
function askContentModel(defaultModel?: ContentModel): ContentModel {
  const entries = Object.entries(CONTENT_MODEL_DESCRIPTIONS) as [ContentModel, string][];
  console.log('\n  Content model:\n');
  for (let i = 0; i < entries.length; i++) {
    const [key, desc] = entries[i];
    const marker = key === (defaultModel ?? 'generic') ? ' (default)' : '';
    console.log(`    \x1b[36m${i + 1}\x1b[0m. ${key.padEnd(12)} ${desc}${marker}`);
  }
  console.log('');

  const input = ask('Choose content model (1-3)', defaultModel ?? 'generic');
  const num = Number(input);
  if (Number.isInteger(num) && num >= 1 && num <= entries.length) {
    return entries[num - 1][0];
  }
  if (CONTENT_MODEL_DESCRIPTIONS[input as ContentModel]) {
    return input as ContentModel;
  }
  return 'generic';
}

function copyDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.turbo') continue;
    if (entry.endsWith('.tsbuildinfo')) continue;
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      writeFileSync(destPath, readFileSync(srcPath));
    }
  }
}

function rewriteFile(filePath: string, replacements: Array<[RegExp, string]>): void {
  if (!existsSync(filePath)) return;
  let content = readFileSync(filePath, 'utf-8');
  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }
  writeFileSync(filePath, content);
}

// ── CLI parsing ─────────────────────────────────────────────────────

function parseArgs(args: string[]): Partial<Answers> & { help?: boolean; standalone?: boolean } {
  const result: Partial<Answers> & { help?: boolean; standalone?: boolean } = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--preset') {
      const val = args[++i] as Preset;
      if (!PRESET_TO_MANIFEST[val]) {
        console.error(
          `Error: unknown preset "${val}". Valid: ${Object.keys(PRESET_TO_MANIFEST).join(', ')}`,
        );
        exit(1);
      }
      result.preset = val;
    } else if (arg === '--content-model') {
      const val = args[++i] as ContentModel;
      if (!CONTENT_MODEL_DESCRIPTIONS[val]) {
        console.error(
          `Error: unknown content model "${val}". Valid: ${Object.keys(CONTENT_MODEL_DESCRIPTIONS).join(', ')}`,
        );
        exit(1);
      }
      result.contentModel = val;
    } else if (arg === '--author') {
      result.author = args[++i];
    } else if (arg === '--url') {
      result.siteUrl = args[++i];
    } else if (arg === '--standalone') {
      result.standalone = true;
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  if (positional[0]) result.name = positional[0];
  return result;
}

function printHelp(): void {
  const presets = Object.entries(PRESET_DESCRIPTIONS)
    .map(([key, desc]) => `  ${key.padEnd(12)} ${desc}`)
    .join('\n');

  console.log(`
create-substrate-site — scaffold a new site from Substrate

Usage:
  bun create-site <name> [options]           (from monorepo root)
  bun run scripts/create-substrate-site.ts <name> [options]

Options:
  --preset <name>          Feature preset (see below). Default: minimal
  --content-model <name>    Content model template (see below). Default: generic
  --author <name>           Site author name
  --url <url>               Site URL (e.g. https://mysite.com)
  --standalone              Generate with npm version deps instead of workspace:*
  --help, -h                Show this help message

Presets:
${presets}

Content Models:
${Object.entries(CONTENT_MODEL_DESCRIPTIONS)
  .map(([key, desc]) => `  ${key.padEnd(12)} ${desc}`)
  .join('\n')}

Examples:
  bun create-site my-site
  bun create-site my-site --preset minimal --author Alice
  bun create-site my-site --content-model article
  bun create-site my-site --preset ai-archive --url https://alice.dev
  bun create-site my-site --standalone
`);
}

// ── Monorepo detection ──────────────────────────────────────────────

function isMonorepoRoot(root: string): boolean {
  return (
    existsSync(join(root, 'packages')) &&
    existsSync(join(root, 'examples')) &&
    existsSync(join(root, 'package.json'))
  );
}

/**
 * Find the monorepo root by walking up from the script directory.
 */
function findMonorepoRoot(): string | null {
  let dir = dirname(new URL(import.meta.url).pathname);
  // On Windows, the pathname may start with a leading slash before the drive letter.
  if (platform === 'win32') {
    dir = dir.replace(/^\//, '');
  }

  for (let i = 0; i < 10; i++) {
    if (isMonorepoRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ── Template rewriting ──────────────────────────────────────────────

/**
 * Rewrite package.json for the generated site.
 *
 * In monorepo mode: keep `workspace:*` deps.
 * In standalone mode: replace `workspace:*` with npm version ranges.
 */
function rewritePackageJson(
  destDir: string,
  slug: string,
  author: string,
  standalone: boolean,
  substrateVersion: string,
): void {
  const pkgPath = join(destDir, 'package.json');
  if (!existsSync(pkgPath)) return;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

  pkg.name = slug;
  pkg.version = '0.1.0';
  pkg.private = true;
  pkg.author = author;
  delete pkg.license;

  if (standalone) {
    const versionRange = `^${substrateVersion}`;
    for (const deps of [pkg.dependencies, pkg.devDependencies]) {
      if (!deps) continue;
      for (const [name, version] of Object.entries(deps) as [string, string][]) {
        if (
          version === 'workspace:*' &&
          PLATFORM_PACKAGE_NAMES.includes(name as (typeof PLATFORM_PACKAGE_NAMES)[number])
        ) {
          deps[name] = versionRange;
        }
      }
    }

    // Normalise React / Next.js to stable version ranges.
    // The template pins canary/preview versions; standalone consumers
    // should get stable ranges that satisfy the platform's peerDeps.
    const STABLE_VERSIONS: Record<string, string> = {
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      next: '^16.0.0',
      '@types/react': '^19.0.0',
      '@types/react-dom': '^19.0.0',
    };
    for (const deps of [pkg.dependencies, pkg.devDependencies]) {
      if (!deps) continue;
      for (const [name, targetVersion] of Object.entries(STABLE_VERSIONS)) {
        if (deps[name] && deps[name] !== targetVersion) {
          deps[name] = targetVersion;
        }
      }
    }
  }

  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

/**
 * Rewrite all branding references in the generated site.
 *
 * The northstar template uses these brand tokens:
 *   - "Northstar"             → display name (Title Case of slug)
 *   - "northstar"             → slug (in instrumentation serviceName)
 *   - "northstar.example.com" → user's site URL host
 *   - "#d4a052" (amber)       → neutral accent (#7c8ba0)
 *   - Monogram 'N'            → first letter of display name
 *
 * Also renames the "logs" content model to the chosen content noun:
 *   - src/app/logs/    → src/app/<content>/
 *   - src/lib/logs.ts  → src/lib/<content>.ts
 *   - MissionLog       → <ContentTypeName>
 *   - getLog           → get<ContentTypeName>
 */
function rewriteBranding(destDir: string, answers: Answers, standalone = false): void {
  const slug = slugify(answers.name);
  const displayName = titleCase(slug);
  const firstLetter = displayName.charAt(0).toUpperCase();
  const { siteUrl, preset } = answers;
  const host = siteUrl.replace(/^https?:\/\//, '');
  const manifestConst = PRESET_TO_MANIFEST[preset];

  // ── layout.tsx ──────────────────────────────────────────────────
  // Rewrite the Northstar comment block and identity tokens.
  // The template uses SubstrateLayout with the default "Powered by
  // Substrate" footer — no poweredBy override to strip.
  rewriteFile(join(destDir, 'src/app/layout.tsx'), [
    [/minimalSiteFeatures/g, manifestConst],
    [/Northstar/g, displayName],
    [/northstar\.example\.com/g, host],
    [
      /a fictional interstellar technology journal\. Built on Substrate\./g,
      'A personal site built on Substrate.',
    ],
    [
      /Northstar is the first example site that consumes @substrate\/site's[\s\S]*?See globals\.css for the full contract documentation\.\s*\*\//g,
      `A personal site built on the Substrate platform.\n */`,
    ],
  ]);

  // ── page.tsx ────────────────────────────────────────────────────
  const noun = contentNoun(answers.contentModel);
  const singular = contentSingular(answers.contentModel);
  rewriteFile(join(destDir, 'src/app/page.tsx'), [
    [/Northstar/g, displayName],
    [/Field reports from the edge of human reach\./g, 'A personal site built on Substrate.'],
    [/Mission Logs/g, contentHeading(answers.contentModel)],
    [/\/logs\//g, `/${noun}/`],
    [/import \{ logs \} from '@\/lib\/logs'/g, `import { ${noun} } from '@/lib/${noun}'`],
    [/logs\.map/g, `${noun}.map`],
    // Replace variable name `log` → singular content term using word boundaries.
    [/\blog\b/g, singular],
  ]);

  // ── instrumentation.ts ──────────────────────────────────────────
  rewriteFile(join(destDir, 'src/instrumentation.ts'), [
    [/featurePreset: 'minimal'/g, `featurePreset: '${preset === 'full' ? 'minimal' : preset}'`],
    [/serviceName: 'northstar'/g, `serviceName: '${slug}'`],
    [
      /Northstar overrides the service name[\s\S]*?platform factory accepts application-specific configuration\.\s*\*\//g,
      `Uses the @substrate-platform/site instrumentation factory to bootstrap the feature manifest.\n */`,
    ],
  ]);

  // ── globals.css ─────────────────────────────────────────────────
  rewriteFile(join(destDir, 'src/app/globals.css'), [
    [/Northstar/g, displayName],
    [
      /Northstar uses a warm amber accent[\s\S]*?shared component library inherits Northstar's identity without a fork\./g,
      `${displayName} uses a custom accent colour on a dark backdrop. The accent token (--accent-primary) is consumed by @substrate-platform/ui, so the shared component library inherits the site's identity without a fork.`,
    ],
    // Reset accent colour to a neutral default — the user can change it.
    [/#d4a052/g, '#7c8ba0'],
    [/rgba\(212, 160, 82, 0\.15\)/g, 'rgba(124, 139, 160, 0.15)'],
    [/#0b0d14/g, '#0a0a0c'],
    [/#12141f/g, '#131316'],
    [/#1a1d2c/g, '#1a1a20'],
    [/#e6e4dc/g, '#e8e8ea'],
    [/#9b988e/g, '#999'],
    [/#5e5c54/g, '#666'],
    [/#282b3d/g, '#2a2a30'],
    [/#8a6a2e/g, '#4a5568'],
  ]);

  // ── OG route ────────────────────────────────────────────────────
  rewriteFile(join(destDir, 'src/app/api/og/route.tsx'), [
    [/Northstar/g, displayName],
    [/northstar/g, slug],
    [/Field reports from the edge of human reach/g, 'A personal site built on Substrate'],
    [/>N</g, `>${firstLetter}<`],
    [/#d4a052/g, '#7c8ba0'],
    [/#0b0d14/g, '#0a0a0c'],
    [/#12141f/g, '#131316'],
    [/#e6e4dc/g, '#e8e8ea'],
    [/#9b988e/g, '#999'],
    [/#5e5c54/g, '#666'],
    [/#8a6a2e/g, '#4a5568'],
  ]);

  // ── logs/[slug]/page.tsx → <content>/[slug]/page.tsx ─────────────
  const logsDir = join(destDir, 'src/app/logs');
  const contentDirName = contentNoun(answers.contentModel);
  const contentDir = join(destDir, 'src/app', contentDirName);
  if (existsSync(logsDir)) {
    mkdirSync(contentDir, { recursive: true });
    const slugDir = join(logsDir, '[slug]');
    const targetSlugDir = join(contentDir, '[slug]');
    if (existsSync(slugDir)) {
      mkdirSync(targetSlugDir, { recursive: true });
      const pageFile = join(slugDir, 'page.tsx');
      if (existsSync(pageFile)) {
        const typeName = contentTypeName(answers.contentModel);
        const content = readFileSync(pageFile, 'utf-8')
          .replace(/MissionLog/g, typeName)
          .replace(/mission log/g, singular)
          .replace(/Mission Log/g, typeName)
          .replace(/Mission Logs/g, contentHeading(answers.contentModel))
          .replace(/getLog/g, `get${typeName}`)
          .replace(/getAllSlugs/g, 'getAllSlugs')
          .replace(/logs/g, contentDirName)
          .replace(/@\/lib\/logs/g, `@/lib/${contentDirName}`)
          .replace(/LogPage/g, `${typeName}Page`)
          .replace(/Search mission logs/g, `Search ${contentDirName}`)
          // Replace variable name `log` → singular content term using word boundaries.
          // Must come AFTER HTML tag replacements to avoid touching HTML tags.
          .replace(/\blog\b/g, singular);
        writeFileSync(join(targetSlugDir, 'page.tsx'), content);
      }
    }
    rmSync(logsDir, { recursive: true, force: true });
  }

  // ── lib/logs.ts → lib/<content>.ts ──────────────────────────────
  const logsLib = join(destDir, 'src/lib/logs.ts');
  if (existsSync(logsLib)) {
    const typeName = contentTypeName(answers.contentModel);
    const content = readFileSync(logsLib, 'utf-8')
      .replace(/MissionLog/g, typeName)
      .replace(/mission log/g, singular)
      .replace(/Mission Log/g, typeName)
      .replace(/getLog/g, `get${typeName}`)
      .replace(/Northstar/g, displayName)
      .replace(/logs/g, contentDirName)
      .replace(/\blog\b/g, singular)
      .replace(
        /Static mission log corpus for the Northstar example site[\s\S]*?\*\/\n*/g,
        `/** Static ${contentDirName} corpus for ${displayName}. */\n\n`,
      );
    writeFileSync(join(destDir, 'src/lib', `${contentDirName}.ts`), content);
    rmSync(logsLib, { force: true });
  }

  // ── archive/page.tsx ────────────────────────────────────────────
  rewriteFile(join(destDir, 'src/app/archive/page.tsx'), [
    [/mission log/g, singular],
    [/Mission Log/g, contentTypeName(answers.contentModel)],
    [/logs/g, contentDirName],
    [/@\/lib\/logs/g, `@/lib/${contentDirName}`],
    [/Search every mission log/g, `Search every ${contentDirName}`],
    [/\blog\b/g, singular],
  ]);

  // ── archive/search.tsx ──────────────────────────────────────────
  rewriteFile(join(destDir, 'src/app/archive/search.tsx'), [
    [/mission log/g, singular],
    [/Mission log/g, contentTypeName(answers.contentModel)],
    [/Search mission logs/g, `Search ${contentDirName}`],
    [/\/logs\//g, `/${contentDirName}/`],
    [/\blog\b/g, singular],
  ]);

  // ── next.config.ts ──────────────────────────────────────────────
  rewriteFile(join(destDir, 'next.config.ts'), [
    [
      /Northstar is a fully independent consumer of the Substrate platform[\s\S]*?built entirely on platform primitives\./g,
      `${displayName} is built on the Substrate platform.`,
    ],
  ]);

  if (standalone) {
    // Rewrite next.config.ts completely for standalone mode.
    // The template uses canary-only features (viewTransition) and
    // workspace-specific config (transpilePackages) that don't apply
    // to standalone projects consuming published npm packages.
    const nextConfigContent = `/**
 * Next.js 16 configuration for ${displayName}.
 *
 * ${displayName} is built on the Substrate platform.
 *
 * - reactCompiler: opt-in to the React Compiler for automatic memoisation.
 * - cacheComponents: Partial Prerendering — static shells with streamed holes.
 */
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  // ── Security headers ────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'strict-dynamic'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              'upgrade-insecure-requests',
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
`;
    writeFileSync(join(destDir, 'next.config.ts'), nextConfigContent);
  }

  // ── __tests__/search.test.ts ────────────────────────────────────
  rewriteFile(join(destDir, 'src/__tests__/search.test.ts'), [
    [/Northstar/g, displayName],
    [/mission log/g, singular],
    [/Northstar corpus/g, `${displayName} corpus`],
  ]);
}

// ── Standalone tsconfig rewrite ────────────────────────────────────

/**
 * Rewrite tsconfig.json for standalone mode.
 *
 * The template (northstar) ships with a tsconfig that extends
 * ../../tsconfig.base.json and uses paths pointing to ../../packages/*.
 * In standalone mode, these paths don't exist — the project depends on
 * npm-published @substrate-platform/* packages instead.
 *
 * This function writes a self-contained tsconfig.json that:
 * - Inlines the necessary compiler options (no extends to monorepo)
 * - Removes workspace path aliases (npm packages resolve via node_modules)
 * - Keeps @/* alias for the application's own src/
 */
function rewriteTsconfigForStandalone(destDir: string): void {
  const tsconfigPath = join(destDir, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) return;

  const standaloneTsconfig = {
    compilerOptions: {
      target: 'ES2024',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      lib: ['ES2024', 'DOM', 'DOM.Iterable', 'DOM.AsyncIterable'],
      strict: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      noImplicitOverride: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      declaration: false,
      declarationMap: false,
      sourceMap: true,
      composite: false,
      incremental: true,
      isolatedModules: true,
      verbatimModuleSyntax: true,
      erasableSyntaxOnly: true,
      noEmit: true,
      jsx: 'preserve',
      types: ['node'],
      plugins: [{ name: 'next' }],
      paths: {
        '@/*': ['./src/*'],
      },
    },
    include: ['src', 'next.config.ts', 'next-env.d.ts'],
    exclude: ['node_modules', '.next'],
  };

  writeFileSync(tsconfigPath, `${JSON.stringify(standaloneTsconfig, null, 2)}\n`);
}

// ── Generated file templates ────────────────────────────────────────

/**
 * Generate `.env.example` with the platform's environment contract.
 *
 * The platform defines the variable names; the application supplies the
 * values. This file documents all optional variables so the user knows
 * exactly what the platform accepts.
 */
function generateEnvExample(destDir: string, answers: Answers): void {
  const slug = slugify(answers.name);

  const lines: string[] = [
    '# ── Site identity ────────────────────────────────────────────────',
    `NEXT_PUBLIC_SITE_URL=${answers.siteUrl}`,
    `NEXT_PUBLIC_SITE_NAME=${titleCase(slug)}`,
    '',
    '# ── Analytics (optional) ────────────────────────────────────────',
    '# NEXT_PUBLIC_POSTHOG_KEY=',
    '# NEXT_PUBLIC_SENTRY_DSN=',
    '',
    '# ── AI features (optional, ai-archive preset) ───────────────────',
    '# OPENAI_API_KEY=',
    '',
    '# ── Database (optional, ai-archive preset) ──────────────────────',
    '# DATABASE_URL=',
    '',
    '# ── Auth (optional) ─────────────────────────────────────────────',
    '# AUTH_SECRET=',
    '# GITHUB_OAUTH_CLIENT_ID=',
    '# GITHUB_OAUTH_CLIENT_SECRET=',
    '',
    '# ── Deployment (optional) ───────────────────────────────────────',
    '# Cloudflare',
    '# CLOUDFLARE_ACCOUNT_ID=',
    '# CLOUDFLARE_API_TOKEN=',
    '',
    '# Upstash Redis (realtime preset)',
    '# UPSTASH_REDIS_URL=',
    '# UPSTASH_REDIS_TOKEN=',
    '',
  ];

  writeFileSync(join(destDir, '.env.example'), lines.join('\n'));
}

/**
 * Generate a `README.md` for the new site.
 *
 * This gives the generated project a professional, self-contained
 * README — not a copy of the platform's README.
 */
function generateReadme(
  destDir: string,
  slug: string,
  answers: Answers,
  standalone: boolean,
  substrateVersion: string,
): void {
  const displayName = titleCase(slug);
  const presetDesc = PRESET_DESCRIPTIONS[answers.preset];

  const lines: string[] = [
    `# ${displayName}`,
    '',
    `> ${presetDesc}`,
    '',
    `Built on [Substrate](https://github.com/Juwan-Hwang/substrate)${standalone ? ` v${substrateVersion}` : ''}.`,
    '',
    '## Quick start',
    '',
    '```bash',
    'bun install',
    'bun dev',
    '```',
    '',
    'Then open [http://localhost:3000](http://localhost:3000).',
    '',
    '## Customisation',
    '',
    '| File | Purpose |',
    '|------|---------|',
    '| `src/app/layout.tsx` | Metadata, fonts, global layout |',
    '| `src/app/globals.css` | Theme tokens (colours, spacing) |',
    '| `src/app/page.tsx` | Homepage |',
    `| \`src/lib/${contentNoun(answers.contentModel)}.ts\` | Your content corpus |`,
    '| `src/instrumentation.ts` | Feature preset, service name |',
    '| `.env.example` | Environment variables contract |',
    '',
    '## Build',
    '',
    '```bash',
    'bun run build',
    'bun run start',
    '```',
    '',
    '## License',
    '',
    'Private — all rights reserved.',
    '',
  ];

  writeFileSync(join(destDir, 'README.md'), lines.join('\n'));
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const scriptDir = dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
  const monorepoRoot = findMonorepoRoot();

  const cliArgs = parseArgs(argv.slice(2));

  if (cliArgs.help) {
    printHelp();
    exit(0);
  }

  // Determine mode: monorepo (workspace:*) or standalone (npm versions).
  const inMonorepo = monorepoRoot !== null;
  const standalone = cliArgs.standalone === true || !inMonorepo;

  // Read the Substrate version from the monorepo's root package.json.
  // In standalone mode, this version is pinned into the generated site's
  // dependencies so `create-site` always ships the version it was built from.
  let substrateVersion = '0.0.0';
  if (monorepoRoot) {
    const rootPkgPath = join(monorepoRoot, 'package.json');
    if (existsSync(rootPkgPath)) {
      const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'));
      substrateVersion = rootPkg.version ?? '0.0.0';
    }
  }

  // Find the template directory.
  let templateDir: string;
  if (monorepoRoot) {
    templateDir = join(monorepoRoot, 'examples', TEMPLATE_DIR);
  } else {
    templateDir = join(scriptDir, '..', 'examples', TEMPLATE_DIR);
  }

  if (!existsSync(templateDir)) {
    console.error(`Error: template directory not found: ${templateDir}`);
    console.error(
      standalone
        ? 'Run this script from within the Substrate monorepo, or ensure examples/northstar/ exists.'
        : 'Expected to find examples/northstar/ in the monorepo.',
    );
    exit(1);
  }

  // Collect answers — interactive or non-interactive.
  let answers: Answers;

  if (cliArgs.name && cliArgs.preset) {
    answers = {
      name: cliArgs.name,
      preset: cliArgs.preset,
      author: cliArgs.author ?? 'Anonymous',
      siteUrl: cliArgs.siteUrl ?? `https://${slugify(cliArgs.name)}.com`,
      contentModel: cliArgs.contentModel ?? 'generic',
    };
  } else {
    // Interactive mode — prompt for each field.
    console.log('\n  \x1b[1mcreate-substrate-site\x1b[0m — scaffold a new site from Substrate\n');

    const name = ask('Site name (kebab-case)', cliArgs.name ?? 'my-site');
    const preset = askPreset(cliArgs.preset);
    const contentModel = askContentModel(cliArgs.contentModel);
    const author = ask('Author name', cliArgs.author ?? 'Anonymous');
    const defaultUrl = `https://${slugify(name)}.com`;
    const siteUrl = ask('Site URL', cliArgs.siteUrl ?? defaultUrl);

    answers = {
      name: name || 'my-site',
      preset,
      author: author || 'Anonymous',
      siteUrl: siteUrl || `https://${slugify(name)}.com`,
      contentModel,
    };
  }

  const slug = slugify(answers.name);

  // Target directory:
  //   Monorepo mode  → examples/<slug>  (picked up by workspace glob)
  //   Standalone mode → <cwd>/<slug>     (independent project)
  const targetDir = standalone ? join(cwd(), slug) : join(cwd(), 'examples', slug);

  if (existsSync(targetDir)) {
    console.error(`Error: target directory already exists: ${targetDir}`);
    exit(1);
  }

  // ── Scaffold ──────────────────────────────────────────────────────

  console.log('');
  console.log(`  \x1b[1m${titleCase(slug)}\x1b[0m`);
  console.log(`  Preset:        ${answers.preset}`);
  console.log(`  Content model: ${answers.contentModel}`);
  console.log(`  Template:      examples/${TEMPLATE_DIR}/`);
  console.log(`  Target:         ${relative(cwd(), targetDir) || targetDir}`);
  console.log(
    `  Mode:          ${standalone ? 'standalone (npm deps)' : 'monorepo (workspace:*)'}`,
  );
  if (standalone) {
    console.log(`  Substrate: ^${substrateVersion}`);
  }
  console.log(`  Author:    ${answers.author}`);
  console.log(`  URL:       ${answers.siteUrl}`);
  console.log('');

  copyDir(templateDir, targetDir);

  // Remove generated artifacts.
  const cleanupPaths = [join(targetDir, 'next-env.d.ts'), join(targetDir, 'tsconfig.tsbuildinfo')];
  for (const p of cleanupPaths) {
    if (existsSync(p)) rmSync(p, { force: true });
  }

  // Rewrite branding and package.json.
  rewritePackageJson(targetDir, slug, answers.author, standalone, substrateVersion);
  rewriteBranding(targetDir, { ...answers, name: slug }, standalone);

  // In standalone mode, rewrite tsconfig.json to be self-contained.
  if (standalone) {
    rewriteTsconfigForStandalone(targetDir);
  }

  // Generate .env.example with the platform's environment contract.
  generateEnvExample(targetDir, answers);

  // Generate README.md for the new site.
  generateReadme(targetDir, slug, answers, standalone, substrateVersion);

  // ── Done ──────────────────────────────────────────────────────────

  console.log('  \x1b[32m✓ Done.\x1b[0m Next steps:\n');

  if (standalone) {
    console.log(`    \x1b[36mcd\x1b[0m ${slug}`);
    console.log(`    \x1b[36mbun install\x1b[0m`);
    console.log(`    \x1b[36mbun dev\x1b[0m\n`);
  } else {
    console.log(`    \x1b[36mbun install\x1b[0m`);
    console.log(`    \x1b[36mbun dev\x1b[0m --filter ${slug}\n`);
  }

  console.log('  Then customise:');
  const basePath = standalone ? slug : `examples/${slug}`;
  console.log(`    ${basePath}/src/app/layout.tsx      — metadata, fonts`);
  console.log(`    ${basePath}/src/app/globals.css     — theme tokens`);
  console.log(`    ${basePath}/src/lib/${contentNoun(answers.contentModel)}.ts     — your content`);
  console.log(`    ${basePath}/src/instrumentation.ts  — feature preset`);
  console.log(`    ${basePath}/.env.example            — environment vars\n`);

  console.log(
    '  \x1b[2mBuilt on Substrate — open-source platform for modern personal sites.\x1b[0m\n',
  );
}

main();
