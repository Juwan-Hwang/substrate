// pack-all.ts — Pack all platform packages and copy tgz to target dir.

import { execSync } from 'node:child_process';
import { copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGES = [
  'contracts',
  'config',
  'tokens',
  'ui',
  'site',
  'content',
  'db',
  'edge',
  'ai',
  'graphics',
  'observability',
];
const TARGET = 'E:\\tmp\\substrate-external-test\\local-pkgs';

for (const pkg of PACKAGES) {
  const pkgDir = join('packages', pkg);
  console.log(`Packing @substrate-platform/${pkg}...`);
  execSync('npm pack', { cwd: pkgDir, stdio: 'pipe' });
  // Find and copy the tgz
  const entries = readdirSync(pkgDir);
  const tgz = entries.find((f) => f.startsWith('substrate-') && f.endsWith('.tgz'));
  if (tgz) {
    const src = join(pkgDir, tgz);
    const dest = join(TARGET, tgz);
    copyFileSync(src, dest);
    console.log(`  → ${dest}`);
  }
}
console.log('Done.');
