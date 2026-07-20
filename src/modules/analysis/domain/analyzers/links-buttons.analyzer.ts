import type { HTMLElement } from 'node-html-parser';
import type { Analyzer, AnalysisContext } from '../analyzer.interface.js';
import type { CheckInput, CheckStatus, FindingInput } from '../check.interface.js';
import { elementFinding } from './dom-helpers.js';
import { inlineStyles, pxNumber, wordCount } from './style-helpers.js';

// Textos de enlace que no aportan destino (regla LNK_GENERIC_TEXT).
const GENERIC_LINK_TEXTS = new Set([
  'haz clic', 'haz clic aquí', 'haz click', 'haz click aquí', 'clic aquí', 'click aquí',
  'click here', 'here', 'aquí', 'aqui', 'ver más', 'ver mas', 'leer más', 'leer mas',
  'más', 'mas', 'more', 'read more', 'pincha aquí', 'pulse aquí',
]);

// CTAs de una sola palabra demasiado débiles (regla LNK_CTA_WEAK).
const WEAK_CTA_TEXTS = new Set([
  'comprar', 'ver', 'entrar', 'ir', 'enviar', 'descargar', 'suscribirse', 'empezar', 'ok', 'aceptar',
]);

const MIN_TARGET_HEIGHT = 32;
const MIN_VERTICAL_PADDING = 12;

/**
 * Analizador de la categoría LINKS_BUTTONS (documentación 0004 §7): enlaces y
 * botones del email.
 */
export class LinksButtonsAnalyzer implements Analyzer {
  analyze(context: AnalysisContext): CheckInput[] {
    const links = context.root.querySelectorAll('a');

    return [
      this.genericText(links),
      this.empty(links),
      this.noHref(links),
      this.weakCta(links),
      this.smallTarget(links),
      this.linkedImageNoAlt(links),
    ];
  }

  /** LNK_GENERIC_TEXT: texto genérico ("haz clic", "ver más"…) → ERROR. */
  private genericText(links: HTMLElement[]): CheckInput {
    const findings = links
      .filter((link) => GENERIC_LINK_TEXTS.has(normalized(link.text)))
      .map(elementFinding);
    return buildCheck(
      'LNK_GENERIC_TEXT',
      findings,
      'ERROR',
      `${findings.length} enlace(s) con texto genérico`,
      'Los enlaces tienen textos descriptivos',
    );
  }

  /** LNK_EMPTY: enlace sin texto ni contenido accesible → ERROR. */
  private empty(links: HTMLElement[]): CheckInput {
    const findings = links
      .filter((link) => {
        if (link.text.trim() !== '') return false;
        if (link.querySelectorAll('img').length > 0) return false; // lo cubre LNK_IMG_NO_ALT
        return (link.getAttribute('aria-label') ?? '').trim() === '';
      })
      .map(elementFinding);
    return buildCheck(
      'LNK_EMPTY',
      findings,
      'ERROR',
      `${findings.length} enlace(s) vacíos (sin contenido accesible)`,
      'Sin enlaces vacíos',
    );
  }

  /** LNK_NO_HREF: enlace sin href (o sin destino real) → ERROR. */
  private noHref(links: HTMLElement[]): CheckInput {
    const findings = links
      .filter((link) => {
        const href = (link.getAttribute('href') ?? '').trim();
        return href === '' || href === '#';
      })
      .map(elementFinding);
    return buildCheck(
      'LNK_NO_HREF',
      findings,
      'ERROR',
      `${findings.length} enlace(s) sin href`,
      'Todos los enlaces tienen destino',
    );
  }

  /** LNK_CTA_WEAK: CTA poco descriptivo (heurística sobre botones) → AVISO. */
  private weakCta(links: HTMLElement[]): CheckInput {
    const findings = links
      .filter((link) => {
        if (!isButtonLike(link)) return false;
        const text = normalized(link.text);
        return wordCount(text) <= 1 && WEAK_CTA_TEXTS.has(text);
      })
      .map(elementFinding);
    return buildCheck(
      'LNK_CTA_WEAK',
      findings,
      'AVISO',
      `${findings.length} CTA(s) poco descriptivos`,
      'Los CTA son descriptivos',
    );
  }

  /** LNK_SMALL_TARGET: área clicable / padding insuficiente → AVISO. */
  private smallTarget(links: HTMLElement[]): CheckInput {
    const findings = links
      .filter((link) => {
        if (!isButtonLike(link)) return false;
        const styles = inlineStyles(link);
        const height = pxNumber(styles['height']);
        if (height !== null) return height < MIN_TARGET_HEIGHT;
        const padding = verticalPadding(styles);
        return padding !== null && padding < MIN_VERTICAL_PADDING;
      })
      .map(elementFinding);
    return buildCheck(
      'LNK_SMALL_TARGET',
      findings,
      'AVISO',
      `${findings.length} botón(es) con área clicable insuficiente`,
      'Los botones tienen área clicable suficiente',
    );
  }

  /** LNK_IMG_NO_ALT: imagen enlazada sin alternativa útil → ERROR (ver IMG_LINKED_NO_ALT). */
  private linkedImageNoAlt(links: HTMLElement[]): CheckInput {
    const findings = links
      .filter((link) => {
        const imgs = link.querySelectorAll('img');
        if (imgs.length === 0) return false;
        const hasText = link.text.trim() !== '';
        const hasUsefulAlt = imgs.some((img) => (img.getAttribute('alt') ?? '').trim() !== '');
        return !hasText && !hasUsefulAlt;
      })
      .map(elementFinding);
    return buildCheck(
      'LNK_IMG_NO_ALT',
      findings,
      'ERROR',
      `${findings.length} enlace(s) cuya imagen no tiene alt descriptivo`,
      'Las imágenes enlazadas tienen alt descriptivo',
    );
  }
}

function normalized(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isButtonLike(link: HTMLElement): boolean {
  const styles = inlineStyles(link);
  if (styles['background'] !== undefined || styles['background-color'] !== undefined) {
    return true;
  }
  return /btn|button|cta/i.test(link.getAttribute('class') ?? '');
}

function verticalPadding(styles: Record<string, string>): number | null {
  const top = pxNumber(styles['padding-top']);
  const bottom = pxNumber(styles['padding-bottom']);
  if (top !== null || bottom !== null) {
    return (top ?? 0) + (bottom ?? 0);
  }
  const shorthand = styles['padding'];
  if (!shorthand) {
    return null;
  }
  const values = shorthand.split(/\s+/).map((v) => pxNumber(v));
  const topValue = values[0] ?? null;
  if (topValue === null) {
    return null;
  }
  const bottomValue = values.length >= 3 ? (values[2] ?? topValue) : topValue;
  return topValue + bottomValue;
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
    category: 'LINKS_BUTTONS',
    status: failed ? failStatus : 'OK',
    message: failed ? failMessage : okMessage,
    findings,
  };
}
