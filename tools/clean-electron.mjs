import { rm } from 'node:fs/promises';
for (const target of ['electron/dist', 'electron/tsconfig.tsbuildinfo']) {
  await rm(target, { recursive: true, force: true });
}
console.log('Cleaned Electron build output.');
