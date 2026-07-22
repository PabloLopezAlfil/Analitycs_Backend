/** Niveles de confianza que puede declarar la IA (docs 0005 §4). */
export type AiConfidence = 'alta' | 'media' | 'baja';

/** Veredicto de una revisión por IA sobre un finding concreto (docs 0005 §4). */
export type AiVerdict = 'VALIDADO_IA' | 'INCUMPLE' | 'REVISION_PENDIENTE';

/** Entrada mínima de un caso de uso de IA sobre una imagen (docs 0005 §2). */
export interface AiImageInput {
  elemento: string;
  imagePath: string;
  mimeType: string | null;
  context?: string;
}

/** Resultado de la revisión de un finding concreto. */
export interface AiReviewOutcome {
  estado: AiVerdict;
  confianza: AiConfidence | null;
  problema: string | null;
  recomendacion: string;
}

/**
 * Puerto de validación por IA (docs 0005 §6): un método por caso de uso
 * conectado al catálogo de reglas (0005 §7). El dominio no depende de Genkit;
 * la infraestructura provee el adaptador concreto.
 */
export interface AiReviewer {
  reviewAltText(input: AiImageInput & { alt: string }): Promise<AiReviewOutcome>;
  reviewContainsText(input: AiImageInput): Promise<AiReviewOutcome>;
  reviewDecorative(input: AiImageInput): Promise<AiReviewOutcome>;
}
