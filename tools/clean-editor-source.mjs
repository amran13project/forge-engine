import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDirs = [
  path.join(root, 'apps', 'editor', 'src'),
  path.join(root, 'packages'),
];

const removable = new Set(['.js', '.jsx', '.d.ts', '.tsbuildinfo']);

async function clean(dir) {
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      await clean(full);
      continue;
    }
    const ext = entry.name.endsWith('.tsbuildinfo') ? '.tsbuildinfo' : path.extname(entry.name);
    if (removable.has(ext)) await fs.rm(full, { force: true });
  }
}

for (const dir of sourceDirs) await clean(dir);
console.log('[Forge] Cleaned stale TypeScript build artifacts from source directories.');
