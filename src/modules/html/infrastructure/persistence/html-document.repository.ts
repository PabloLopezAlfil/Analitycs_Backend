import type {
  HtmlDocumentDetailInterface,
  HtmlDocumentSummaryInterface,
} from '../../domain/html-document.interface.js';

/**
 * Puerto de persistencia de documentos HTML. La infraestructura provee la
 * implementación concreta (Prisma/MySQL).
 */
export interface HtmlDocumentRepository {
  findAll(): Promise<HtmlDocumentSummaryInterface[]>;
  findById(id: number): Promise<HtmlDocumentDetailInterface | null>;
}
