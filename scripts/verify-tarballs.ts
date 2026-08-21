// verify-tarballs.ts — Pre-publish verification for all @substrate-platform/* packages.
//
// For each package, runs `npm pack --dry-run` and verifies:
//   1. No .ts/.tsx source files in the tarball (only dist + assets)
//   2. No test files
//   3. main / types / exports point to dist/
//   4. files field exists
//   5. package.json is valid
//   6. No workspace:* in dependencies (only with --prerelease flag)
//   7. Version is a canary prerelease (only with --prerelease flag)
//
// Usage:
//   bun run scripts/verify-tarballs.ts           # check dist/exports only
//   bun run scripts/verify-tarballs.ts --prerelease  # also check workspace:* and canary version
import { execSync } from 'node:child_process';

const PRERELEASE = process.argv.includes('--prerelease');
const PACKAGES = [
  { dir: 'packages/contracts', name: 'contracts' },
  { dir: 'packages/config', name: 'config' },
  { dir: 'packages/tokens', name: 'tokens' },
  { dir: 'crates/wasm/pkg', name: 'wasm' },
  { dir: 'packages/ui', name: 'ui' },
  { dir: 'packages/site', name: 'site' },
  { dir: 'packages/content', name: 'content' },
  { dir: 'packages/db', name: 'db' },
  { dir: 'packages/edge', name: 'edge' },
  { dir: 'packages/ai', name: 'ai' },
  { dir: 'packages/graphics', name: 'graphics' },
  { dir: 'packages/observability', name: 'observability' },
];

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(pkgDir: string, pkgName: string, version: string) {
  const issues: string[] = [];

  // Run npm pack --dry-run --json to get tarball contents
  const output = execSync('npm pack --dry-run --json', {
    cwd: pkgDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const data = JSON.parse(output);
  const files: string[] = data[0]?.files?.map((f: { path: string }) => f.path) ?? [];

  if (files.length === 0) {
    issues.push('No files in tarball');
  }

  // Read package.json to verify metadata
  const pkg = JSON.parse(
    execSync(
      `node -e "process.stdout.write(JSON.stringify(require('./${pkgDir}/package.json')))"`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    ),
  );

  // Determine if this package ships TS source instead of compiled dist
  const shipsSource = pkg.scripts?.build?.includes('echo') || pkg.main?.startsWith('./src/');

  // Check for .ts/.tsx source files (should NOT be in tarball, except .d.ts)
  // Skip for packages that intentionally ship TS source (e.g., graphics).
  if (!shipsSource) {
    const srcFiles = files.filter((f) => f.match(/\.tsx?$/) && !f.endsWith('.d.ts'));
    if (srcFiles.length > 0) {
      issues.push(`Source .ts/.tsx files in tarball: ${srcFiles.join(', ')}`);
    }
  }

  // Check for test files
  const testFiles = files.filter((f) => f.includes('.test.') || f.includes('__tests__'));
  if (testFiles.length > 0) {
    issues.push(`Test files in tarball: ${testFiles.join(', ')}`);
  }

  // Check for storybook files
  const storybookFiles = files.filter((f) => f.includes('.stories.') || f.includes('storybook'));
  if (storybookFiles.length > 0) {
    issues.push(`Storybook files in tarball: ${storybookFiles.join(', ')}`);
  }

  // Check files field
  if (!pkg.files || !Array.isArray(pkg.files) || pkg.files.length === 0) {
    issues.push('No files field in package.json');
  }

  // Check main points to dist/build (skip for packages that ship TS source
  // or WASM packages whose main is a generated .js file).
  const isWasmPkg =
    pkg.main?.endsWith('.js') && pkg.files?.some((f: string) => f.endsWith('.wasm'));
  if (
    pkg.main &&
    !shipsSource &&
    !isWasmPkg &&
    !pkg.main.startsWith('./dist/') &&
    !pkg.main.startsWith('./build/')
  ) {
    issues.push(`main does not point to dist/build: ${pkg.main}`);
  }

  // Check types points to dist (skip for packages that ship TS source
  // or WASM packages whose types is a generated .d.ts file).
  if (
    pkg.types &&
    !shipsSource &&
    !isWasmPkg &&
    !pkg.types.startsWith('./dist/') &&
    !pkg.types.startsWith('./build/')
  ) {
    issues.push(`types does not point to dist/build: ${pkg.types}`);
  }

  // Check exports point to dist
  if (pkg.exports) {
    for (const [key, val] of Object.entries(pkg.exports)) {
      if (typeof val === 'string') {
        // CSS/JSON exports are OK
        if (val.endsWith('.css') || val.endsWith('.json')) continue;
        if (!val.startsWith('./dist/') && !val.startsWith('./build/')) {
          issues.push(`exports["${key}"] does not point to dist: ${val}`);
        }
      } else if (typeof val === 'object' && val !== null) {
        const v = val as { import?: string; types?: string };
        if (v.import && !v.import.startsWith('./dist/') && !v.import.startsWith('./build/')) {
          issues.push(`exports["${key}"].import does not point to dist: ${v.import}`);
        }
        if (v.types && !v.types.startsWith('./dist/') && !v.types.startsWith('./build/')) {
          issues.push(`exports["${key}"].types does not point to dist: ${v.types}`);
        }
      }
    }
  }

  // Check for workspace:* in dependencies (only in prerelease mode)
  if (PRERELEASE) {
    for (const depSection of ['dependencies', 'devDependencies', 'peerDependencies']) {
      if (pkg[depSection]) {
        for (const [name, version] of Object.entries(pkg[depSection]) as [string, string][]) {
          if (version === 'workspace:*' || version.startsWith('workspace:')) {
            issues.push(`${depSection}["${name}"] still uses workspace: ${version}`);
          }
        }
      }
    }

    // Check version is a canary prerelease
    if (!version.includes('-canary.')) {
      issues.push(`Version is not a canary prerelease: ${version}`);
    }
  }

  // Check private is not true (must be publishable)
  if (pkg.private === true) {
    issues.push('package.json has private: true — will not publish');
  }

  // Report
  if (issues.length > 0) {
    fail++;
    failures.push(`  FAIL  ${pkgName}@${version}`);
    for (const issue of issues) {
      failures.push(`        ${issue}`);
    }
  } else {
    pass++;
    console.log(`  PASS  ${pkgName}@${version}  (${files.length} files)`);
  }
}

console.log('\n=== Tarball Metadata Verification (12 packages) ===\n');

for (const { dir } of PACKAGES) {
  const pkgJson = JSON.parse(
    execSync(`node -e "process.stdout.write(JSON.stringify(require('./${dir}/package.json')))"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }),
  );
  check(dir, pkgJson.name, pkgJson.version);
}

console.log('');
if (failures.length > 0) {
  console.log('FAILURES:\n');
  for (const f of failures) {
    console.log(f);
  }
  console.log(`\n${fail} package(s) failed, ${pass} passed.`);
  process.exit(1);
} else {
  console.log(`All ${pass} packages passed tarball verification.`);
}
