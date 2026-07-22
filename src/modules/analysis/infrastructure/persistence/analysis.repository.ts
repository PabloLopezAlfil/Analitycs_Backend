import type {
  AnalysisInterface,
  AnalysisSummaryInterface,
  CheckInput,
  CheckStatus,
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
  limit?: number;
}

/** Veredicto de IA a persistir sobre un finding concreto (docs 0005 §7). */
export interface AiFindingReviewInput {
  findingId: number;
  aiStatus: string;
  aiConfidence: string | null;
  aiProblem: string | null;
  aiRecommendation: string;
}

/** Estado agregado a persistir sobre un check tras revisar sus findings. */
export interface AiCheckUpdateInput {
  checkId: number;
  status: CheckStatus;
  message: string;
}

/** Datos para aplicar una revisión por IA sobre un análisis existente. */
export interface ApplyAiReviewInput {
  analysisId: number;
  score: number | null;
  findings: AiFindingReviewInput[];
  checks: AiCheckUpdateInput[];
}

/**
 * Puerto de persistencia de análisis. La infraestructura provee la
 * implementación concreta (Prisma/MySQL).
 */
export interface AnalysisRepository {
  save(input: SaveAnalysisInput): Promise<AnalysisInterface>;
  findAll(filter?: AnalysisFilter): Promise<AnalysisSummaryInterface[]>;
  findById(id: number): Promise<AnalysisInterface | null>;
  applyAiReview(input: ApplyAiReviewInput): Promise<AnalysisInterface>;
}
