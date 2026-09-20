import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the static build works from any path (GitHub Pages, file server).
  base: './',
  test: {
    include: ['tests/{engine,editor,chart}/**/*.test.ts'],
  },
});
