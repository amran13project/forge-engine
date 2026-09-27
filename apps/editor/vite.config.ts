import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const editorRoot = import.meta.dirname;
const repoRoot = path.resolve(editorRoot, '../..');

export default defineConfig({
  root: editorRoot,
  plugins: [react()],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      // Resolve workspace packages directly from source during development so Vite never
      // depends on stale/missing dist folders. TypeScript builds still validate packages.
      '@forge/core': path.resolve(repoRoot, 'packages/core/src/index.ts'),
      '@forge/shared': path.resolve(repoRoot, 'packages/shared/src/index.ts'),
      '@forge/renderer-three': path.resolve(repoRoot, 'packages/renderer-three/src/index.ts'),
      '@forge/renderer-2d': path.resolve(repoRoot, 'packages/renderer-2d/src/index.ts'),
    },
  },
  server: { port: 5173, strictPort: true, fs: { allow: [repoRoot] } },
  build: { outDir: path.resolve(editorRoot, 'dist'), emptyOutDir: true },
});
