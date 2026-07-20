import type { HTMLElement } from 'node-html-parser';
import type { Analyzer, AnalysisContext } from '../analyzer.interface.js';
import type { CheckInput, CheckStatus, FindingInput } from '../check.interface.js';
import { elementFinding, locationOf } from './dom-helpers.js';

// CSS con soporte problemático en clientes de correo.
const PROBLEMATIC_CSS =
  /display\s*:\s*(?:inline-)?(?:flex|grid)|position\s*:\s*(?:absolute|fixed)|float\s*:\s*(?:left|right)/gi;

// Pseudo-elementos avanzados, ignorados por muchos clientes.
const ADVANCED_PSEUDO = /::(?:before|after|marker|selection|first-letter|first-line)/gi;

// Fuentes externas (link a proveedores de fuentes, @font-face o @import con url).
const EXTERNAL_FONT_CSS = /@font-face|@import[^;]*url\(/i;
const FONT_HREF = /fonts?\./i;

// Propiedades críticas que los clientes pueden descartar si no van inline.
const CRITICAL_PROPERTY = /\b(?:font-size|background-color|background|color|width|padding|margin)\s*:/i;

/**
 * Analizador de la categoría RESPONSIVE_CSS (documentación 0004 §7):
 * compatibilidad del CSS con clientes de correo. Los estilos inline
 * problemáticos de layout los cubre STR_INCOMPATIBLE_LAYOUT; aquí se revisan
 * los bloques <style> y las referencias externas.
 */
export class ResponsiveCssAnalyzer implements Analyzer {
  analyze(context: AnalysisContext): CheckInput[] {
    const styleBlocks = context.root.querySelectorAll('style');
    const links = context.root.querySelectorAll('link');

    return [
      this.problematicProperties(styleBlocks),
      this.advancedPseudo(styleBlocks),
      this.externalFonts(styleBlocks, links),
      this.criticalNotInline(styleBlocks),
    ];
  }

  /** CSS_PROBLEMATIC_PROPERTY: flex/grid/position/float en <style> → AVISO. */
  private problematicProperties(styleBlocks: HTMLElement[]): CheckInput {
    const findings = styleBlocks.flatMap((block) =>
      matchesOf(block.text, PROBLEMATIC_CSS).map((match) => ({
        location: locationOf(block),
        evidence: match,
      })),
    );
    return buildCheck(
      'CSS_PROBLEMATIC_PROPERTY',
      findings,
      `${findings.length} declaración(es) CSS problemáticas en clientes de correo`,
      'Sin CSS problemático en los bloques <style>',
    );
  }

  /** CSS_ADVANCED_PSEUDO: pseudo-elementos avanzados → AVISO. */
  private advancedPseudo(styleBlocks: HTMLElement[]): CheckInput {
    const findings = styleBlocks.flatMap((block) =>
      matchesOf(block.text, ADVANCED_PSEUDO).map((match) => ({
        location: locationOf(block),
        evidence: match,
      })),
    );
    return buildCheck(
      'CSS_ADVANCED_PSEUDO',
      findings,
      `${findings.length} pseudo-elemento(s) avanzados detectados`,
      'Sin pseudo-elementos avanzados',
    );
  }

  /** CSS_EXTERNAL_FONTS: fuentes externas no seguras → AVISO. */
  private externalFonts(styleBlocks: HTMLElement[], links: HTMLElement[]): CheckInput {
    const fromLinks = links
      .filter((link) => FONT_HREF.test(link.getAttribute('href') ?? ''))
      .map(elementFinding);
    const fromCss = styleBlocks
      .filter((block) => EXTERNAL_FONT_CSS.test(block.text))
      .map((block) => ({
        location: locationOf(block),
        evidence: '@font-face / @import con url() en <style>',
      }));
    const findings = [...fromLinks, ...fromCss];
    return buildCheck(
      'CSS_EXTERNAL_FONTS',
      findings,
      `${findings.length} referencia(s) a fuentes externas`,
      'Sin fuentes externas',
    );
  }

  /** CSS_CRITICAL_NOT_INLINE: estilos críticos solo en <style> → AVISO. */
  private criticalNotInline(styleBlocks: HTMLElement[]): CheckInput {
    const findings = styleBlocks
      .filter((block) => CRITICAL_PROPERTY.test(block.text))
      .map((block) => {
        const match = block.text.match(CRITICAL_PROPERTY);
        return {
          location: locationOf(block),
          evidence: `Estilos críticos en <style> (p. ej. "${match?.[0] ?? ''}…"): muchos clientes los descartan si no van inline`,
        };
      });
    return buildCheck(
      'CSS_CRITICAL_NOT_INLINE',
      findings,
      `${findings.length} bloque(s) <style> con estilos críticos no inline`,
      'Sin estilos críticos fuera de línea',
    );
  }
}

function matchesOf(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(new RegExp(pattern.source, pattern.flags))].map((m) => m[0]);
}

function buildCheck(
  rule: string,
  findings: FindingInput[],
  failMessage: string,
  okMessage: string,
): CheckInput {
  const failed = findings.length > 0;
  const status: CheckStatus = failed ? 'AVISO' : 'OK';
  return {
    rule,
    category: 'RESPONSIVE_CSS',
    status,
    message: failed ? failMessage : okMessage,
    findings,
  };
}
