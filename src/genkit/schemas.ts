import { z } from 'genkit';

/** Niveles de confianza que puede declarar la IA. */
export const ConfidenceSchema = z.enum(['alta', 'media', 'baja']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/**
 * Salida estructurada que se pide al MODELO (docs/0005 §4). El resto de campos
 * del resultado (criterio, estado, elemento, requiere_revision) los añade el
 * backend de forma determinista: la IA no decide su propio estado.
 */
export const AiModelOutputSchema = z.object({
  cumple: z.boolean().describe('true si el criterio evaluado se cumple'),
  confianza: ConfidenceSchema.describe('Confianza en el veredicto: alta, media o baja'),
  problema: z
    .string()
    .nullable()
    .describe('Descripción breve del problema detectado, o null si el criterio se cumple'),
  recomendacion: z.string().describe('Recomendación breve y accionable, en castellano'),
});

export type AiModelOutput = z.infer<typeof AiModelOutputSchema>;

/** Estados posibles del resultado de una validación por IA (docs/0005 §4). */
export const AiResultStatusSchema = z.enum(['VALIDADO_IA', 'INCUMPLE', 'REVISION_PENDIENTE']);

/**
 * Respuesta estructurada final que devuelve cada flow. INCUMPLE lo traduce el
 * módulo de análisis a ERROR o AVISO según la regla (docs/0004 §7).
 */
export const AiResultSchema = z.object({
  criterio: z.string().describe('Criterio evaluado, p. ej. imagen_alt'),
  estado: AiResultStatusSchema,
  confianza: ConfidenceSchema.nullable().describe('null si la IA no respondió'),
  elemento: z.string().describe('Elemento analizado, p. ej. banner-principal.jpg'),
  problema: z.string().nullable(),
  recomendacion: z.string(),
  requiere_revision: z.boolean(),
});

export type AiResult = z.infer<typeof AiResultSchema>;

const CONFIDENCE_RANK: Record<Confidence, number> = { baja: 0, media: 1, alta: 2 };

export const DEFAULT_MIN_CONFIDENCE: Confidence = 'media';

/** Confianza mínima exigida para aceptar un veredicto (AI_MIN_CONFIDENCE). */
export function minConfidence(): Confidence {
  const value = process.env.AI_MIN_CONFIDENCE;
  return value === 'alta' || value === 'media' || value === 'baja'
    ? value
    : DEFAULT_MIN_CONFIDENCE;
}

/**
 * Construye el resultado final a partir de la salida del modelo (docs/0005 §4):
 * confianza suficiente y cumple → VALIDADO_IA; confianza suficiente y no
 * cumple → INCUMPLE; confianza insuficiente, respuesta inválida o fallo
 * técnico → REVISION_PENDIENTE (la IA nunca bloquea el análisis).
 */
export function buildAiResult(
  meta: { criterio: string; elemento: string },
  output: AiModelOutput | null | undefined,
  minimo: Confidence = minConfidence(),
): AiResult {
  if (!output) {
    return {
      criterio: meta.criterio,
      estado: 'REVISION_PENDIENTE',
      confianza: null,
      elemento: meta.elemento,
      problema: null,
      recomendacion: 'La IA no devolvió una respuesta válida; revisar manualmente.',
      requiere_revision: true,
    };
  }

  if (CONFIDENCE_RANK[output.confianza] < CONFIDENCE_RANK[minimo]) {
    return {
      criterio: meta.criterio,
      estado: 'REVISION_PENDIENTE',
      confianza: output.confianza,
      elemento: meta.elemento,
      problema: output.problema,
      recomendacion: output.recomendacion,
      requiere_revision: true,
    };
  }

  return {
    criterio: meta.criterio,
    estado: output.cumple ? 'VALIDADO_IA' : 'INCUMPLE',
    confianza: output.confianza,
    elemento: meta.elemento,
    problema: output.problema,
    recomendacion: output.recomendacion,
    requiere_revision: false,
  };
}
