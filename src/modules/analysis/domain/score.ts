import type { CheckStatus } from './check.interface.js';

// Puntos por estado (documentación 0004 §4). REVISION_PENDIENTE no aparece:
// queda fuera del cálculo (ni suma ni penaliza).
const POINTS: Partial<Record<CheckStatus, number>> = {
  OK: 1,
  VALIDADO_IA: 1,
  AVISO: 0.5,
  ERROR: 0,
};

/**
 * Score 0–100 del análisis: porcentaje de puntos sobre las reglas puntuables.
 * Devuelve null si ninguna regla es puntuable. Acepta cualquier check con
 * `status` (checks recién evaluados o checks ya persistidos tras una
 * revisión por IA, docs 0005 §7).
 */
export function computeScore(checks: { status: CheckStatus }[]): number | null {
  const scorable = checks.filter((check) => POINTS[check.status] !== undefined);
  if (scorable.length === 0) {
    return null;
  }
  const points = scorable.reduce((sum, check) => sum + (POINTS[check.status] ?? 0), 0);
  return Math.round((100 * points) / scorable.length);
}
