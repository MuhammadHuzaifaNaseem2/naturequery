import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@shared\//, replacement: `${path.resolve(__dirname, 'src/shared')}/` },
      { find: /^@renderer\//, replacement: `${path.resolve(__dirname, 'src/renderer')}/` },
    ],
  },
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
  },
})
