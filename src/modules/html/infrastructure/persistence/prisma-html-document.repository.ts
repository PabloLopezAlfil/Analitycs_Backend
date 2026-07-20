import type { PrismaClient } from '../../../../generated/prisma/client.js';
import type {
  HtmlDocumentDetailInterface,
  HtmlDocumentSummaryInterface,
} from '../../domain/html-document.interface.js';
import type { HtmlDocumentRepository } from './html-document.repository.js';

/**
 * Adaptador de salida: lista los documentos HTML como resumen (sin el `content`
 * pesado ni las imágenes).
 */
export class PrismaHtmlDocumentRepository implements HtmlDocumentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<HtmlDocumentSummaryInterface[]> {
    const rows = await this.prisma.htmlDocument.findMany({ orderBy: { created_at: 'desc' } });
    return rows.map((row) => ({
      id: row.id,
      uploadId: row.uploadId,
      name: row.name,
      relativePath: row.relativePath,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async findById(id: number): Promise<HtmlDocumentDetailInterface | null> {
    const row = await this.prisma.htmlDocument.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      uploadId: row.uploadId,
      name: row.name,
      content: row.content,
      relativePath: row.relativePath,
      createdAt: row.created_at.toISOString(),
      images: row.images.map((img) => ({
        id: img.id,
        originalName: img.originalName,
        url: img.url,
        relativePath: img.relativePath,
        mimeType: img.mimeType,
        isAccesible: img.isAccesible,
      })),
    };
  }
}
