import type { UploadRepository } from '../infrastructure/persistence/upload.repository.js';
import type { UploadSummaryInterface } from './upload.interface.js';

/**
 * Caso de uso: listar todas las subidas (resumen, sin las relaciones anidadas).
 */
export class ListUploadsUseCase {
  constructor(private readonly repository: UploadRepository) {}

  execute(): Promise<UploadSummaryInterface[]> {
    return this.repository.findAll();
  }
}
