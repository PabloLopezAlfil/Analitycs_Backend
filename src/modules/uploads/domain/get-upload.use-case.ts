import type { UploadRepository } from '../infrastructure/persistence/upload.repository.js';
import type { UploadInterface } from './upload.interface.js';
import { NotFoundError } from './errors.js';

/**
 * Caso de uso: obtener el detalle completo de una subida (con sus
 * html_documents e images). Lanza NotFoundError si no existe.
 */
export class GetUploadUseCase {
  constructor(private readonly repository: UploadRepository) {}

  async execute(id: number): Promise<UploadInterface> {
    const upload = await this.repository.findById(id);
    if (!upload) {
      throw new NotFoundError('Subida no encontrada');
    }
    return upload;
  }
}
