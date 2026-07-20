import { describe, expect, it } from 'vitest';
import { buildAnalysisContext } from '../../modules/analysis/infrastructure/parsing/analysis-context.js';
import { StructureAnalyzer } from '../../modules/analysis/domain/analyzers/structure.analyzer.js';
import { LinksButtonsAnalyzer } from '../../modules/analysis/domain/analyzers/links-buttons.analyzer.js';
import { TypographyAnalyzer } from '../../modules/analysis/domain/analyzers/typography.analyzer.js';
import { ColorContrastAnalyzer } from '../../modules/analysis/domain/analyzers/color-contrast.analyzer.js';
import { ResponsiveCssAnalyzer } from '../../modules/analysis/domain/analyzers/responsive-css.analyzer.js';
import type { Analyzer } from '../../modules/analysis/domain/analyzer.interface.js';
import type { CheckInput } from '../../modules/analysis/domain/check.interface.js';

// Los analizadores son funciones puras (doc 0004 §6): fixture HTML → checks.
// Sin mocks, sin BD, sin HTTP.

function analyze(analyzer: Analyzer, html: string): CheckInput[] {
  return analyzer.analyze(buildAnalysisContext(html, []));
}

function checkOf(checks: CheckInput[], rule: string): CheckInput {
  const check = checks.find((c) => c.rule === rule);
  if (!check) throw new Error(`No existe el check ${rule}`);
  return check;
}

// ---------------------------------------------------------------- STRUCTURE

describe('StructureAnalyzer (doc 0004 §7 STRUCTURE)', () => {
  const analyzer = new StructureAnalyzer();

  it('emite las 5 reglas de la categoría', () => {
    const checks = analyze(analyzer, '<p>hola</p>');
    expect(checks).toHaveLength(5);
    expect(checks.every((c) => c.category === 'STRUCTURE')).toBe(true);
  });

  it('STR_TABLE_NO_PRESENTATION: tabla de maquetación sin role → ERROR', () => {
    const checks = analyze(
      analyzer,
      '<table><tr><td>Contenido</td></tr></table>',
    );
    const check = checkOf(checks, 'STR_TABLE_NO_PRESENTATION');
    expect(check.status).toBe('ERROR');
    expect(check.findings).toHaveLength(1);
  });

  it('STR_TABLE_NO_PRESENTATION: con role="presentation" o tabla de datos (th) → OK', () => {
    const withRole = analyze(
      analyzer,
      '<table role="presentation"><tr><td>Contenido</td></tr></table>',
    );
    expect(checkOf(withRole, 'STR_TABLE_NO_PRESENTATION').status).toBe('OK');

    const dataTable = analyze(analyzer, '<table><tr><th>Columna</th></tr></table>');
    expect(checkOf(dataTable, 'STR_TABLE_NO_PRESENTATION').status).toBe('OK');
  });

  it('STR_COMPLEX_NESTING: más de 4 niveles de tablas anidadas → AVISO', () => {
    const nested = (inner: string) =>
      `<table role="presentation"><tr><td>${inner}</td></tr></table>`;
    const fiveLevels = nested(nested(nested(nested(nested('x')))));

    const checks = analyze(analyzer, fiveLevels);
    expect(checkOf(checks, 'STR_COMPLEX_NESTING').status).toBe('AVISO');

    const fourLevels = nested(nested(nested(nested('x'))));
    expect(checkOf(analyze(analyzer, fourLevels), 'STR_COMPLEX_NESTING').status).toBe('OK');
  });

  it('STR_TOO_MANY_COLUMNS: fila con más de 3 columnas → AVISO', () => {
    const checks = analyze(
      analyzer,
      '<table role="presentation"><tr><td>1</td><td>2</td><td>3</td><td>4</td></tr></table>',
    );
    expect(checkOf(checks, 'STR_TOO_MANY_COLUMNS').status).toBe('AVISO');
  });

  it('STR_CONTENT_BLOCKS: falta título/texto/CTA → AVISO; email completo → OK', () => {
    const incomplete = analyze(analyzer, '<p>hola</p>');
    expect(checkOf(incomplete, 'STR_CONTENT_BLOCKS').status).toBe('AVISO');

    const complete = analyze(
      analyzer,
      '<h1>Título</h1><p>Texto explicativo del email completo.</p>' +
        '<a href="https://aries.es">Consulta la oferta completa</a>',
    );
    expect(checkOf(complete, 'STR_CONTENT_BLOCKS').status).toBe('OK');
  });

  it('STR_INCOMPATIBLE_LAYOUT: display:flex inline → AVISO', () => {
    const checks = analyze(analyzer, '<div style="display:flex"><p>x</p></div>');
    expect(checkOf(checks, 'STR_INCOMPATIBLE_LAYOUT').status).toBe('AVISO');
  });
});

