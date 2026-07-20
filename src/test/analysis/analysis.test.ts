import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Dobles de persistencia (hoisted para poder referenciarlos en vi.mock) ---
const { findUnique, create } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@db/prisma', () => ({
  getPrisma: () => ({
    htmlDocument: { findUnique },
    analysis: { create },
    user: { findUnique: vi.fn() },
  }),
}));

import { createApp } from '../../app.js';

const app = createApp();

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
const token = jwt.sign({ sub: 1, email: 'admin@aries.es' }, JWT_SECRET, {
  expiresIn: '1h',
});
const authHeader = `Bearer ${token}`;

const HTML_ID = 12;

// --- Fixtures: html_document con sus images, tal como los devolvería Prisma ---

/** Documento limpio: título + texto + CTA, sin imágenes ni estilos problemáticos. */
const cleanDoc = {
  id: HTML_ID,
  uploadId: 3,
  name: 'index.html',
  content:
    '<!doctype html><html><body><h1>Hola</h1>' +
    '<p>Texto del email con la información principal.</p>' +
    '<a href="https://aries.es/ofertas">Consulta todas las ofertas</a>' +
    '</body></html>',
  relativePath: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  images: [],
};

/**
 * Documento con problemas:
 *  - <img> sin atributo alt        → IMG_NO_ALT (ERROR)
 *  - imagen rota (is_accesible=false, calculado en la fase 0002) → IMG_BROKEN (ERROR)
 *  - hay imágenes → IMG_TEXT_IN_IMAGE queda REVISION_PENDIENTE (IA pendiente, doc 0004 §3)
 */
const dirtyDoc = {
  id: HTML_ID,
  uploadId: 3,
  name: 'index.html',
  content:
    '<!doctype html><html><body>' +
    '<img src="images/foo.jpg">' +
    '<img src="images/rota.png" alt="Gráfica de ventas de junio">' +
    '</body></html>',
  relativePath: 'email',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  images: [
    {
      id: 1,
      htmlId: HTML_ID,
      originalName: 'foo.jpg',
      url: 'storage/uploads/uuid/email/images/foo.jpg',
      relativePath: 'images/foo.jpg',
      mimeType: 'image/jpeg',
      isAccesible: true,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      id: 2,
      htmlId: HTML_ID,
      originalName: 'rota.png',
      url: 'storage/uploads/uuid/email/images/rota.png',
      relativePath: 'images/rota.png',
      mimeType: 'image/png',
      isAccesible: false,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    },
  ],
};

// Simula el nested create de Prisma reconstruyendo el agregado a partir de los
// datos, para que la respuesta refleje lo que el endpoint decide persistir.
const echoCreate = async ({ data }: any) => ({
  id: 1,
  htmlId: data.htmlId,
  score: data.score ?? null,
  created_at: new Date(),
  checks: (data.checks?.create ?? []).map((check: any, i: number) => ({
    id: i + 1,
    rule: check.rule,
    category: check.category,
    status: check.status,
    message: check.message,
    findings: (check.findings?.create ?? []).map((finding: any, j: number) => ({
      id: j + 1,
      location: finding.location,
      evidence: finding.evidence,
    })),
  })),
});

function postAnalysis(body: unknown) {
  return request(app).post('/analysis').set('Authorization', authHeader).send(body as object);
}

beforeEach(() => {
  findUnique.mockReset();
  findUnique.mockResolvedValue(null);
  create.mockReset();
  create.mockImplementation(echoCreate);
});

