import type { ImageFilter, ImageRepository } from '../infrastructure/persistence/image.repository.js';
import type { ImageInterface } from './image.interface.js';

/**
 * Caso de uso: listar imágenes, opcionalmente filtradas por documento HTML.
 */
export class ListImagesUseCase {
  constructor(private readonly repository: ImageRepository) {}

  execute(filter?: ImageFilter): Promise<ImageInterface[]> {
    return this.repository.findAll(filter);
  }
}
