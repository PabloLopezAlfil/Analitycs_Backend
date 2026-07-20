import { HTMLElement } from 'node-html-parser';
import type { Analyzer, AnalysisContext } from '../analyzer.interface.js';
import type { CheckInput, CheckStatus, FindingInput } from '../check.interface.js';
import { elementFinding } from './dom-helpers.js';
import { inlineStyles, ownText, wordCount } from './style-helpers.js';

const HEADING_SELECTOR = 'h1,h2,h3,h4,h5,h6';
const MAX_NESTING = 4;
const MAX_COLUMNS = 3;

/**
 * Analizador de la categoría STRUCTURE (documentación 0004 §7): estructura y
 * maquetación del email.
 */
export class StructureAnalyzer implements Analyzer {
  analyze(context: AnalysisContext): CheckInput[] {
    const tables = context.root.querySelectorAll('table');

    return [
      this.tableNoPresentation(tables),
      this.complexNesting(tables),
      this.tooManyColumns(context),
      this.contentBlocks(context),
      this.incompatibleLayout(context),
    ];
  }

  /** STR_TABLE_NO_PRESENTATION: tabla de maquetación sin role="presentation" → ERROR. */
  private tableNoPresentation(tables: HTMLElement[]): CheckInput {
    const findings = tables
      .filter((table) => {
        if ((table.getAttribute('role') ?? '').toLowerCase() === 'presentation') {
          return false;
        }
        // Una tabla con th o caption es de datos, no de maquetación.
        return !table.querySelector('th') && !table.querySelector('caption');
      })
      .map(elementFinding);
    return buildCheck(
      'STR_TABLE_NO_PRESENTATION',
      findings,
      'ERROR',
      `${findings.length} tabla(s) de maquetación sin role="presentation"`,
      'Las tablas de maquetación declaran role="presentation"',
    );
  }

  /** STR_COMPLEX_NESTING: más de 4 niveles de tablas anidadas → AVISO. */
  private complexNesting(tables: HTMLElement[]): CheckInput {
    const findings = tables
      .filter((table) => ancestorTables(table) >= MAX_NESTING)
      .map(elementFinding);
    return buildCheck(
      'STR_COMPLEX_NESTING',
      findings,
      'AVISO',
      `Anidamiento de tablas demasiado profundo (más de ${MAX_NESTING} niveles)`,
      'El anidamiento de tablas está dentro de lo razonable',
    );
  }

  /** STR_TOO_MANY_COLUMNS: fila con más de 3 columnas → AVISO. */
  private tooManyColumns(context: AnalysisContext): CheckInput {
    const findings = context.root
      .querySelectorAll('tr')
      .filter((row) => {
        const cells = row.childNodes.filter(
          (node): node is HTMLElement =>
            node instanceof HTMLElement && (node.tagName === 'TD' || node.tagName === 'TH'),
        );
        return cells.length > MAX_COLUMNS;
      })
      .map(elementFinding);
    return buildCheck(
      'STR_TOO_MANY_COLUMNS',
      findings,
      'AVISO',
      `${findings.length} fila(s) con más de ${MAX_COLUMNS} columnas`,
      'Sin filas con exceso de columnas',
    );
  }

  /** STR_CONTENT_BLOCKS: falta título, texto explicativo o CTA (heurística) → AVISO. */
  private contentBlocks(context: AnalysisContext): CheckInput {
    const root = context.root;

    const hasHeading = root
      .querySelectorAll(HEADING_SELECTOR)
      .some((heading) => heading.text.trim() !== '');
    const hasText = root
      .querySelectorAll('p,td,li,div,span')
      .some((el) => el.tagName !== 'A' && wordCount(ownText(el)) >= 3);
    const hasCta = root
      .querySelectorAll('a')
      .some((link) => (link.getAttribute('href') ?? '').trim() !== '' && link.text.trim() !== '');

    const missing: string[] = [];
    if (!hasHeading) missing.push('título');
    if (!hasText) missing.push('texto explicativo');
    if (!hasCta) missing.push('llamada a la acción (CTA)');

    const findings: FindingInput[] =
      missing.length > 0
        ? [{ location: 'documento', evidence: `Faltan bloques: ${missing.join(', ')}` }]
        : [];
    return buildCheck(
      'STR_CONTENT_BLOCKS',
      findings,
      'AVISO',
      `Estructura incompleta: falta ${missing.join(', ')}`,
      'El email tiene título, texto explicativo y CTA',
    );
  }

  /** STR_INCOMPATIBLE_LAYOUT: layout poco compatible con clientes de correo → AVISO. */
  private incompatibleLayout(context: AnalysisContext): CheckInput {
    const findings = context.root
      .querySelectorAll('*')
      .filter((el) => {
        const styles = inlineStyles(el);
        const display = styles['display']?.toLowerCase() ?? '';
        const position = styles['position']?.toLowerCase() ?? '';
        return (
          /^(inline-)?(flex|grid)$/.test(display) ||
          position === 'absolute' ||
          position === 'fixed'
        );
      })
      .map(elementFinding);
    return buildCheck(
      'STR_INCOMPATIBLE_LAYOUT',
      findings,
      'AVISO',
      `${findings.length} elemento(s) con layout poco compatible (flex/grid/position)`,
      'Sin layouts incompatibles con clientes de correo',
    );
  }
}

function ancestorTables(table: HTMLElement): number {
  let count = 0;
  let node: unknown = table.parentNode;
  while (node instanceof HTMLElement) {
    if (node.tagName === 'TABLE') {
      count += 1;
    }
    node = node.parentNode;
  }
  return count;
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
    category: 'STRUCTURE',
    status: failed ? failStatus : 'OK',
    message: failed ? failMessage : okMessage,
    findings,
  };
}
