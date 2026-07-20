import { parse } from 'node-html-parser';
import type { AnalysisContext, AnalyzableImage } from '../../domain/analyzer.interface.js';

/**
 * Construye el contexto de análisis: el HTML se parsea UNA sola vez y el DOM
 * resultante se comparte entre todos los analizadores (documentación 0004 §6).
 */
export function buildAnalysisContext(html: string, images: AnalyzableImage[]): AnalysisContext {
  return { root: parse(html), images };
}
