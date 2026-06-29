import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Tests are pure logic (classifier + zustand store) — no DOM needed. The
    // store guards its localStorage access, so the Node environment is fine.
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
