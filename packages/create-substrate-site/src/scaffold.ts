/**
 * create-substrate-site — template rewriting engine.
 *
 * Transforms the northstar template into a consumer site by rewriting
 * branding, identity, feature preset, content model, package.json,
 * tsconfig, next.config, and generating .env.example + README.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { cwd } from 'node:process';
import {
  COLOUR_REPLACEMENTS,
  OG_COLOUR_REPLACEMENTS,
  PLATFORM_PACKAGE_NAMES,
  PRESET_DESCRIPTIONS,
  PRESET_TO_MANIFEST,
  STABLE_VERSIONS,
  STANDALONE_INJECT_DEVDEPS,
  TEMPLATE_DIR,
} from './constants';
import { copyDir, rewriteFile } from './fs';
import {
  contentHeading,
  contentNoun,
  contentSingular,
  contentTypeName,
  slugify,
  titleCase,
} from './helpers';
import type { ScaffoldAnswers, ScaffoldOptions, ScaffoldResult } from './types';
import { describeVersionSource, resolveSubstrateVersion } from './version';

// ── Package.json rewriting ────────────────────────────────────────

/**
 * Rewrite package.json for the generated site.
 *
 * In monorepo mode: keep `workspace:*` deps.
 * In standalone mode: replace `workspace:*` with the channel/version range.
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
    for (const deps of [pkg.dependencies, pkg.devDependencies]) {
      if (!deps) continue;
      for (const [name, version] of Object.entries(deps) as [string, string][]) {
        if (
          version === 'workspace:*' &&
          PLATFORM_PACKAGE_NAMES.includes(name as (typeof PLATFORM_PACKAGE_NAMES)[number])
        ) {
          deps[name] = substrateVersion;
        }
      }
    }

    // Normalise React / Next.js to stable version ranges.
    for (const deps of [pkg.dependencies, pkg.devDependencies]) {
      if (!deps) continue;
      for (const [name, targetVersion] of Object.entries(STABLE_VERSIONS)) {
        if (deps[name] && deps[name] !== targetVersion) {
          deps[name] = targetVersion;
        }
      }
    }

    // Inject devDependencies that are hoisted to the monorepo root
    // but must be explicit in standalone projects.
    if (!pkg.devDependencies) pkg.devDependencies = {};
    for (const [name, version] of Object.entries(STANDALONE_INJECT_DEVDEPS)) {
      if (!pkg.devDependencies[name]) {
        pkg.devDependencies[name] = version;
      }
    }
  }

  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

// ── Branding rewriting ────────────────────────────────────────────

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
 * Also renames the "logs" content model to the chosen content noun.
 */
