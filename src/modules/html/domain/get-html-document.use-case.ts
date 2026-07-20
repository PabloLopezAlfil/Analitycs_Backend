import type { HtmlDocumentRepository } from '../infrastructure/persistence/html-document.repository.js';
import type { HtmlDocumentDetailInterface } from './html-document.interface.js';
import { NotFoundError } from './errors.js';

/**
 * Caso de uso: obtener el detalle de un documento HTML (con su content y sus
 * images asociadas). Lanza NotFoundError si no existe.
 */
export class GetHtmlDocumentUseCase {
  constructor(private readonly repository: HtmlDocumentRepository) {}

  async execute(id: number): Promise<HtmlDocumentDetailInterface> {
    const document = await this.repository.findById(id);
    if (!document) {
      throw new NotFoundError('Documento HTML no encontrado');
    }
    return document;
  }
}
