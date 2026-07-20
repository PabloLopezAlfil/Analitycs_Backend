import { HTMLElement, TextNode } from 'node-html-parser';

/** Texto propio del elemento (sin el de sus descendientes). */
export function ownText(element: HTMLElement): string {
  return element.childNodes
    .filter((node): node is TextNode => node instanceof TextNode)
    .map((node) => node.text)
    .join(' ')
    .trim();
}

/** Declaraciones del atributo style, normalizadas a minúsculas. */
export function inlineStyles(element: HTMLElement): Record<string, string> {
  const style = element.getAttribute('style');
  if (!style) {
    return {};
  }
  const styles: Record<string, string> = {};
  for (const declaration of style.split(';')) {
    const separator = declaration.indexOf(':');
    if (separator === -1) {
      continue;
    }
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    if (property && value) {
      styles[property] = value;
    }
  }
  return styles;
}

/**
 * Valor de una propiedad heredable: se busca en el propio elemento y, si no
 * está, hacia arriba en sus ancestros (herencia simplificada: solo estilos
 * inline, el caso dominante en emails).
 */
export function inheritedStyle(element: HTMLElement, property: string): string | null {
  let node: HTMLElement | null = element;
  while (node) {
    const value = inlineStyles(node)[property];
    if (value !== undefined) {
      return value;
    }
    const parent: unknown = node.parentNode;
    node = parent instanceof HTMLElement ? parent : null;
  }
  return null;
}

/** Número de píxeles de un valor CSS (`14px` → 14), o null si no es px. */
export function pxNumber(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*px$/i);
  return match && match[1] !== undefined ? Number(match[1]) : null;
}

/** Tamaño de fuente efectivo en px (heredado), o null si no es determinable. */
export function effectiveFontSize(element: HTMLElement): number | null {
  return pxNumber(inheritedStyle(element, 'font-size'));
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// --- Color y contraste (WCAG 2.1) ---

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const NAMED_COLORS: Record<string, Rgb> = {
  white: { r: 255, g: 255, b: 255 },
  black: { r: 0, g: 0, b: 0 },
  gray: { r: 128, g: 128, b: 128 },
  grey: { r: 128, g: 128, b: 128 },
  silver: { r: 192, g: 192, b: 192 },
  red: { r: 255, g: 0, b: 0 },
  maroon: { r: 128, g: 0, b: 0 },
  yellow: { r: 255, g: 255, b: 0 },
  olive: { r: 128, g: 128, b: 0 },
  lime: { r: 0, g: 255, b: 0 },
  green: { r: 0, g: 128, b: 0 },
  aqua: { r: 0, g: 255, b: 255 },
  teal: { r: 0, g: 128, b: 128 },
  blue: { r: 0, g: 0, b: 255 },
  navy: { r: 0, g: 0, b: 128 },
  fuchsia: { r: 255, g: 0, b: 255 },
  purple: { r: 128, g: 0, b: 128 },
  orange: { r: 255, g: 165, b: 0 },
};

/** Parsea colores hex (#abc, #aabbcc), rgb()/rgba() y nombres básicos. */
export function parseColor(value: string | null | undefined): Rgb | null {
  if (!value) {
    return null;
  }
  const v = value.trim().toLowerCase();

  const named = NAMED_COLORS[v];
  if (named) {
    return named;
  }

  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex && hex[1] !== undefined) {
    const digits = hex[1];
    const full =
      digits.length === 3
        ? digits.split('').map((d) => d + d).join('')
        : digits;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }

  const rgb = v.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (rgb && rgb[1] !== undefined && rgb[2] !== undefined && rgb[3] !== undefined) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }

  return null;
}

function linearChannel(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(color: Rgb): number {
  return (
    0.2126 * linearChannel(color.r) +
    0.7152 * linearChannel(color.g) +
    0.0722 * linearChannel(color.b)
  );
}

/** Ratio de contraste WCAG entre dos colores (1–21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [lighter, darker] = la >= lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}
