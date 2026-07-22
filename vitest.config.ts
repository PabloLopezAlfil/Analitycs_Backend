import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Alias estable para mockear el borde de datos sin rutas relativas frágiles:
  // en los tests se usa `vi.mock('@db/prisma')`, inmune a mover archivos de test.
  resolve: {
    alias: {
      '@db/prisma': fileURLToPath(new URL('./src/db/prisma.ts', import.meta.url)),
      // Ídem para los flows de IA: permite mockearlos por una ruta estable
      // (docs 0005 §7) sin depender de la ubicación del test que los mockea.
      '@genkit/image-alt-review': fileURLToPath(
        new URL('./src/genkit/flows/image-alt-review.flow.ts', import.meta.url),
      ),
      '@genkit/image-contains-text': fileURLToPath(
        new URL('./src/genkit/flows/image-contains-text.flow.ts', import.meta.url),
      ),
      '@genkit/image-decorative': fileURLToPath(
        new URL('./src/genkit/flows/image-decorative.flow.ts', import.meta.url),
      ),
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