// ------------------------------------------------------------ LINKS_BUTTONS

describe('LinksButtonsAnalyzer (doc 0004 §7 LINKS_BUTTONS)', () => {
  const analyzer = new LinksButtonsAnalyzer();

  it('emite las 6 reglas y un enlace descriptivo queda todo OK', () => {
    const checks = analyze(
      analyzer,
      '<a href="https://aries.es/ofertas">Consulta todas las ofertas de junio</a>',
    );
    expect(checks).toHaveLength(6);
    expect(checks.every((c) => c.status === 'OK')).toBe(true);
  });

  it('LNK_GENERIC_TEXT: "Ver más" → ERROR', () => {
    const checks = analyze(analyzer, '<a href="https://aries.es/x">Ver más</a>');
    const check = checkOf(checks, 'LNK_GENERIC_TEXT');
    expect(check.status).toBe('ERROR');
    expect(check.findings).toHaveLength(1);
  });

  it('LNK_EMPTY: enlace sin contenido accesible → ERROR', () => {
    const checks = analyze(analyzer, '<a href="https://aries.es/x"></a>');
    expect(checkOf(checks, 'LNK_EMPTY').status).toBe('ERROR');
  });

  it('LNK_NO_HREF: enlace sin href → ERROR', () => {
    const checks = analyze(analyzer, '<a>Enlace sin destino</a>');
    expect(checkOf(checks, 'LNK_NO_HREF').status).toBe('ERROR');
  });

  it('LNK_CTA_WEAK: botón con texto débil ("Comprar") → AVISO', () => {
    const checks = analyze(
      analyzer,
      '<a href="https://aries.es/x" style="background-color:#0057b8;padding:12px 24px">Comprar</a>',
    );
    expect(checkOf(checks, 'LNK_CTA_WEAK').status).toBe('AVISO');
  });

  it('LNK_SMALL_TARGET: botón con altura insuficiente → AVISO', () => {
    const checks = analyze(
      analyzer,
      '<a href="https://aries.es/x" style="background:#0057b8;height:20px">Suscribirse ahora</a>',
    );
    expect(checkOf(checks, 'LNK_SMALL_TARGET').status).toBe('AVISO');
  });

  it('LNK_IMG_NO_ALT: imagen enlazada sin alternativa → ERROR', () => {
    const checks = analyze(analyzer, '<a href="https://aries.es/x"><img src="promo-img.jpg"></a>');
    expect(checkOf(checks, 'LNK_IMG_NO_ALT').status).toBe('ERROR');
  });
});

// -------------------------------------------------------------- TYPOGRAPHY

