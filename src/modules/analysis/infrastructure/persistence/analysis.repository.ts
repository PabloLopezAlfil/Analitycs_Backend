import type { AnalysisInterface, CheckInput } from '../../domain/check.interface.js';

/** Datos para persistir un análisis completo (checks + findings). */
export interface SaveAnalysisInput {
  htmlId: number;
  score: number | null;
  checks: CheckInput[];
}

/**
 * Puerto de persistencia de análisis. La infraestructura provee la
 * implementación concreta (Prisma/MySQL).
 */
export interface AnalysisRepository {
  save(input: SaveAnalysisInput): Promise<AnalysisInterface>;
}
