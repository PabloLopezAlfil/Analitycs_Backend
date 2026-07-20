import { HTMLElement } from 'node-html-parser';
import type { Analyzer, AnalysisContext } from '../analyzer.interface.js';
import type { CheckInput, CheckStatus, FindingInput } from '../check.interface.js';
import { elementFinding } from './dom-helpers.js';
import {
  contrastRatio,
  effectiveFontSize,
  inheritedStyle,
  inlineStyles,
  ownText,
  parseColor,
  type Rgb,
} from './style-helpers.js';

const NORMAL_TEXT_RATIO = 4.5;
const LARGE_TEXT_RATIO = 3;
const LARGE_FONT_SIZE = 24;
const LARGE_BOLD_FONT_SIZE = 18.66;

type Background = { kind: 'color'; color: Rgb } | { kind: 'image' } | { kind: 'none' };

/**
 * Analizador de la categoría COLOR_CONTRAST (documentación 0004 §7). Evalúa el
 * contraste WCAG cuando texto y fondo son determinables (estilos inline y
 * atributos bgcolor, el caso dominante en emails); lo no evaluable queda en
 * REVISION_PENDIENTE, nunca en silencio (doc 0003 §2.4).
 */
export class ColorContrastAnalyzer implements Analyzer {
  analyze(context: AnalysisContext): CheckInput[] {
    const textElements = context.root.querySelectorAll('*').filter((el) => ownText(el) !== '');

    const normal: FindingInput[] = [];
    const large: FindingInput[] = [];
    const overImage: FindingInput[] = [];
    const noBackground: FindingInput[] = [];

    for (const element of textElements) {
      const foreground = parseColor(inheritedStyle(element, 'color'));
      if (!foreground) {
        continue; // sin color explícito: se asume el par por defecto del cliente
      }

      const background = findBackground(element);
      if (background.kind === 'image') {
        overImage.push(elementFinding(element));
        continue;
      }
      if (background.kind === 'none') {
        noBackground.push(elementFinding(element));
        continue;
      }

      const ratio = contrastRatio(foreground, background.color);
      const isLarge = isLargeText(element);
      const threshold = isLarge ? LARGE_TEXT_RATIO : NORMAL_TEXT_RATIO;
      if (ratio < threshold) {
        (isLarge ? large : normal).push(elementFinding(element));
      }
    }

    return [
      buildCheck(
        'COL_CONTRAST_NORMAL',
        normal,
        'ERROR',
        `${normal.length} texto(s) con contraste menor de ${NORMAL_TEXT_RATIO}:1`,
        'El texto normal evaluable cumple el contraste mínimo',
      ),
      buildCheck(
        'COL_CONTRAST_LARGE',
        large,
        'ERROR',
        `${large.length} texto(s) grandes con contraste menor de ${LARGE_TEXT_RATIO}:1`,
        'El texto grande evaluable cumple el contraste mínimo',
      ),
      buildCheck(
        'COL_TEXT_OVER_IMAGE',
        overImage,
        'REVISION_PENDIENTE',
        `${overImage.length} texto(s) sobre imagen o fondo complejo: contraste no evaluable`,
        'Sin textos sobre imágenes de fondo',
      ),
      this.onlyColorInfo(context),
      buildCheck(
        'COL_NO_BG_DEFINED',
        noBackground,
        'REVISION_PENDIENTE',
        `${noBackground.length} texto(s) con color definido pero sin fondo determinable`,
        'Todos los textos con color tienen fondo determinable',
      ),
    ];
  }

  /**
   * COL_ONLY_COLOR_INFO: uso del color como único recurso informativo.
   * Candidata a IA (docs/0005); hasta conectarla, cualquier uso de color queda
   * en REVISION_PENDIENTE.
   */
  private onlyColorInfo(context: AnalysisContext): CheckInput {
    const colored = context.root.querySelectorAll('*').find((el) => {
      const styles = inlineStyles(el);
      return styles['color'] !== undefined || styles['background-color'] !== undefined;
    });
    const findings = colored ? [elementFinding(colored)] : [];
    return buildCheck(
      'COL_ONLY_COLOR_INFO',
      findings,
      'REVISION_PENDIENTE',
      'Pendiente de validación por IA: comprobar que el color no sea el único recurso informativo',
      'Sin uso de color que requiera validación',
    );
  }
}

function findBackground(element: HTMLElement): Background {
  let node: HTMLElement | null = element;
  while (node) {
    const styles = inlineStyles(node);
    const background = styles['background'];
    if (styles['background-image'] !== undefined || (background && /url\(/i.test(background))) {
      return { kind: 'image' };
    }
    const token =
      styles['background-color'] ??
      (background ? colorTokenFrom(background) : undefined) ??
      node.getAttribute('bgcolor') ??
      undefined;
    if (token) {
      const color = parseColor(token);
      if (color) {
        return { kind: 'color', color };
      }
    }
    const parent: unknown = node.parentNode;
    node = parent instanceof HTMLElement ? parent : null;
  }
  return { kind: 'none' };
}

function colorTokenFrom(background: string): string | undefined {
  return background.split(/\s+/).find((token) => parseColor(token) !== null);
}

function isLargeText(element: HTMLElement): boolean {
  const size = effectiveFontSize(element);
  if (size === null) {
    return false;
  }
  return size >= LARGE_FONT_SIZE || (size >= LARGE_BOLD_FONT_SIZE && isBold(element));
}

function isBold(element: HTMLElement): boolean {
  let node: HTMLElement | null = element;
  while (node) {
    if (node.tagName === 'B' || node.tagName === 'STRONG') {
      return true;
    }
    const weight = inlineStyles(node)['font-weight']?.toLowerCase();
    if (weight) {
      return weight === 'bold' || weight === 'bolder' || Number(weight) >= 700;
    }
    const parent: unknown = node.parentNode;
    node = parent instanceof HTMLElement ? parent : null;
  }
  return false;
}

function buildCheck(
  rule: string,
  findings: FindingInput[],
  failStatus: CheckStatus,
  failMessage: string,
  okMessage: string,
): CheckInput {
  const failed = findings.length > 0;
  return {
    rule,
    category: 'COLOR_CONTRAST',
    status: failed ? failStatus : 'OK',
    message: failed ? failMessage : okMessage,
    findings,
  };
}
