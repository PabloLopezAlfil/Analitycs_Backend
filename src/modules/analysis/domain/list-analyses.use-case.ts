import type {
  AnalysisFilter,
  AnalysisRepository,
} from '../infrastructure/persistence/analysis.repository.js';
import type { AnalysisSummaryInterface } from './check.interface.js';

/**
 * Caso de uso: listar análisis (histórico), opcionalmente filtrados por
 * documento HTML.
 */
export class ListAnalysesUseCase {
  constructor(private readonly repository: AnalysisRepository) {}

  execute(filter?: AnalysisFilter): Promise<AnalysisSummaryInterface[]> {
    return this.repository.findAll(filter);
  }
}
