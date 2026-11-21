import { defineConfig } from 'vitest/config';

// Las pruebas van contra la rama dev de Neon: cada petición viaja por internet.
export default defineConfig({
  test: { testTimeout: 30_000, hookTimeout: 30_000, fileParallelism: false },
});
