import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Dobles de persistencia (hoisted para poder referenciarlos en vi.mock) ---
const { findMany, findUnique } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock('@db/prisma', () => ({
  getPrisma: () => ({
    htmlDocument: { findMany, findUnique },
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

// Fila de detalle tal como la devolvería Prisma (con include de images).
const htmlRow = {
  id: HTML_ID,
  uploadId: 5,
  name: 'index.html',
  content: '<!doctype html><html><body><h1>Hola</h1></body></html>',
  relativePath: 'email-1',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  images: [
    {
      id: 30,
      htmlId: HTML_ID,
      originalName: 'banner.jpg',
      url: 'storage/uploads/uuid/email-1/images/banner.jpg',
      relativePath: 'images/banner.jpg',
      mimeType: 'image/jpeg',
      isAccesible: true,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      id: 31,
      htmlId: HTML_ID,
      originalName: 'logo.png',
      url: 'https://cdn.aries.es/logo.png',
      relativePath: null,
      mimeType: 'image/png',
      isAccesible: false,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    },
  ],
};

beforeEach(() => {
  findMany.mockReset();
  findUnique.mockReset();
  findUnique.mockResolvedValue(null);
});

describe('GET /html', () => {
  it('requiere token (401 sin autenticación)', async () => {
    const res = await request(app).get('/html');

    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('devuelve 200 con la lista (resumen) de html_documents', async () => {
    findMany.mockResolvedValue([
      {
        id: 1,
        uploadId: 5,
        name: 'index.html',
        content: '<html>uno</html>',
        relativePath: 'email-1',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 2,
        uploadId: 5,
        name: 'index.html',
        content: '<html>dos</html>',
        relativePath: 'email-2',
        created_at: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);

    const res = await request(app).get('/html').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/json/);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);

    const [first] = res.body;
    expect(first.id).toBe(1);
    expect(first.uploadId).toBe(5);
    expect(first.name).toBe('index.html');
    expect(first.relativePath).toBe('email-1');
    expect(first.createdAt).toBeDefined();

    // Resumen: NO incluye el content (pesado) ni las images.
    expect(first).not.toHaveProperty('content');
    expect(first).not.toHaveProperty('images');
  });

  it('devuelve un array vacío si no hay documentos', async () => {
    findMany.mockResolvedValue([]);

    const res = await request(app).get('/html').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /html/:id', () => {
  it('requiere token (401 sin autenticación)', async () => {
    const res = await request(app).get(`/html/${HTML_ID}`);

    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('devuelve 200 con el detalle (campos + content + images asociadas)', async () => {
    findUnique.mockResolvedValue(htmlRow);

    const res = await request(app).get(`/html/${HTML_ID}`).set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/json/);
    expect(res.body.id).toBe(HTML_ID);
    expect(res.body.uploadId).toBe(5);
    expect(res.body.name).toBe('index.html');
    expect(res.body.relativePath).toBe('email-1');
    expect(res.body.createdAt).toBeDefined();

    // El detalle SÍ incluye el content y las imágenes asociadas.
    expect(res.body.content).toContain('<h1>Hola</h1>');
    expect(res.body.images).toHaveLength(2);
    const local = res.body.images.find((i: any) => i.relativePath === 'images/banner.jpg');
    expect(local.isAccesible).toBe(true);
    const remote = res.body.images.find((i: any) => i.url === 'https://cdn.aries.es/logo.png');
    expect(remote.isAccesible).toBe(false);

    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: HTML_ID } }));
  });

  it('devuelve 404 si el documento no existe', async () => {
    findUnique.mockResolvedValue(null);

    const res = await request(app).get('/html/999').set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });

  it('devuelve 404 si el id no es numérico (sin consultar la BD)', async () => {
    const res = await request(app).get('/html/abc').set('Authorization', authHeader);

    expect(res.status).toBe(404);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
