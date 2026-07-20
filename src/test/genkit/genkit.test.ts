import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_MIN_CONFIDENCE,
  buildAiResult,
  minConfidence,
} from '../../genkit/schemas.js';
import { fileToDataUrl } from '../../genkit/media.js';

// Nota (docs/0005): la IA real NUNCA se invoca en la suite. Aquí se testea la
// lógica determinista de la integración: la construcción del resultado
// estructurado y los helpers. Los flows se prueban manualmente con la Dev UI
// (npm run genkit:ui).

const META = { criterio: 'imagen_alt', elemento: 'banner-principal.jpg' };

const originalMin = process.env.AI_MIN_CONFIDENCE;

afterEach(() => {
  if (originalMin === undefined) {
    delete process.env.AI_MIN_CONFIDENCE;
  } else {
    process.env.AI_MIN_CONFIDENCE = originalMin;
  }
});

describe('buildAiResult (respuesta estructurada, docs/0005 §4)', () => {
  it('confianza suficiente y cumple → VALIDADO_IA sin revisión', () => {
    const result = buildAiResult(
      META,
      {
        cumple: true,
        confianza: 'alta',
        problema: null,
        recomendacion: 'No requiere cambios. El alt describe correctamente la imagen.',
      },
      'media',
    );

    expect(result).toEqual({
      criterio: 'imagen_alt',
      estado: 'VALIDADO_IA',
      confianza: 'alta',
      elemento: 'banner-principal.jpg',
      problema: null,
      recomendacion: 'No requiere cambios. El alt describe correctamente la imagen.',
      requiere_revision: false,
    });
  });

  it('confianza suficiente y NO cumple → INCUMPLE con el problema descrito', () => {
    const result = buildAiResult(
      META,
      {
        cumple: false,
        confianza: 'alta',
        problema: 'El alt "banner" es genérico y no describe la oferta mostrada',
        recomendacion: 'Describir la oferta en el alt, p. ej. "20% de descuento en junio".',
      },
      'media',
    );

    expect(result.estado).toBe('INCUMPLE');
    expect(result.problema).toContain('genérico');
    expect(result.requiere_revision).toBe(false);
  });

  it('confianza por debajo del mínimo → REVISION_PENDIENTE con revisión requerida', () => {
    const result = buildAiResult(
      META,
      {
        cumple: false,
        confianza: 'baja',
        problema: 'No se aprecia con claridad el contenido',
        recomendacion: 'Revisar manualmente la imagen.',
      },
      'media',
    );

    expect(result.estado).toBe('REVISION_PENDIENTE');
    expect(result.requiere_revision).toBe(true);
    expect(result.confianza).toBe('baja');
  });

  it('la confianza mínima es configurable: media no basta si se exige alta', () => {
    const output = {
      cumple: true,
      confianza: 'media' as const,
      problema: null,
      recomendacion: 'Correcto.',
    };

    expect(buildAiResult(META, output, 'media').estado).toBe('VALIDADO_IA');
    expect(buildAiResult(META, output, 'alta').estado).toBe('REVISION_PENDIENTE');
  });

  it('respuesta inválida (null, fallo técnico) → REVISION_PENDIENTE', () => {
    const result = buildAiResult(META, null);

    expect(result.estado).toBe('REVISION_PENDIENTE');
    expect(result.requiere_revision).toBe(true);
    expect(result.confianza).toBeNull();
    expect(result.criterio).toBe('imagen_alt');
    expect(result.elemento).toBe('banner-principal.jpg');
  });
});

describe('minConfidence (mínimo por entorno)', () => {
  it('usa AI_MIN_CONFIDENCE si es un nivel válido', () => {
    process.env.AI_MIN_CONFIDENCE = 'alta';

    expect(minConfidence()).toBe('alta');
  });

  it('cae al valor por defecto si la variable no es válida', () => {
    process.env.AI_MIN_CONFIDENCE = 'altisima';
    expect(minConfidence()).toBe(DEFAULT_MIN_CONFIDENCE);

    delete process.env.AI_MIN_CONFIDENCE;
    expect(minConfidence()).toBe(DEFAULT_MIN_CONFIDENCE);
  });
});

describe('fileToDataUrl (entrada mínima para los flows)', () => {
  it('convierte un fichero local en una data URL base64', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'genkit-media-'));
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const path = join(dir, 'imagen.jpg');
    await writeFile(path, bytes);

    const dataUrl = await fileToDataUrl(path, 'image/jpeg');

    expect(dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
    const base64 = dataUrl.slice('data:image/jpeg;base64,'.length);
    expect(Buffer.from(base64, 'base64')).toEqual(bytes);
  });
});
