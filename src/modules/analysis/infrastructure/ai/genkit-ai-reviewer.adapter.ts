import type { AiImageInput, AiReviewer, AiReviewOutcome } from '../../domain/ai-reviewer.interface.js';
import { imageAltReviewFlow } from '../../../../genkit/flows/image-alt-review.flow.js';
import { imageContainsTextFlow } from '../../../../genkit/flows/image-contains-text.flow.js';
import { imageDecorativeFlow } from '../../../../genkit/flows/image-decorative.flow.js';
import { imageToModelInput } from '../../../../genkit/media.js';
import type { AiResult } from '../../../../genkit/schemas.js';

const FALLBACK: AiReviewOutcome = {
  estado: 'REVISION_PENDIENTE',
  confianza: null,
  problema: null,
  recomendacion: 'No se pudo leer la imagen para la revisión por IA; revisar manualmente.',
};

function toOutcome(result: AiResult): AiReviewOutcome {
  return {
    estado: result.estado,
    confianza: result.confianza,
    problema: result.problema,
    recomendacion: result.recomendacion,
  };
}

/**
 * Adaptador de infraestructura del puerto `AiReviewer` (docs 0005 §7): llama
 * al flow de Genkit correspondiente pasándole la imagen como entrada mínima
 * (nunca el HTML completo). Las imágenes públicas se envían por URL (las
 * descarga el proveedor de IA) y las locales embebidas en base64; ver
 * `imageToModelInput`.
 */
export class GenkitAiReviewer implements AiReviewer {
  async reviewAltText(input: AiImageInput & { alt: string }): Promise<AiReviewOutcome> {
    return this.run(input, (imageUrl) =>
      imageAltReviewFlow({ imageUrl, elemento: input.elemento, alt: input.alt }),
    );
  }

  async reviewContainsText(input: AiImageInput): Promise<AiReviewOutcome> {
    return this.run(input, (imageUrl) =>
      imageContainsTextFlow({ imageUrl, elemento: input.elemento, context: input.context }),
    );
  }

  async reviewDecorative(input: AiImageInput): Promise<AiReviewOutcome> {
    return this.run(input, (imageUrl) =>
      imageDecorativeFlow({ imageUrl, elemento: input.elemento, context: input.context }),
    );
  }

  private async run(
    input: AiImageInput,
    call: (imageUrl: string) => Promise<AiResult>,
  ): Promise<AiReviewOutcome> {
    try {
      const imageUrl = await imageToModelInput(input.imagePath, input.mimeType);
      const result = await call(imageUrl);
      return toOutcome(result);
    } catch (error) {
      // La IA nunca bloquea el análisis (docs 0005 §4): ante cualquier fallo
      // devuelve REVISION_PENDIENTE, pero se registra para poder diagnosticarlo.
      console.error(`[ai-review] fallo revisando ${input.elemento} (${input.imagePath}):`, error);
      return FALLBACK;
    }
  }
}
