import type { HtmlDocumentRepository } from '../infrastructure/persistence/html-document.repository.js';
import type { HtmlDocumentSummaryInterface } from './html-document.interface.js';

/**
 * Caso de uso: listar todos los documentos HTML (resumen).
 */
export class ListHtmlDocumentsUseCase {
  constructor(private readonly repository: HtmlDocumentRepository) {}

  execute(): Promise<HtmlDocumentSummaryInterface[]> {
    return this.repository.findAll();
  }
}
