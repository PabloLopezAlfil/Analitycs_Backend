import type { HTMLElement } from 'node-html-parser';
import type { CheckInput } from './check.interface.js';

/** Imagen asociada al documento (con el is_accesible calculado en la fase 0002). */
export interface AnalyzableImage {
  originalName: string;
  url: string;
  relativePath: string | null;
  mimeType: string | null;
  isAccesible: boolean;
}

/**
 * Contexto de análisis: el HTML se parsea UNA sola vez y se inyecta a todos
 * los analizadores (documentación 0004 §6).
 */
export interface AnalysisContext {
  root: HTMLElement;
  images: AnalyzableImage[];
}

/**
 * Puerto de los analizadores por categoría: funciones puras (sin I/O) que
 * reciben el contexto y devuelven el resultado de sus reglas.
 */
export interface Analyzer {
  analyze(context: AnalysisContext): CheckInput[];
}
