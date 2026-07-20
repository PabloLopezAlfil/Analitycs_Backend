import type { Analyzer } from './analyzer.interface.js';
import type { AnalysisInterface } from './check.interface.js';
import type { AnalysisRepository } from '../infrastructure/persistence/analysis.repository.js';
import type { HtmlDocumentReader } from '../infrastructure/persistence/html-document.reader.js';
import { buildAnalysisContext } from '../infrastructure/parsing/analysis-context.js';
import { computeScore } from './score.js';
import { NotFoundError, ValidationError } from './errors.js';

/**
 * Caso de uso: analizar un documento HTML (documentación 0004).
 * Orquesta el flujo: carga el documento con sus imágenes, construye el
 * contexto (parseo único), ejecuta los analizadores, calcula el score y
 * persiste el resultado completo (histórico).
 */
export class AnalyzeHtmlDocumentUseCase {
  constructor(
    private readonly documents: HtmlDocumentReader,
    private readonly analyses: AnalysisRepository,
    private readonly analyzers: Analyzer[],
  ) {}

  async execute(rawHtmlId: unknown): Promise<AnalysisInterface> {
    const htmlId = Number(rawHtmlId);
    if (rawHtmlId === undefined || rawHtmlId === null || rawHtmlId === '' || !Number.isInteger(htmlId)) {
      throw new ValidationError('htmlId es obligatorio y debe ser un número entero');
    }

    const document = await this.documents.findById(htmlId);
    if (!document) {
      throw new NotFoundError('Documento HTML no encontrado');
    }

    const context = buildAnalysisContext(document.content, document.images);
    const checks = this.analyzers.flatMap((analyzer) => analyzer.analyze(context));
    const score = computeScore(checks);

    return this.analyses.save({ htmlId, score, checks });
  }
}
