import { Router } from 'express';
import { ListHtmlDocumentsUseCase } from '../../domain/list-html-documents.use-case.js';
import { GetHtmlDocumentUseCase } from '../../domain/get-html-document.use-case.js';
import { NotFoundError } from '../../domain/errors.js';

interface HtmlRouterDeps {
  listHtmlDocuments: ListHtmlDocumentsUseCase;
  getHtmlDocument: GetHtmlDocumentUseCase;
}

/**
 * Adaptador de entrada (HTTP/Express) para el recurso `/html` (documentos HTML).
 */
export function HtmlRouter({ listHtmlDocuments, getHtmlDocument }: HtmlRouterDeps): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const documents = await listHtmlDocuments.execute();
      res.status(200).json(documents);
    } catch {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
      // Id no numérico: se trata como no encontrado, sin consultar la BD.
      if (!Number.isInteger(id)) {
        throw new NotFoundError('Documento HTML no encontrado');
      }
      const document = await getHtmlDocument.execute(id);
      res.status(200).json(document);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  return router;
}
