import type { PrismaClient } from '../../../../generated/prisma/client.js';
import type { AnalyzableDocument, HtmlDocumentReader } from './html-document.reader.js';

/**
 * Adaptador de salida: carga el documento con sus imágenes (incluido el
 * is_accesible calculado en la fase 0002, que reutiliza la regla IMG_BROKEN).
 */
export class PrismaHtmlDocumentReader implements HtmlDocumentReader {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: number): Promise<AnalyzableDocument | null> {
    const row = await this.prisma.htmlDocument.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      content: row.content,
      images: row.images.map((img) => ({
        originalName: img.originalName,
        url: img.url,
        relativePath: img.relativePath,
        mimeType: img.mimeType,
        isAccesible: img.isAccesible,
      })),
    };
  }
}
