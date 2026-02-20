import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
      include: ['src/lib/**'],
      exclude: [
        'dist/**', '.next/**', 'tests/**',
        '**/*.config.ts', '**/globals.css',
        // Next.js page and component files require the Next.js runtime
        // (cookies, headers, navigation) and are excluded from vitest coverage.
        // They are validated by TypeScript type checking instead.
        'src/app/**',
        'src/components/**',
        'src/lib/auth.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
