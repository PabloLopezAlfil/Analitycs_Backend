import type { HTMLElement } from 'node-html-parser';
import type { Analyzer, AnalysisContext } from '../analyzer.interface.js';
import type { CheckInput, CheckStatus, FindingInput } from '../check.interface.js';
import { evidenceOf, locationOf } from './dom-helpers.js';

// Textos alt que no describen nada (regla IMG_GENERIC_ALT).
const GENERIC_ALTS = new Set([
  'imagen', 'image', 'img', 'foto', 'photo', 'picture', 'pic',
  'banner', 'logo', 'icono', 'icon', 'grafico', 'gráfico',
]);

// Nombres de fichero sospechosos de contener texto importante (IMG_SUSPECT_NAME).
const SUSPECT_NAME = /banner|promo|oferta|cta|descuento|rebaja|sale|deal/i;

// Pistas de que una imagen con alt vacío es realmente decorativa.
const DECORATIVE_NAME = /spacer|separador|separator|divider|pixel|blank|border|shadow|line/i;

/**
 * Analizador de la categoría IMAGES (documentación 0004 §7): evalúa las 7
 * reglas del catálogo y devuelve un check por regla, incluidas las que
 * resultan OK (base del score).
 */
export class ImagesAnalyzer implements Analyzer {
  analyze(context: AnalysisContext): CheckInput[] {
    const imgs = context.root.querySelectorAll('img');

    return [
      this.noAlt(imgs),
      this.emptyAltSuspect(imgs),
      this.genericAlt(imgs),
      this.broken(context, imgs),
      this.linkedNoAlt(context),
      this.suspectName(imgs),
      this.textInImage(imgs),
    ];
  }

  /** IMG_NO_ALT: imagen sin atributo alt → ERROR. */
  private noAlt(imgs: HTMLElement[]): CheckInput {
    const findings = imgs.filter((img) => !img.hasAttribute('alt')).map(toFinding);
    return buildCheck(
      'IMG_NO_ALT',
      findings,
      'ERROR',
      `${findings.length} imagen(es) sin atributo alt`,
      'Todas las imágenes tienen atributo alt',
    );
  }

  /** IMG_EMPTY_ALT_SUSPECT: alt vacío en imagen que no parece decorativa → AVISO. */
  private emptyAltSuspect(imgs: HTMLElement[]): CheckInput {
    const findings = imgs
      .filter((img) => {
        if (!img.hasAttribute('alt') || (img.getAttribute('alt') ?? '').trim() !== '') {
          return false;
        }
        return !looksDecorative(img);
      })
      .map(toFinding);
    return buildCheck(
      'IMG_EMPTY_ALT_SUSPECT',
      findings,
      'AVISO',
      `${findings.length} imagen(es) con alt vacío que no parecen decorativas`,
      'Sin imágenes con alt vacío sospechoso',
    );
  }

  /** IMG_GENERIC_ALT: alt demasiado genérico → AVISO. */
  private genericAlt(imgs: HTMLElement[]): CheckInput {
    const findings = imgs
      .filter((img) => {
        const alt = (img.getAttribute('alt') ?? '').trim().toLowerCase();
        return alt !== '' && GENERIC_ALTS.has(alt);
      })
      .map(toFinding);
    return buildCheck(
      'IMG_GENERIC_ALT',
      findings,
      'AVISO',
      `${findings.length} imagen(es) con alt demasiado genérico`,
      'Ningún alt genérico detectado',
    );
  }

  /** IMG_BROKEN: imagen rota o no encontrada (is_accesible de la fase 0002) → ERROR. */
  private broken(context: AnalysisContext, imgs: HTMLElement[]): CheckInput {
    const findings = context.images
      .filter((image) => !image.isAccesible)
      .map((image) => {
        const element = imgs.find((img) => {
          const src = img.getAttribute('src') ?? '';
          return src === image.relativePath || src === image.url || src.endsWith(image.originalName);
        });
        return element
          ? toFinding(element)
          : { location: image.relativePath ?? image.url, evidence: `${image.originalName} (${image.url})` };
      });
    return buildCheck(
      'IMG_BROKEN',
      findings,
      'ERROR',
      `${findings.length} imagen(es) rotas o no accesibles`,
      'Todas las imágenes del documento son accesibles',
    );
  }

  /** IMG_LINKED_NO_ALT: imagen enlazada sin alternativa útil → ERROR. */
  private linkedNoAlt(context: AnalysisContext): CheckInput {
    const findings = context.root
      .querySelectorAll('a')
      .filter((link) => {
        const linkImgs = link.querySelectorAll('img');
        if (linkImgs.length === 0) {
          return false;
        }
        const hasText = link.structuredText.trim() !== '';
        const hasUsefulAlt = linkImgs.some(
          (img) => (img.getAttribute('alt') ?? '').trim() !== '',
        );
        return !hasText && !hasUsefulAlt;
      })
      .map(toFinding);
    return buildCheck(
      'IMG_LINKED_NO_ALT',
      findings,
      'ERROR',
      `${findings.length} enlace(s) con imagen sin alternativa útil`,
      'Las imágenes enlazadas tienen alternativa útil',
    );
  }

  /** IMG_SUSPECT_NAME: nombre sospechoso de contener texto → REVISION_PENDIENTE. */
  private suspectName(imgs: HTMLElement[]): CheckInput {
    const findings = imgs
      .filter((img) => SUSPECT_NAME.test(fileNameOf(img.getAttribute('src') ?? '')))
      .map(toFinding);
    return buildCheck(
      'IMG_SUSPECT_NAME',
      findings,
      'REVISION_PENDIENTE',
      `${findings.length} imagen(es) con nombre sospechoso de contener texto importante`,
      'Ningún nombre de imagen sospechoso',
    );
  }

  /**
   * IMG_TEXT_IN_IMAGE: posible texto importante dentro de las imágenes.
   * Regla candidata a IA (docs/0005); hasta conectarla, cualquier imagen queda
   * en REVISION_PENDIENTE (documentación 0004 §3).
   */
  private textInImage(imgs: HTMLElement[]): CheckInput {
    const findings = imgs.map(toFinding);
    return buildCheck(
      'IMG_TEXT_IN_IMAGE',
      findings,
      'REVISION_PENDIENTE',
      `Pendiente de validación por IA: ${findings.length} imagen(es) podrían contener texto importante`,
      'Sin imágenes que analizar',
    );
  }
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
    category: 'IMAGES',
    status: failed ? failStatus : 'OK',
    message: failed ? failMessage : okMessage,
    findings,
  };
}

function toFinding(element: HTMLElement): FindingInput {
  return { location: locationOf(element), evidence: evidenceOf(element) };
}

function looksDecorative(img: HTMLElement): boolean {
  const src = img.getAttribute('src') ?? '';
  if (DECORATIVE_NAME.test(fileNameOf(src))) {
    return true;
  }
  const width = Number(img.getAttribute('width'));
  const height = Number(img.getAttribute('height'));
  return (Number.isFinite(width) && width <= 3) || (Number.isFinite(height) && height <= 3);
}

function fileNameOf(src: string): string {
  return src.split('/').pop() ?? src;
}
