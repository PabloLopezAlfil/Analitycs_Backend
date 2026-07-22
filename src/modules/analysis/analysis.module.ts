import type { Router } from 'express';
import { getPrisma } from '../../db/prisma.js';
import { PrismaHtmlDocumentReader } from './infrastructure/persistence/prisma-html-document.reader.js';
import { PrismaAnalysisRepository } from './infrastructure/persistence/prisma-analysis.repository.js';
import { ImagesAnalyzer } from './domain/analyzers/images.analyzer.js';
import { StructureAnalyzer } from './domain/analyzers/structure.analyzer.js';
import { LinksButtonsAnalyzer } from './domain/analyzers/links-buttons.analyzer.js';
import { TypographyAnalyzer } from './domain/analyzers/typography.analyzer.js';
import { ColorContrastAnalyzer } from './domain/analyzers/color-contrast.analyzer.js';
import { ResponsiveCssAnalyzer } from './domain/analyzers/responsive-css.analyzer.js';
import { AnalyzeHtmlDocumentUseCase } from './domain/analyze-html-document.use-case.js';
import { GetAnalysisUseCase } from './domain/get-analysis.use-case.js';
import { ListAnalysesUseCase } from './domain/list-analyses.use-case.js';
import { ReviewAnalysisWithAiUseCase } from './domain/review-analysis-with-ai.use-case.js';
import { GenkitAiReviewer } from './infrastructure/ai/genkit-ai-reviewer.adapter.js';
import { AnalysisRouter } from './infrastructure/transport/analysis.router.js';

/**
 * Composition root del módulo de análisis: instancia los adaptadores y los
 * analizadores (uno por categoría; se irán añadiendo por incrementos) y los
 * inyecta en el caso de uso, devolviendo el router listo para montar.
 */
export function buildAnalysisRouter(): Router {
  const documents = new PrismaHtmlDocumentReader(getPrisma());
  const analyses = new PrismaAnalysisRepository(getPrisma());
  const analyzers = [
    new ImagesAnalyzer(),
    new StructureAnalyzer(),
    new LinksButtonsAnalyzer(),
    new TypographyAnalyzer(),
    new ColorContrastAnalyzer(),
    new ResponsiveCssAnalyzer(),
  ];

  const analyzeHtmlDocument = new AnalyzeHtmlDocumentUseCase(documents, analyses, analyzers);
  const listAnalyses = new ListAnalysesUseCase(analyses);
  const getAnalysis = new GetAnalysisUseCase(analyses);
  const reviewAnalysisWithAi = new ReviewAnalysisWithAiUseCase(analyses, documents, new GenkitAiReviewer());

  return AnalysisRouter({ analyzeHtmlDocument, listAnalyses, getAnalysis, reviewAnalysisWithAi });
}
