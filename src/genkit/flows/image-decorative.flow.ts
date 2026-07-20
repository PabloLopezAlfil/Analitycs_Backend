import { z } from 'genkit';
import { ai, currentModel } from '../ai.js';
import { AiModelOutputSchema, AiResultSchema, buildAiResult } from '../schemas.js';

const InputSchema = z.object({
  imageUrl: z.string().describe('URL pública o data URL de la imagen'),
  elemento: z.string().describe('Identificador del elemento analizado, p. ej. separador.png'),
  context: z.string().optional().describe('Contexto opcional del email (texto cercano a la imagen)'),
});

const PROMPT = `Eres un revisor de accesibilidad de emails HTML (WCAG 2.1 AA).
La imagen adjunta tiene el atributo alt VACÍO (alt=""), lo que indica al lector
de pantalla que es decorativa y debe ignorarse. Determina si esa decisión es
correcta: una imagen es decorativa si no aporta información (separadores,
fondos, adornos); es informativa si transmite contenido que el usuario
perdería (productos, ofertas, gráficos, instrucciones).

Criterio evaluado: "la imagen es decorativa y el alt vacío es correcto".
- cumple = true si la imagen es decorativa (el alt vacío es adecuado).
- cumple = false si la imagen es informativa; describe en "problema" qué información transmite.
Indica tu confianza (alta, media o baja) y una recomendación breve en castellano.`;

/**
 * Caso de uso 0005 §3 → regla IMG_EMPTY_ALT_SUSPECT (0004 §7):
 * determinar si una imagen con alt vacío es decorativa o informativa.
 * Nunca lanza: ante cualquier fallo devuelve REVISION_PENDIENTE.
 */
export const imageDecorativeFlow = ai.defineFlow(
  {
    name: 'imageDecorative',
    inputSchema: InputSchema,
    outputSchema: AiResultSchema,
  },
  async (input) => {
    const meta = { criterio: 'imagen_decorativa', elemento: input.elemento };
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