describe('POST /analysis', () => {
  describe('autenticación y validación', () => {
    it('requiere token (401 sin autenticación)', async () => {
      const res = await request(app).post('/analysis').send({ htmlId: HTML_ID });

      expect(res.status).toBe(401);
      expect(findUnique).not.toHaveBeenCalled();
    });

    it('devuelve 400 si falta htmlId (sin consultar la BD)', async () => {
      const res = await postAnalysis({});

      expect(res.status).toBe(400);
      expect(findUnique).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });

    it('devuelve 400 si htmlId no es numérico (sin consultar la BD)', async () => {
      const res = await postAnalysis({ htmlId: 'abc' });

      expect(res.status).toBe(400);
      expect(findUnique).not.toHaveBeenCalled();
    });

    it('devuelve 404 si el documento HTML no existe', async () => {
      findUnique.mockResolvedValue(null);

      const res = await postAnalysis({ htmlId: 999 });

      expect(res.status).toBe(404);
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('documento limpio (sin imágenes)', () => {
    it('devuelve 201 con el catálogo completo en OK y score 100', async () => {
      findUnique.mockResolvedValue(cleanDoc);

      const res = await postAnalysis({ htmlId: HTML_ID });

      expect(res.status).toBe(201);
      expect(res.type).toMatch(/json/);
      expect(res.body.htmlId).toBe(HTML_ID);
      expect(res.body.score).toBe(100);
      expect(res.body.createdAt).toBeDefined();

      // Incrementos 1-5: el catálogo completo (doc 0004 §7), una fila por regla:
      // 7 IMAGES + 5 STRUCTURE + 6 LINKS_BUTTONS + 7 TYPOGRAPHY + 5 COLOR_CONTRAST + 4 RESPONSIVE_CSS.
      expect(res.body.checks).toHaveLength(34);
      for (const check of res.body.checks) {
        expect(check.status).toBe('OK');
        expect(check.findings).toEqual([]);
      }
      const imageChecks = res.body.checks.filter((c: any) => c.category === 'IMAGES');
      expect(imageChecks).toHaveLength(7);
    });

    it('persiste el análisis (analysis.create) asociado al documento', async () => {
      findUnique.mockResolvedValue(cleanDoc);

      await postAnalysis({ htmlId: HTML_ID });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ htmlId: HTML_ID, score: 100 }),
        }),
      );
    });
  });

  describe('documento con problemas de imágenes', () => {
    beforeEach(() => {
      findUnique.mockResolvedValue(dirtyDoc);
    });

    it('marca IMG_NO_ALT como ERROR con su ocurrencia (location + evidence)', async () => {
      const res = await postAnalysis({ htmlId: HTML_ID });

      expect(res.status).toBe(201);
      const check = res.body.checks.find((c: any) => c.rule === 'IMG_NO_ALT');
      expect(check).toBeDefined();
      expect(check.status).toBe('ERROR');
      expect(check.findings).toHaveLength(1);
      expect(check.findings[0].evidence).toContain('images/foo.jpg');
      expect(check.findings[0].location).toBeDefined();
    });

    it('marca IMG_BROKEN como ERROR usando el is_accesible de la fase 0002', async () => {
      const res = await postAnalysis({ htmlId: HTML_ID });

      const check = res.body.checks.find((c: any) => c.rule === 'IMG_BROKEN');
      expect(check).toBeDefined();
      expect(check.status).toBe('ERROR');
      expect(check.findings).toHaveLength(1);
      expect(check.findings[0].evidence).toContain('rota.png');
    });

    it('deja IMG_TEXT_IN_IMAGE en REVISION_PENDIENTE mientras la IA no esté conectada', async () => {
      const res = await postAnalysis({ htmlId: HTML_ID });

      const check = res.body.checks.find((c: any) => c.rule === 'IMG_TEXT_IN_IMAGE');
      expect(check).toBeDefined();
      expect(check.status).toBe('REVISION_PENDIENTE');
    });

    it('calcula el score excluyendo las reglas REVISION_PENDIENTE (doc 0004 §4)', async () => {
      // Estados esperados sobre las 34 reglas: 2 ERROR (imágenes, 0 ptos),
      // 1 AVISO (STR_CONTENT_BLOCKS: solo hay imágenes, 0.5 ptos),
      // 1 REVISION_PENDIENTE (IMG_TEXT_IN_IMAGE, excluida) y 30 OK (30 ptos).
      // score = redondear(100 × 30.5 / 33) = 92.
      const res = await postAnalysis({ htmlId: HTML_ID });

      expect(res.body.score).toBe(92);
    });
  });
});
