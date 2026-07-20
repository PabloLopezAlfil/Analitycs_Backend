import type { HTMLElement } from 'node-html-parser';
import type { Analyzer, AnalysisContext } from '../analyzer.interface.js';
import type { CheckInput, CheckStatus, FindingInput } from '../check.interface.js';
import { elementFinding } from './dom-helpers.js';
import {
  effectiveFontSize,
  inheritedStyle,
  ownText,
  pxNumber,
  wordCount,
} from './style-helpers.js';

const MIN_FONT_SIZE = 14;
const RECOMMENDED_BODY_SIZE = 16;
const MIN_LINE_HEIGHT = 1.4;
const MAX_BLOCK_WORDS = 80;
const MIN_LEGAL_SIZE = 12;
const DENSE_BLOCK_WORDS = 150;
const CAPS_MIN_LETTERS = 20;
const CAPS_RATIO = 0.7;

const LEGAL_TEXT = /privacidad|t[ée]rminos|condiciones|aviso legal|darse de baja|unsubscribe|copyright|©/i;

/**
 * Analizador de la categoría TYPOGRAPHY (documentación 0004 §7): tipografía y
 * legibilidad. Trabaja sobre estilos inline (el caso dominante en emails).
 */
export class TypographyAnalyzer implements Analyzer {
  analyze(context: AnalysisContext): CheckInput[] {
    // Elementos con texto propio (los que realmente pintan texto).
    const textElements = context.root.querySelectorAll('*').filter((el) => ownText(el) !== '');

    return [
      this.fontTooSmall(textElements),
      this.bodyBelowRecommended(textElements),
      this.lineHeight(textElements),
      this.longBlock(context),
      this.legalTooSmall(textElements),
      this.excessCaps(textElements),
      this.denseBlock(context),
    ];
  }

  /** TYP_FONT_TOO_SMALL: tamaño de fuente < 14px → ERROR. */
  private fontTooSmall(elements: HTMLElement[]): CheckInput {
    const findings = elements
      .filter((el) => {
        const size = effectiveFontSize(el);
        return size !== null && size < MIN_FONT_SIZE;
      })
      .map(elementFinding);
    return buildCheck(
      'TYP_FONT_TOO_SMALL',
      findings,
      'ERROR',
      `${findings.length} bloque(s) de texto con fuente menor de ${MIN_FONT_SIZE}px`,
      `Sin fuentes por debajo de ${MIN_FONT_SIZE}px`,
    );
  }

  /** TYP_BODY_BELOW_RECOMMENDED: cuerpo entre 14 y 16px → AVISO (recomendado 16px). */
  private bodyBelowRecommended(elements: HTMLElement[]): CheckInput {
    const findings = elements
      .filter((el) => {
        const size = effectiveFontSize(el);
        return size !== null && size >= MIN_FONT_SIZE && size < RECOMMENDED_BODY_SIZE;
      })
      .map(elementFinding);
    return buildCheck(
      'TYP_BODY_BELOW_RECOMMENDED',
      findings,
      'AVISO',
      `${findings.length} bloque(s) por debajo de los ${RECOMMENDED_BODY_SIZE}px recomendados`,
      `El cuerpo de texto alcanza los ${RECOMMENDED_BODY_SIZE}px recomendados`,
    );
  }

  /** TYP_LINE_HEIGHT: line-height < 1.4 → AVISO. */
  private lineHeight(elements: HTMLElement[]): CheckInput {
    const findings = elements
      .filter((el) => {
        const ratio = lineHeightRatio(el);
        return ratio !== null && ratio < MIN_LINE_HEIGHT;
      })
      .map(elementFinding);
    return buildCheck(
      'TYP_LINE_HEIGHT',
      findings,
      'AVISO',
      `${findings.length} bloque(s) con line-height insuficiente (< ${MIN_LINE_HEIGHT})`,
      'El interlineado es suficiente',
    );
  }

  /** TYP_LONG_BLOCK: bloque de más de 80 palabras → AVISO. */
  private longBlock(context: AnalysisContext): CheckInput {
    const findings = context.root
      .querySelectorAll('p,li,td')
      .filter((el) => wordCount(el.text) > MAX_BLOCK_WORDS)
      .map(elementFinding);
    return buildCheck(
      'TYP_LONG_BLOCK',
      findings,
      'AVISO',
      `${findings.length} bloque(s) de texto de más de ${MAX_BLOCK_WORDS} palabras`,
      'Sin bloques de texto excesivamente largos',
    );
  }

  /** TYP_LEGAL_TOO_SMALL: texto legal excesivamente pequeño → AVISO. */
  private legalTooSmall(elements: HTMLElement[]): CheckInput {
    const findings = elements
      .filter((el) => {
        if (!LEGAL_TEXT.test(ownText(el))) {
          return false;
        }
        const size = effectiveFontSize(el);
        return size !== null && size < MIN_LEGAL_SIZE;
      })
      .map(elementFinding);
    return buildCheck(
      'TYP_LEGAL_TOO_SMALL',
      findings,
      'AVISO',
      `${findings.length} texto(s) legales excesivamente pequeños (< ${MIN_LEGAL_SIZE}px)`,
      'Los textos legales tienen un tamaño legible',
    );
  }

  /** TYP_EXCESS_CAPS: uso excesivo de mayúsculas → AVISO. */
  private excessCaps(elements: HTMLElement[]): CheckInput {
    const findings = elements
      .filter((el) => {
        const text = ownText(el);
        const letters = text.match(/\p{L}/gu) ?? [];
        if (letters.length < CAPS_MIN_LETTERS || wordCount(text) < 3) {
          return false;
        }
        const caps = text.match(/\p{Lu}/gu) ?? [];
        return caps.length / letters.length > CAPS_RATIO;
      })
      .map(elementFinding);
    return buildCheck(
      'TYP_EXCESS_CAPS',
      findings,
      'AVISO',
      `${findings.length} bloque(s) con uso excesivo de mayúsculas`,
      'Sin abuso de mayúsculas',
    );
  }

  /** TYP_DENSE_BLOCK: bloque muy denso, sin pausas (p/br) → AVISO. */
  private denseBlock(context: AnalysisContext): CheckInput {
    const findings = context.root
      .querySelectorAll('div,td')
      .filter(
        (el) =>
          wordCount(el.text) > DENSE_BLOCK_WORDS &&
          !el.querySelector('p') &&
          !el.querySelector('br'),
      )
      .map(elementFinding);
    return buildCheck(
      'TYP_DENSE_BLOCK',
      findings,
      'AVISO',
      `${findings.length} bloque(s) demasiado densos (sin pausas de lectura)`,
      'Sin bloques excesivamente densos',
    );
  }
}

function lineHeightRatio(element: HTMLElement): number | null {
  const raw = inheritedStyle(element, 'line-height');
  if (!raw) {
    return null;
  }
  if (/^\d+(\.\d+)?$/.test(raw.trim())) {
    return Number(raw.trim());
  }
  const px = pxNumber(raw);
  if (px !== null) {
    const fontSize = effectiveFontSize(element);
    return fontSize !== null && fontSize > 0 ? px / fontSize : null;
  }
  return null;
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
    category: 'TYPOGRAPHY',
    status: failed ? failStatus : 'OK',
    message: failed ? failMessage : okMessage,
    findings,
  };
}
