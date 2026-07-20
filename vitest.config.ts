import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Alias estable para mockear el borde de datos sin rutas relativas frágiles:
  // en los tests se usa `vi.mock('@db/prisma')`, inmune a mover archivos de test.
  resolve: {
    alias: {
      '@db/prisma': fileURLToPath(new URL('./src/db/prisma.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      JWT_SECRET: 'test-secret',
    },
  },
});
