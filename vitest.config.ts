import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@forge/core': path.resolve(__dirname, 'packages/core/src'), '@forge/shared': path.resolve(__dirname, 'packages/shared/src') } },
  test: { environment: 'node' },
});