function rewriteBranding(destDir: string, answers: ScaffoldAnswers, standalone: boolean): void {
  const slug = slugify(answers.name);
  const displayName = titleCase(slug);
  const firstLetter = displayName.charAt(0).toUpperCase();
  const { siteUrl, preset } = answers;
  const host = siteUrl.replace(/^https?:\/\//, '');
  const manifestConst = PRESET_TO_MANIFEST[preset];

  // ── layout.tsx ──────────────────────────────────────────────────
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
    [/\blog\b/g, singular],
  ]);

  // ── instrumentation.ts ──────────────────────────────────────────
  rewriteFile(join(destDir, 'src/instrumentation.ts'), [
    [/featurePreset: 'minimal'/g, `featurePreset: '${preset}'`],
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
    ...COLOUR_REPLACEMENTS,
  ]);

  // ── OG route ────────────────────────────────────────────────────
  rewriteFile(join(destDir, 'src/app/api/og/route.tsx'), [
    [/Northstar/g, displayName],
    [/northstar/g, slug],
    [/Field reports from the edge of human reach/g, 'A personal site built on Substrate'],
    [/>N</g, `>${firstLetter}<`],
    ...OG_COLOUR_REPLACEMENTS,
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

// ── Standalone tsconfig rewrite ───────────────────────────────────

/**
 * Rewrite tsconfig.json for standalone mode.
 *
 * The template ships with a tsconfig that extends ../../tsconfig.base.json
 * and uses paths pointing to ../../packages/*. In standalone mode, these
 * paths don't exist — the project depends on npm-published packages.
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

// ── Generated file templates ──────────────────────────────────────

/**
 * Generate `.env.example` with the platform's environment contract.
 */
function generateEnvExample(destDir: string, answers: ScaffoldAnswers): void {
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
 */
function generateReadme(
  destDir: string,
  slug: string,
  answers: ScaffoldAnswers,
  standalone: boolean,
): void {
  const displayName = titleCase(slug);
  const presetDesc = PRESET_DESCRIPTIONS[answers.preset];
  const versionInfo = standalone
    ? ` (Substrate ${describeVersionSource(answers.channel, answers.version)})`
    : '';

  const lines: string[] = [
    `# ${displayName}`,
    '',
    `> ${presetDesc}`,
    '',
    `Built on [Substrate](https://github.com/Juwan-Hwang/substrate)${versionInfo}.`,
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

// ── Main scaffold function ───────────────────────────────────────

/**
 * Execute the full scaffold: copy template, rewrite branding, generate
 * auxiliary files. Returns the result metadata.
 *
 * This is the programmatic API — the CLI entry point calls this after
 * parsing args and/or prompting interactively.
 */
export function scaffoldSite(options: ScaffoldOptions): ScaffoldResult {
  const slug = slugify(options.name);
  const substrateVersion = resolveSubstrateVersion(options.channel, options.version);

  if (existsSync(options.targetDir)) {
    throw new Error(`Target directory already exists: ${options.targetDir}`);
  }

  // ── Summary ─────────────────────────────────────────────────────
  console.log('');
  console.log(`  \x1b[1m${titleCase(slug)}\x1b[0m`);
  console.log(`  Preset:        ${options.preset}`);
  console.log(`  Content model: ${options.contentModel}`);
  console.log(`  Template:      ${TEMPLATE_DIR}/`);
  console.log(`  Target:         ${relative(cwd(), options.targetDir) || options.targetDir}`);
  console.log(
    `  Mode:          ${options.standalone ? 'standalone (npm deps)' : 'monorepo (workspace:*)'}`,
  );
  if (options.standalone) {
    console.log(
      `  Substrate:     ${substrateVersion} (${describeVersionSource(options.channel, options.version)})`,
    );
  }
  console.log(`  Author:    ${options.author}`);
  console.log(`  URL:       ${options.siteUrl}`);
  console.log('');

  // ── Copy template ──────────────────────────────────────────────
  copyDir(options.templateDir, options.targetDir);

  // Remove generated artifacts.
  const cleanupPaths = [
    join(options.targetDir, 'next-env.d.ts'),
    join(options.targetDir, 'tsconfig.tsbuildinfo'),
  ];
  for (const p of cleanupPaths) {
    if (existsSync(p)) rmSync(p, { force: true });
  }

  // ── Rewrite ────────────────────────────────────────────────────
  rewritePackageJson(options.targetDir, slug, options.author, options.standalone, substrateVersion);
  rewriteBranding(options.targetDir, { ...options, name: slug }, options.standalone);

  if (options.standalone) {
    rewriteTsconfigForStandalone(options.targetDir);
  }

  generateEnvExample(options.targetDir, options);
  generateReadme(options.targetDir, slug, options, options.standalone);

  // ── Done ───────────────────────────────────────────────────────
  console.log('  \x1b[32m✓ Done.\x1b[0m Next steps:\n');

  if (options.standalone) {
    console.log(`    \x1b[36mcd\x1b[0m ${slug}`);
    console.log(`    \x1b[36mbun install\x1b[0m`);
    console.log(`    \x1b[36mbun dev\x1b[0m\n`);
  } else {
    console.log(`    \x1b[36mbun install\x1b[0m`);
    console.log(`    \x1b[36mbun dev\x1b[0m --filter ${slug}\n`);
  }

  console.log('  Then customise:');
  const basePath = options.standalone ? slug : `examples/${slug}`;
  console.log(`    ${basePath}/src/app/layout.tsx      — metadata, fonts`);
  console.log(`    ${basePath}/src/app/globals.css     — theme tokens`);
  console.log(`    ${basePath}/src/lib/${contentNoun(options.contentModel)}.ts     — your content`);
  console.log(`    ${basePath}/src/instrumentation.ts  — feature preset`);
  console.log(`    ${basePath}/.env.example            — environment vars\n`);

  console.log(
    '  \x1b[2mBuilt on Substrate — open-source platform for modern personal sites.\x1b[0m\n',
  );

  return {
    targetDir: options.targetDir,
    slug,
    substrateVersion,
    standalone: options.standalone,
  };
}

// Re-export constants for programmatic consumers.
export {
  CONTENT_MODEL_DESCRIPTIONS,
  PRESET_DESCRIPTIONS,
  PRESET_TO_MANIFEST,
  STABLE_VERSIONS,
  STANDALONE_INJECT_DEVDEPS,
  TEMPLATE_DIR,
} from './constants';
export {
  copyDir,
  findMonorepoRoot,
  getScriptDir,
  resolveTemplateDir,
  rewriteFile,
} from './fs';
export {
  contentHeading,
  contentNoun,
  contentSingular,
  contentTypeName,
  slugify,
  titleCase,
} from './helpers';
export { describeVersionSource, resolveSubstrateVersion } from './version';
