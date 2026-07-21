import { Router } from 'express';
import { AnalyzeHtmlDocumentUseCase } from '../../domain/analyze-html-document.use-case.js';
import { GetAnalysisUseCase } from '../../domain/get-analysis.use-case.js';
import { ListAnalysesUseCase } from '../../domain/list-analyses.use-case.js';
import { NotFoundError, ValidationError } from '../../domain/errors.js';

interface AnalysisRouterDeps {
  analyzeHtmlDocument: AnalyzeHtmlDocumentUseCase;
  listAnalyses: ListAnalysesUseCase;
  getAnalysis: GetAnalysisUseCase;
}

/**
 * Adaptador de entrada (HTTP/Express) para el recurso `/analysis`.
 */
export function AnalysisRouter({
  analyzeHtmlDocument,
  listAnalyses,
  getAnalysis,
}: AnalysisRouterDeps): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      // Filtro opcional ?html_id=:id; se ignora si no es un entero.
      const htmlId = Number(req.query.html_id);
      const filter = Number.isInteger(htmlId) ? { htmlId } : undefined;
      const analyses = await listAnalyses.execute(filter);
      res.status(200).json(analyses);
    } catch {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

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

  router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
      // Id no numérico: se trata como no encontrado, sin consultar la BD.
      if (!Number.isInteger(id)) {
        throw new NotFoundError('Análisis no encontrado');
      }

      const analysis = await getAnalysis.execute(id);
      res.status(200).json(analysis);
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
