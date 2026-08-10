import { defineConfig } from 'vite';

export default defineConfig({
  base: '/TD-Codex/',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
});
