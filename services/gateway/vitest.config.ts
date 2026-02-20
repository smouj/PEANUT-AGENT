import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      exclude: [
        'dist/**',
        'tests/**',
        'src/server.ts',
        'src/infrastructure/tracing/**',
        'src/application/services/docker.service.ts',
        'src/infrastructure/kilo/kilo.client.ts',
        'src/interfaces/ws/terminal.handler.ts',
        'vitest.config.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@domain': resolve(__dirname, './src/domain'),
      '@app': resolve(__dirname, './src/application'),
      '@infra': resolve(__dirname, './src/infrastructure'),
      '@interfaces': resolve(__dirname, './src/interfaces'),
    },
  },
});
