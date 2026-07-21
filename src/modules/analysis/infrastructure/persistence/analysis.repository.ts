import type {
  AnalysisInterface,
  AnalysisSummaryInterface,
  CheckInput,
} from '../../domain/check.interface.js';

/** Datos para persistir un análisis completo (checks + findings). */
export interface SaveAnalysisInput {
  htmlId: number;
  score: number | null;
  checks: CheckInput[];
}

/** Filtro opcional del listado de análisis. */
export interface AnalysisFilter {
  htmlId?: number;
}

/**
 * Puerto de persistencia de análisis. La infraestructura provee la
 * implementación concreta (Prisma/MySQL).
 */
export interface AnalysisRepository {
  save(input: SaveAnalysisInput): Promise<AnalysisInterface>;
  findAll(filter?: AnalysisFilter): Promise<AnalysisSummaryInterface[]>;
  findById(id: number): Promise<AnalysisInterface | null>;
}
