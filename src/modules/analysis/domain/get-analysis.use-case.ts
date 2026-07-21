import { NotFoundError } from './errors.js';
import type { AnalysisInterface } from './check.interface.js';
import type { AnalysisRepository } from '../infrastructure/persistence/analysis.repository.js';

/**
 * Caso de uso: recuperar el detalle de un análisis existente.
 */
export class GetAnalysisUseCase {
  constructor(private readonly repository: AnalysisRepository) {}

  async execute(id: number): Promise<AnalysisInterface> {
    if (!Number.isInteger(id)) {
      throw new NotFoundError('Análisis no encontrado');
    }

    const analysis = await this.repository.findById(id);

    if (!analysis) {
      throw new NotFoundError('Análisis no encontrado');
    }

    return analysis;
  }
}
