import { HTMLElement } from 'node-html-parser';

/**
 * Ruta legible del elemento dentro del documento, p. ej. `html > body > img[1]`.
 * El índice solo aparece cuando hay varios hermanos con la misma etiqueta.
 */
export function locationOf(element: HTMLElement): string {
  const parts: string[] = [];
  let node: HTMLElement | null = element;

  while (node && node.tagName) {
    const current: HTMLElement = node;
    const tag = current.tagName.toLowerCase();
    const parentNode: unknown = current.parentNode;
    const parent: HTMLElement | null =
      parentNode instanceof HTMLElement && parentNode.tagName ? parentNode : null;

    if (parent) {
      const siblings = parent.childNodes.filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && child.tagName === current.tagName,
      );
      const index = siblings.indexOf(current);
      parts.unshift(siblings.length > 1 ? `${tag}[${index}]` : tag);
    } else {
      parts.unshift(tag);
    }

    node = parent;
  }

  return parts.join(' > ');
}

const MAX_EVIDENCE_LENGTH = 300;

/** Fragmento del HTML afectado, truncado para no inflar la base de datos. */
export function evidenceOf(element: HTMLElement): string {
  const html = element.outerHTML.trim();
  return html.length > MAX_EVIDENCE_LENGTH ? `${html.slice(0, MAX_EVIDENCE_LENGTH)}…` : html;
}

/** Ocurrencia estándar de un problema sobre un elemento. */
export function elementFinding(element: HTMLElement): { location: string; evidence: string } {
  return { location: locationOf(element), evidence: evidenceOf(element) };
}
