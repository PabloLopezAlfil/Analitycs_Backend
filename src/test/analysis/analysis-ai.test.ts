import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Dobles de persistencia (hoisted para poder referenciarlos en vi.mock) ---
const { findUniqueHtml, findUniqueAnalysis, updateFinding, updateCheck, updateAnalysis, transaction } =
  vi.hoisted(() => ({
    findUniqueHtml: vi.fn(),
    findUniqueAnalysis: vi.fn(),
    updateFinding: vi.fn(),
    updateCheck: vi.fn(),
    updateAnalysis: vi.fn(),
    transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  }));

vi.mock('@db/prisma', () => ({
  getPrisma: () => ({
    htmlDocument: { findUnique: findUniqueHtml },
    analysis: { findUnique: findUniqueAnalysis, update: updateAnalysis },
    analysisFinding: { update: updateFinding },
    analysisCheck: { update: updateCheck },
    user: { findUnique: vi.fn() },
    $transaction: transaction,
  }),
}));

// --- Dobles de los flows de IA (docs 0005 §7): la IA real nunca se invoca en la suite ---
const { imageContainsTextFlow, imageAltReviewFlow, imageDecorativeFlow } = vi.hoisted(() => ({
  imageContainsTextFlow: vi.fn(),
  imageAltReviewFlow: vi.fn(),
  imageDecorativeFlow: vi.fn(),
}));

vi.mock('@genkit/image-contains-text', () => ({ imageContainsTextFlow }));
vi.mock('@genkit/image-alt-review', () => ({ imageAltReviewFlow }));
vi.mock('@genkit/image-decorative', () => ({ imageDecorativeFlow }));

import { createApp } from '../../app.js';

const app = createApp();

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
const token = jwt.sign({ sub: 1, email: 'admin@aries.es' }, JWT_SECRET, { expiresIn: '1h' });
const authHeader = `Bearer ${token}`;

const HTML_ID = 12;
const ANALYSIS_ID = 7;

let imagesDir: string;
let texturaPath: string;
let ofertaPath: string;

