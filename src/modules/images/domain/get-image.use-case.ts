import type { ImageRepository } from '../infrastructure/persistence/image.repository.js';
import type { ImageInterface } from './image.interface.js';
import { NotFoundError } from './errors.js';

/**
 * Caso de uso: obtener el detalle de una imagen. Lanza NotFoundError si no existe.
 */
export class GetImageUseCase {
  constructor(private readonly repository: ImageRepository) {}

  async execute(id: number): Promise<ImageInterface> {
    const image = await this.repository.findById(id);
    if (!image) {
      throw new NotFoundError('Imagen no encontrada');
    }
    return image;
  }
}