describe('TypographyAnalyzer (doc 0004 §7 TYPOGRAPHY)', () => {
  const analyzer = new TypographyAnalyzer();

  it('emite las 7 reglas y un texto sin estilos queda todo OK', () => {
    const checks = analyze(analyzer, '<p>Texto normal del email.</p>');
    expect(checks).toHaveLength(7);
    expect(checks.every((c) => c.status === 'OK')).toBe(true);
  });

  it('TYP_FONT_TOO_SMALL: fuente < 14px (incluida la heredada) → ERROR', () => {
    const direct = analyze(analyzer, '<p style="font-size:12px">Texto pequeño</p>');
    expect(checkOf(direct, 'TYP_FONT_TOO_SMALL').status).toBe('ERROR');

    const inherited = analyze(
      analyzer,
      '<div style="font-size:12px"><p>Texto heredado</p></div>',
    );
    expect(checkOf(inherited, 'TYP_FONT_TOO_SMALL').status).toBe('ERROR');
  });

  it('TYP_BODY_BELOW_RECOMMENDED: 14-15px → AVISO (recomendado 16px)', () => {
    const checks = analyze(analyzer, '<p style="font-size:15px">Texto del cuerpo</p>');
    expect(checkOf(checks, 'TYP_BODY_BELOW_RECOMMENDED').status).toBe('AVISO');
    expect(checkOf(checks, 'TYP_FONT_TOO_SMALL').status).toBe('OK');
  });

  it('TYP_LINE_HEIGHT: line-height < 1.4 → AVISO', () => {
    const checks = analyze(
      analyzer,
      '<p style="font-size:16px;line-height:1.1">Texto apretado</p>',
    );
    expect(checkOf(checks, 'TYP_LINE_HEIGHT').status).toBe('AVISO');
  });

  it('TYP_LONG_BLOCK: bloque de más de 80 palabras → AVISO', () => {
    const checks = analyze(analyzer, `<p>${'palabra '.repeat(90).trim()}</p>`);
    expect(checkOf(checks, 'TYP_LONG_BLOCK').status).toBe('AVISO');
  });

  it('TYP_LEGAL_TOO_SMALL: texto legal < 12px → AVISO', () => {
    const checks = analyze(
      analyzer,
      '<p style="font-size:10px">Política de privacidad y condiciones del servicio</p>',
    );
    expect(checkOf(checks, 'TYP_LEGAL_TOO_SMALL').status).toBe('AVISO');
  });

  it('TYP_EXCESS_CAPS: bloque en mayúsculas → AVISO', () => {
    const checks = analyze(
      analyzer,
      '<p>ATENCIÓN OFERTA ESPECIAL SOLO HOY TODO AL CINCUENTA POR CIENTO</p>',
    );
    expect(checkOf(checks, 'TYP_EXCESS_CAPS').status).toBe('AVISO');
  });

  it('TYP_DENSE_BLOCK: bloque muy denso sin pausas → AVISO', () => {
    const checks = analyze(analyzer, `<div>${'palabra '.repeat(160).trim()}</div>`);
    expect(checkOf(checks, 'TYP_DENSE_BLOCK').status).toBe('AVISO');
  });
});

// ---------------------------------------------------------- COLOR_CONTRAST

