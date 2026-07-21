/** Estados de evaluación de una regla (ver documentación 0004 §3). */
export type CheckStatus = 'OK' | 'ERROR' | 'AVISO' | 'VALIDADO_IA' | 'REVISION_PENDIENTE';

/** Categorías de criterios (ver documentación 0003/0004 §7). */
export type CheckCategory =
  | 'STRUCTURE'
  | 'IMAGES'
  | 'TYPOGRAPHY'
  | 'COLOR_CONTRAST'
  | 'LINKS_BUTTONS'
  | 'RESPONSIVE_CSS';

/** Ocurrencia concreta de un problema dentro del HTML. */
export interface FindingInput {
  location: string;
  evidence: string;
}

/** Resultado de una regla evaluada (lo que producen los analizadores). */
export interface CheckInput {
  rule: string;
  category: CheckCategory;
  status: CheckStatus;
  message: string;
  findings: FindingInput[];
}

// --- Agregado que se devuelve hacia el exterior ---

export interface AnalysisFindingInterface {
  id: number;
  location: string;
  evidence: string;
}

export interface AnalysisCheckInterface {
  id: number;
  rule: string;
  category: string;
  status: string;
  message: string;
  findings: AnalysisFindingInterface[];
}

export interface AnalysisInterface {
  id: number;
  htmlId: number;
  score: number | null;
  createdAt: string;
  checks: AnalysisCheckInterface[];
}

/** Resumen de un análisis para el listado (sin los checks; ver documentación 0004 §8). */
export interface AnalysisSummaryInterface {
  id: number;
  htmlId: number;
  score: number | null;
  createdAt: string;
}
