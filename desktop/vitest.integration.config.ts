import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Integration tests talk to real database servers started with
// test/integration/docker-compose.yml. Each suite skips itself unless its
// NQ_IT_* environment variable is set, so this never touches a personal or
// production database by accident.
export default defineConfig({
  resolve: {
    alias: [{ find: /^@shared\//, replacement: `${path.resolve(__dirname, 'src/shared')}/` }],
  },
  test: {
    include: ['test/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120000,
    hookTimeout: 180000,
    fileParallelism: false,
  },
})
