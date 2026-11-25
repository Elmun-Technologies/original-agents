import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  // server modules start with `import 'server-only'`, which throws outside a Next server build
  resolve: { alias: { 'server-only': new URL('./tests/int/empty.ts', import.meta.url).pathname } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    // the files share one database (Payload pushes the schema on first connect): one at a time
    fileParallelism: false,
  },
})
