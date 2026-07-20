import type { Image, PrismaClient } from '../../../../generated/prisma/client.js';
import type { ImageInterface } from '../../domain/image.interface.js';
import type { ImageFilter, ImageRepository } from './image.repository.js';

function toImage(row: Image): ImageInterface {
  return {
    id: row.id,
    htmlId: row.htmlId,
    originalName: row.originalName,
    url: row.url,
    relativePath: row.relativePath,
    mimeType: row.mimeType,
    isAccesible: row.isAccesible,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Adaptador de salida: lista imágenes (con filtro opcional) y obtiene una por id.
 */
export class PrismaImageRepository implements ImageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(filter?: ImageFilter): Promise<ImageInterface[]> {
    const rows = await this.prisma.image.findMany({
      where: filter?.htmlId !== undefined ? { htmlId: filter.htmlId } : {},
      orderBy: { created_at: 'desc' },
    });
    return rows.map(toImage);
  }

  async findById(id: number): Promise<ImageInterface | null> {
    const row = await this.prisma.image.findUnique({ where: { id } });
    return row ? toImage(row) : null;
  }
}
