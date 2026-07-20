import { z } from 'genkit';
import { ai, currentModel } from '../ai.js';
import { AiModelOutputSchema, AiResultSchema, buildAiResult } from '../schemas.js';

const InputSchema = z.object({
  imageUrl: z.string().describe('URL pública o data URL de la imagen'),
  elemento: z.string().describe('Identificador del elemento analizado, p. ej. banner-principal.jpg'),
  alt: z.string().describe('Valor actual del atributo alt de la imagen'),
});

const PROMPT = `Eres un revisor de accesibilidad de emails HTML (WCAG 2.1 AA).
Compara la imagen adjunta con su atributo alt y determina si el alt describe
correctamente el contenido y la función de la imagen (no vale un texto
genérico como "imagen" o "banner", ni una descripción que no se corresponda).

Criterio evaluado: "el atributo alt describe correctamente la imagen".
- cumple = true si el alt es una descripción adecuada y útil.
- cumple = false si el alt es genérico, engañoso o insuficiente; describe en "problema" por qué.
Indica tu confianza (alta, media o baja) y una recomendación breve en castellano.`;

/**
 * Caso de uso 0005 §3 → reglas IMG_GENERIC_ALT / IMG_LINKED_NO_ALT (0004 §7):
 * revisar si un atributo alt describe correctamente la imagen.
 * Nunca lanza: ante cualquier fallo devuelve REVISION_PENDIENTE.
 */
export const imageAltReviewFlow = ai.defineFlow(
  {
    name: 'imageAltReview',
    inputSchema: InputSchema,
    outputSchema: AiResultSchema,
  },
  async (input) => {
    const meta = { criterio: 'imagen_alt', elemento: input.elemento };
    try {
      const { output } = await ai.generate({
        model: currentModel(),
        prompt: [
          { text: `${PROMPT}\n\nAtributo alt a evaluar: "${input.alt}"` },
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
