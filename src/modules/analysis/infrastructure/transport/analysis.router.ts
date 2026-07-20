import { Router } from 'express';
import { AnalyzeHtmlDocumentUseCase } from '../../domain/analyze-html-document.use-case.js';
import { NotFoundError, ValidationError } from '../../domain/errors.js';

interface AnalysisRouterDeps {
  analyzeHtmlDocument: AnalyzeHtmlDocumentUseCase;
}

/**
 * Adaptador de entrada (HTTP/Express) para el recurso `/analysis`.
 */
export function AnalysisRouter({ analyzeHtmlDocument }: AnalysisRouterDeps): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    try {
      const analysis = await analyzeHtmlDocument.execute(req.body?.htmlId);
      res.status(201).json(analysis);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  return router;
}
