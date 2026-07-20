import { z } from 'genkit';
import { ai, currentModel } from '../ai.js';
import { AiModelOutputSchema, AiResultSchema, buildAiResult } from '../schemas.js';

const InputSchema = z.object({
  imageUrl: z.string().describe('URL pública o data URL de la imagen'),
  elemento: z.string().describe('Identificador del elemento analizado, p. ej. banner-principal.jpg'),
  context: z.string().optional().describe('Contexto opcional del email (asunto, texto cercano…)'),
});

const PROMPT = `Eres un revisor de accesibilidad de emails HTML (WCAG 2.1 AA).
Analiza la imagen adjunta y determina si contiene TEXTO IMPORTANTE incrustado
(ofertas, precios, fechas, códigos de descuento, llamadas a la acción o
cualquier información que el usuario necesitaría leer y que no estaría
disponible para un lector de pantalla).

Criterio evaluado: "la imagen no contiene texto importante incrustado".
- cumple = true si la imagen NO contiene texto importante (decoración, fotos, logos simples).
- cumple = false si la imagen SÍ contiene texto importante; describe en "problema" qué texto contiene.
Indica tu confianza (alta, media o baja) y una recomendación breve en castellano.`;

/**
 * Caso de uso 0005 §3 → regla IMG_TEXT_IN_IMAGE (0004 §7):
 * determinar si una imagen contiene texto importante.
 * Nunca lanza: ante cualquier fallo devuelve REVISION_PENDIENTE.
 */
export const imageContainsTextFlow = ai.defineFlow(
  {
    name: 'imageContainsText',
    inputSchema: InputSchema,
    outputSchema: AiResultSchema,
  },
  async (input) => {
    const meta = { criterio: 'imagen_texto', elemento: input.elemento };
    try {
      const { output } = await ai.generate({
        model: currentModel(),
        prompt: [
          { text: input.context ? `${PROMPT}\n\nContexto del email: ${input.context}` : PROMPT },
          { media: { url: input.imageUrl } },
        ],
        output: { schema: AiModelOutputSchema },
      });
      return buildAiResult(meta, output);
    } catch {
      return buildAiResult(meta, null);
    }
  },
);
