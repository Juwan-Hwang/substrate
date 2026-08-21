// replace-workspace-deps.ts — Replace workspace:* with semver ranges.
//
// Run AFTER `changeset version` but BEFORE `npm publish`.
// Changesets v3 does not replace workspace:* in `dependencies` during
// `changeset version` — it only does so during `changeset publish`.
// Since we publish manually (npm publish --provenance), we need to
// handle this step ourselves.
//
// For each package in packages/*, finds all @substrate-platform/* dependencies
// using workspace:* protocol and replaces them with the version from
// the corresponding package.json.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

// Build a map of package name → version from all packages/*/package.json
// and crates/wasm/pkg/package.json.
const versionMap = new Map<string, string>();

const scanDirs = ['packages', 'crates/wasm/pkg'];
for (const scanDir of scanDirs) {
  try {
    const entries = readdirSync(scanDir);
    for (const entry of entries) {
      const fullPath = `${scanDir}/${entry}`;
      const pkgJsonPath = statSync(fullPath)?.isDirectory()
        ? `${fullPath}/package.json`
        : entry === 'package.json'
          ? fullPath
          : null;
      if (!pkgJsonPath) continue;
      try {
        const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
        if (pkg.name && pkg.version) {
          versionMap.set(pkg.name, pkg.version);
        }
      } catch {
        // skip
      }
    }
  } catch {
    // skip non-existent dirs
  }
}

console.log(`Found ${versionMap.size} packages with versions:`);
for (const [name, version] of versionMap) {
  console.log(`  ${name} → ${version}`);
}

// For each package, replace workspace:* in dependencies
let replaced = 0;
const pkgDir = 'packages';
for (const dir of readdirSync(pkgDir)) {
  const fullPath = `${pkgDir}/${dir}`;
  if (!statSync(fullPath).isDirectory()) continue;
  const pkgJsonPath = `${fullPath}/package.json`;
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
  } catch {
    continue;
  }

  let modified = false;
  for (const depSection of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const deps = pkg[depSection] as Record<string, string> | undefined;
    if (!deps) continue;
    for (const [depName, depVersion] of Object.entries(deps)) {
      if (depVersion === 'workspace:*' || depVersion.startsWith('workspace:')) {
        const resolvedVersion = versionMap.get(depName);
        if (resolvedVersion) {
          // Use ^range for prerelease (allows canary.0, canary.1, etc.)
          // and ^range for stable.
          deps[depName] = `^${resolvedVersion}`;
          replaced++;
          modified = true;
          console.log(`  ${pkg.name}/${depSection}: ${depName} workspace:* → ^${resolvedVersion}`);
        } else {
          console.warn(
            `  ⚠ ${pkg.name}/${depSection}: ${depName} uses workspace:* but no version found`,
          );
        }
      }
    }
  }

  if (modified) {
    writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }
}

console.log(`\nReplaced ${replaced} workspace:* references with semver ranges.`);
