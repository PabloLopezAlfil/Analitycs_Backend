import type { ImageInterface } from '../../domain/image.interface.js';

/** Criterios opcionales para filtrar el listado de imágenes. */
export interface ImageFilter {
  htmlId?: number;
}

/**
 * Puerto de persistencia de imágenes. La infraestructura provee la
 * implementación concreta (Prisma/MySQL).
 */
export interface ImageRepository {
  findAll(filter?: ImageFilter): Promise<ImageInterface[]>;
  findById(id: number): Promise<ImageInterface | null>;
}
