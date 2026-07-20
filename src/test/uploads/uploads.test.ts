import request from 'supertest';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Doble de persistencia (hoisted para poder referenciarlo en vi.mock) ---
const { create } = vi.hoisted(() => ({ create: vi.fn() }));

// Aislamos los tests de MySQL mockeando getPrisma().
vi.mock('@db/prisma', () => ({
  getPrisma: () => ({
    upload: { create },
    user: { findUnique: vi.fn() },
  }),
}));

import { createApp } from '../../app.js';

const app = createApp();

// Token JWT válido, firmado con el mismo secreto que usa el entorno de test.
const JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
const token = jwt.sign({ sub: 1, email: 'admin@aries.es' }, JWT_SECRET, {
  expiresIn: '1h',
});
const authHeader = `Bearer ${token}`;

// Simula la respuesta de fetch al validar una imagen pública.
const fakeFetchResponse = (ok: boolean, contentType = 'image/jpeg') => ({
  ok,
  status: ok ? 200 : 404,
  headers: {
    get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null),
  },
});

const HTML_SIN_IMAGENES = '<!doctype html><html><body><h1>Hola</h1></body></html>';
const HTML_CON_IMAGEN_PUBLICA =
  '<!doctype html><html><body><img src="https://cdn.aries.es/banner.jpg" alt="Banner"></body></html>';

beforeEach(() => {
  create.mockReset();
  // Simula el nested create de Prisma: reconstruye el agregado a partir de los datos
  // que recibe, de modo que la respuesta refleje lo que el endpoint decide persistir.
  create.mockImplementation(async ({ data }: any) => ({
    id: 1,
    type: data.type,
    originalName: data.originalName,
    created_at: new Date(),
    htmlDocuments: (data.htmlDocuments?.create ?? []).map((doc: any, i: number) => ({
      id: i + 1,
      name: doc.name,
      content: doc.content,
      relativePath: doc.relativePath ?? null,
      images: (doc.images?.create ?? []).map((img: any, j: number) => ({
        id: j + 1,
        originalName: img.originalName,
        url: img.url,
        relativePath: img.relativePath ?? null,
        mimeType: img.mimeType ?? null,
        isAccesible: img.isAccesible,
      })),
    })),
  }));
  vi.stubGlobal('fetch', vi.fn(async () => fakeFetchResponse(true)));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /uploads', () => {
  describe('autenticación (requireAuth)', () => {
    it('devuelve 401 si no se envía token', async () => {
      const res = await request(app)
        .post('/uploads')
        .attach('file', Buffer.from(HTML_SIN_IMAGENES), {
          filename: 'email.html',
          contentType: 'text/html',
        });

      expect(res.status).toBe(401);
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('validación del archivo', () => {
    it('devuelve 400 si no se adjunta ningún archivo', async () => {
      const res = await request(app).post('/uploads').set('Authorization', authHeader);

      expect(res.status).toBe(400);
      expect(create).not.toHaveBeenCalled();
    });

    it('devuelve 400 si la extensión no está soportada', async () => {
      const res = await request(app)
        .post('/uploads')
        .set('Authorization', authHeader)
        .attach('file', Buffer.from('texto plano'), {
          filename: 'notas.txt',
          contentType: 'text/plain',
        });

      expect(res.status).toBe(400);
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('subida de HTML individual', () => {
    it('acepta un .html y responde 201 con type HTML y un html_document', async () => {
      const res = await request(app)
        .post('/uploads')
        .set('Authorization', authHeader)
        .attach('file', Buffer.from(HTML_SIN_IMAGENES), {
          filename: 'email.html',
          contentType: 'text/html',
        });

      expect(res.status).toBe(201);
      expect(res.type).toMatch(/json/);
      expect(res.body.id).toBeDefined();
      expect(res.body.type).toBe('HTML');
      expect(res.body.originalName).toBe('email.html');
      expect(res.body.htmlDocuments).toHaveLength(1);
    });

    it('acepta también la extensión .htm', async () => {
      const res = await request(app)
        .post('/uploads')
        .set('Authorization', authHeader)
        .attach('file', Buffer.from(HTML_SIN_IMAGENES), {
          filename: 'email.htm',
          contentType: 'text/html',
        });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('HTML');
    });
  });

  describe('validación de imágenes públicas', () => {
    it('marca is_accesible=true cuando la URL pública responde', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => fakeFetchResponse(true)));

      const res = await request(app)
        .post('/uploads')
        .set('Authorization', authHeader)
        .attach('file', Buffer.from(HTML_CON_IMAGEN_PUBLICA), {
          filename: 'email.html',
          contentType: 'text/html',
        });

      expect(res.status).toBe(201);
      const imagen = res.body.htmlDocuments[0].images[0];
      expect(imagen.url).toBe('https://cdn.aries.es/banner.jpg');
      expect(imagen.isAccesible).toBe(true);
    });

    it('valida la URL y marca is_accesible=false cuando la imagen no es accesible', async () => {
      const fetchMock = vi.fn(async () => fakeFetchResponse(false));
      vi.stubGlobal('fetch', fetchMock);

      const res = await request(app)
        .post('/uploads')
        .set('Authorization', authHeader)
        .attach('file', Buffer.from(HTML_CON_IMAGEN_PUBLICA), {
          filename: 'email.html',
          contentType: 'text/html',
        });

      expect(res.status).toBe(201);
      expect(fetchMock).toHaveBeenCalled();
      expect(fetchMock.mock.calls[0][0]).toBe('https://cdn.aries.es/banner.jpg');
      expect(res.body.htmlDocuments[0].images[0].isAccesible).toBe(false);
    });
  });
});
