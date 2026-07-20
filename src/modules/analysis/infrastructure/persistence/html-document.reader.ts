import type { AnalyzableImage } from '../../domain/analyzer.interface.js';

/** Documento HTML listo para analizar: su contenido y sus imágenes asociadas. */
export interface AnalyzableDocument {
  id: number;
  content: string;
  images: AnalyzableImage[];
}

/**
 * Puerto de lectura del documento a analizar. La infraestructura provee la
 * implementación concreta (Prisma/MySQL).
 */
export interface HtmlDocumentReader {
  findById(id: number): Promise<AnalyzableDocument | null>;
}