beforeAll(async () => {
  imagesDir = await mkdtemp(join(tmpdir(), 'analysis-ai-'));
  texturaPath = join(imagesDir, 'texto.jpg');
  ofertaPath = join(imagesDir, 'oferta.jpg');
  await writeFile(texturaPath, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
  await writeFile(ofertaPath, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
});

afterAll(async () => {
  const { rm } = await import('node:fs/promises');
  await rm(imagesDir, { recursive: true, force: true });
});

// Función (no const): las rutas de las imágenes temporales solo existen tras
// beforeAll, así que el fixture se construye perezosamente en cada test.
function htmlDocument() {
  return {
    id: HTML_ID,
    uploadId: 3,
    name: 'index.html',
    content: '<!doctype html><html><body>' +
      '<img src="images/texto.jpg">' +
      '<img src="images/oferta.jpg" alt="banner">' +
      '</body></html>',
    relativePath: 'email',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    images: [
      {
        id: 1,
        htmlId: HTML_ID,
        originalName: 'texto.jpg',
        url: texturaPath,
        relativePath: 'images/texto.jpg',
        mimeType: 'image/jpeg',
        isAccesible: true,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 2,
        htmlId: HTML_ID,
        originalName: 'oferta.jpg',
        url: ofertaPath,
        relativePath: 'images/oferta.jpg',
        mimeType: 'image/jpeg',
        isAccesible: true,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
      },
    ],
  };
}

function findingRow(overrides: Record<string, unknown>) {
  return {
    id: 101,
    location: 'body > img[0]',
    evidence: '<img src="images/texto.jpg">',
    aiStatus: null,
    aiConfidence: null,
    aiProblem: null,
    aiRecommendation: null,
    ...overrides,
  };
}

function checkRow(overrides: Record<string, unknown>) {
  return {
    id: 1,
    rule: 'IMG_TEXT_IN_IMAGE',
    category: 'IMAGES',
    status: 'REVISION_PENDIENTE',
    message: 'Pendiente de validación por IA: 1 imagen(es) podrían contener texto importante',
    findings: [findingRow({})],
    ...overrides,
  };
}

function pendingAnalysis(checks: ReturnType<typeof checkRow>[]) {
  return {
    id: ANALYSIS_ID,
    htmlId: HTML_ID,
    score: 92,
    created_at: new Date('2026-01-10T12:00:00.000Z'),
    checks,
  };
}

function reviewAi(id: string | number = ANALYSIS_ID) {
  return request(app).post(`/analysis/${id}/ai`).set('Authorization', authHeader);
}

beforeEach(() => {
  findUniqueHtml.mockReset();
  findUniqueHtml.mockResolvedValue(htmlDocument());
  findUniqueAnalysis.mockReset();
  updateFinding.mockReset().mockResolvedValue({});
  updateCheck.mockReset().mockResolvedValue({});
  updateAnalysis.mockReset().mockResolvedValue({});
  transaction.mockClear();
  imageContainsTextFlow.mockReset();
  imageAltReviewFlow.mockReset();
  imageDecorativeFlow.mockReset();
});

describe('POST /analysis/:id/ai', () => {
  it('requiere token (401 sin autenticación)', async () => {
    const res = await request(app).post(`/analysis/${ANALYSIS_ID}/ai`).send();

    expect(res.status).toBe(401);
    expect(findUniqueAnalysis).not.toHaveBeenCalled();
  });

  it('devuelve 404 si el id no es numérico (sin consultar la BD)', async () => {
    const res = await reviewAi('abc');

    expect(res.status).toBe(404);
    expect(findUniqueAnalysis).not.toHaveBeenCalled();
  });

  it('devuelve 404 si el análisis no existe', async () => {
    findUniqueAnalysis.mockResolvedValue(null);

    const res = await reviewAi();

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('devuelve 404 si el documento HTML del análisis ya no existe', async () => {
    findUniqueAnalysis.mockResolvedValue(pendingAnalysis([checkRow({})]));
    findUniqueHtml.mockResolvedValue(null);

    const res = await reviewAi();

    expect(res.status).toBe(404);
  });

  it('confirma un incumplimiento (IA dice que la imagen sí contiene texto): check pasa a ERROR', async () => {
    findUniqueAnalysis
      .mockResolvedValueOnce(pendingAnalysis([checkRow({})]))
      .mockResolvedValueOnce(
        pendingAnalysis([
          checkRow({
            status: 'ERROR',
            findings: [
              findingRow({
                aiStatus: 'INCUMPLE',
                aiConfidence: 'alta',
                aiProblem: 'Contiene el texto "20% de descuento"',
                aiRecommendation: 'Añadir el texto como contenido accesible, no solo en la imagen.',
              }),
            ],
          }),
        ]),
      );
    imageContainsTextFlow.mockResolvedValue({
      criterio: 'imagen_texto',
      estado: 'INCUMPLE',
      confianza: 'alta',
      elemento: 'texto.jpg',
      problema: 'Contiene el texto "20% de descuento"',
      recomendacion: 'Añadir el texto como contenido accesible, no solo en la imagen.',
      requiere_revision: false,
    });

    const res = await reviewAi();

    expect(res.status).toBe(200);
    expect(imageContainsTextFlow).toHaveBeenCalledWith(
      expect.objectContaining({ elemento: 'texto.jpg' }),
    );
    expect(updateFinding).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 101 },
        data: expect.objectContaining({ aiStatus: 'INCUMPLE', aiConfidence: 'alta' }),
      }),
    );
    expect(updateCheck).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: expect.objectContaining({ status: 'ERROR' }) }),
    );
    const check = res.body.checks.find((c: any) => c.rule === 'IMG_TEXT_IN_IMAGE');
    expect(check.status).toBe('ERROR');
    expect(check.findings[0].aiStatus).toBe('INCUMPLE');
  });

  it('valida por IA (la imagen no contiene texto real): check pasa a VALIDADO_IA', async () => {
    findUniqueAnalysis
      .mockResolvedValueOnce(pendingAnalysis([checkRow({})]))
      .mockResolvedValueOnce(
        pendingAnalysis([
          checkRow({
            status: 'VALIDADO_IA',
            findings: [
              findingRow({
                aiStatus: 'VALIDADO_IA',
                aiConfidence: 'alta',
                aiRecommendation: 'No requiere cambios.',
              }),
            ],
          }),
        ]),
      );
    imageContainsTextFlow.mockResolvedValue({
      criterio: 'imagen_texto',
      estado: 'VALIDADO_IA',
      confianza: 'alta',
      elemento: 'texto.jpg',
      problema: null,
      recomendacion: 'No requiere cambios.',
      requiere_revision: false,
    });

    const res = await reviewAi();

    expect(res.status).toBe(200);
    const check = res.body.checks.find((c: any) => c.rule === 'IMG_TEXT_IN_IMAGE');
    expect(check.status).toBe('VALIDADO_IA');
  });

  it('confianza insuficiente: el check permanece en REVISION_PENDIENTE', async () => {
    findUniqueAnalysis
      .mockResolvedValueOnce(pendingAnalysis([checkRow({})]))
      .mockResolvedValueOnce(pendingAnalysis([checkRow({})]));
    imageContainsTextFlow.mockResolvedValue({
      criterio: 'imagen_texto',
      estado: 'REVISION_PENDIENTE',
      confianza: 'baja',
      elemento: 'texto.jpg',
      problema: null,
      recomendacion: 'Revisar manualmente.',
      requiere_revision: true,
    });

    const res = await reviewAi();

    expect(res.status).toBe(200);
    expect(updateCheck).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REVISION_PENDIENTE' }) }),
    );
  });

  it('usa reviewAltText para IMG_GENERIC_ALT enviando el alt actual', async () => {
    findUniqueAnalysis
      .mockResolvedValueOnce(
        pendingAnalysis([
          checkRow({
            id: 2,
            rule: 'IMG_GENERIC_ALT',
            status: 'AVISO',
            findings: [
              findingRow({
                id: 102,
                evidence: '<img src="images/oferta.jpg" alt="banner">',
              }),
            ],
          }),
        ]),
      )
      .mockResolvedValueOnce(pendingAnalysis([]));
    imageAltReviewFlow.mockResolvedValue({
      criterio: 'imagen_alt',
      estado: 'INCUMPLE',
      confianza: 'alta',
      elemento: 'oferta.jpg',
      problema: 'El alt "banner" es genérico',
      recomendacion: 'Describir la oferta mostrada.',
      requiere_revision: false,
    });

    const res = await reviewAi();

    expect(res.status).toBe(200);
    expect(imageAltReviewFlow).toHaveBeenCalledWith(
      expect.objectContaining({ elemento: 'oferta.jpg', alt: 'banner' }),
    );
    expect(updateCheck).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 2 }, data: expect.objectContaining({ status: 'AVISO' }) }),
    );
  });

  it('es idempotente: no vuelve a invocar la IA sobre findings ya revisados', async () => {
    findUniqueAnalysis.mockResolvedValueOnce(
      pendingAnalysis([
        checkRow({
          status: 'ERROR',
          findings: [findingRow({ aiStatus: 'INCUMPLE', aiConfidence: 'alta' })],
        }),
      ]),
    );

    const res = await reviewAi();

    expect(res.status).toBe(200);
    expect(imageContainsTextFlow).not.toHaveBeenCalled();
    // Ningún check quedó pendiente de actualizar: se devuelve el análisis tal cual.
    expect(updateCheck).not.toHaveBeenCalled();
    expect(findUniqueAnalysis).toHaveBeenCalledTimes(1);
  });

  it('no toca checks que no son candidatos a IA (p. ej. IMG_NO_ALT)', async () => {
    findUniqueAnalysis.mockResolvedValueOnce(
      pendingAnalysis([
        checkRow({
          id: 3,
          rule: 'IMG_NO_ALT',
          category: 'IMAGES',
          status: 'ERROR',
          message: '1 imagen sin alt',
          findings: [findingRow({ id: 103 })],
        }),
      ]),
    );

    const res = await reviewAi();

    expect(res.status).toBe(200);
    expect(imageContainsTextFlow).not.toHaveBeenCalled();
    expect(updateCheck).not.toHaveBeenCalled();
  });
});