describe('ColorContrastAnalyzer (doc 0004 §7 COLOR_CONTRAST)', () => {
  const analyzer = new ColorContrastAnalyzer();

  it('emite las 5 reglas y un documento sin colores queda todo OK', () => {
    const checks = analyze(analyzer, '<p>Texto sin estilos de color.</p>');
    expect(checks).toHaveLength(5);
    expect(checks.every((c) => c.status === 'OK')).toBe(true);
  });

  it('COL_CONTRAST_NORMAL: gris claro sobre blanco (ratio < 4.5) → ERROR; negro → OK', () => {
    const fails = analyze(
      analyzer,
      '<html><body style="background-color:#ffffff"><p style="color:#999999">Texto normal</p></body></html>',
    );
    expect(checkOf(fails, 'COL_CONTRAST_NORMAL').status).toBe('ERROR');

    const passes = analyze(
      analyzer,
      '<html><body style="background-color:#ffffff"><p style="color:#000000">Texto normal</p></body></html>',
    );
    expect(checkOf(passes, 'COL_CONTRAST_NORMAL').status).toBe('OK');
  });

  it('COL_CONTRAST_LARGE: texto grande con ratio < 3 → ERROR (y no cuenta como normal)', () => {
    const checks = analyze(
      analyzer,
      '<html><body style="background-color:#ffffff"><p style="color:#999999;font-size:24px">Titular grande</p></body></html>',
    );
    expect(checkOf(checks, 'COL_CONTRAST_LARGE').status).toBe('ERROR');
    expect(checkOf(checks, 'COL_CONTRAST_NORMAL').status).toBe('OK');
  });

  it('COL_NO_BG_DEFINED: color sin fondo determinable → REVISION_PENDIENTE', () => {
    const checks = analyze(analyzer, '<p style="color:#333333">Texto sin fondo</p>');
    expect(checkOf(checks, 'COL_NO_BG_DEFINED').status).toBe('REVISION_PENDIENTE');
  });

  it('COL_TEXT_OVER_IMAGE: texto sobre background-image → REVISION_PENDIENTE', () => {
    const checks = analyze(
      analyzer,
      '<div style="background-image:url(bg.jpg)"><p style="color:#ffffff">Texto sobre imagen</p></div>',
    );
    expect(checkOf(checks, 'COL_TEXT_OVER_IMAGE').status).toBe('REVISION_PENDIENTE');
  });

  it('COL_ONLY_COLOR_INFO: hay colores definidos → REVISION_PENDIENTE (candidata a IA)', () => {
    const checks = analyze(
      analyzer,
      '<html><body style="background-color:#ffffff"><p style="color:#000000">Texto</p></body></html>',
    );
    expect(checkOf(checks, 'COL_ONLY_COLOR_INFO').status).toBe('REVISION_PENDIENTE');
  });
});

// ------------------------------------------------------------ RESPONSIVE_CSS

describe('ResponsiveCssAnalyzer (doc 0004 §7 RESPONSIVE_CSS)', () => {
  const analyzer = new ResponsiveCssAnalyzer();

  it('emite las 4 reglas y un email sin CSS problemático queda todo OK', () => {
    const checks = analyze(analyzer, '<p style="font-size:16px">Texto</p>');
    expect(checks).toHaveLength(4);
    expect(checks.every((c) => c.status === 'OK')).toBe(true);
  });

  it('CSS_PROBLEMATIC_PROPERTY: display:flex en <style> → AVISO', () => {
    const checks = analyze(analyzer, '<style>.wrap{display:flex}</style><p>x</p>');
    const check = checkOf(checks, 'CSS_PROBLEMATIC_PROPERTY');
    expect(check.status).toBe('AVISO');
    expect(check.findings[0]?.evidence).toContain('flex');
  });

  it('CSS_ADVANCED_PSEUDO: ::after en <style> → AVISO', () => {
    const checks = analyze(analyzer, '<style>.btn::after{content:""}</style><p>x</p>');
    expect(checkOf(checks, 'CSS_ADVANCED_PSEUDO').status).toBe('AVISO');
  });

  it('CSS_EXTERNAL_FONTS: fuentes externas (link o @font-face) → AVISO', () => {
    const viaLink = analyze(
      analyzer,
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto"><p>x</p>',
    );
    expect(checkOf(viaLink, 'CSS_EXTERNAL_FONTS').status).toBe('AVISO');

    const viaFontFace = analyze(
      analyzer,
      '<style>@font-face{font-family:X;src:url("https://cdn.aries.es/f.woff2")}</style><p>x</p>',
    );
    expect(checkOf(viaFontFace, 'CSS_EXTERNAL_FONTS').status).toBe('AVISO');
  });

  it('CSS_CRITICAL_NOT_INLINE: estilos críticos en <style> (no inline) → AVISO', () => {
    const checks = analyze(
      analyzer,
      '<style>p{color:#333333;font-size:14px}</style><p>x</p>',
    );
    expect(checkOf(checks, 'CSS_CRITICAL_NOT_INLINE').status).toBe('AVISO');
  });
});
