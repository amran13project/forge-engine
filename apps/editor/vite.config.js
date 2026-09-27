import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const editorRoot = import.meta.dirname;
export default defineConfig({
    root: editorRoot,
    plugins: [react()],
    resolve: {
        alias: {
            '@forge/core': path.resolve(editorRoot, '../../packages/core/src'),
            '@forge/shared': path.resolve(editorRoot, '../../packages/shared/src'),
            '@forge/renderer-three': path.resolve(editorRoot, '../../packages/renderer-three/src'),
            '@forge/renderer-2d': path.resolve(editorRoot, '../../packages/renderer-2d/src'),
        },
    },
    server: { port: 5173, strictPort: true },
    build: { outDir: path.resolve(editorRoot, 'dist'), emptyOutDir: true },
});
