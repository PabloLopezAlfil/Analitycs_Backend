import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Doble de persistencia (hoisted para poder referenciarlo en vi.mock) ---
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock('@db/prisma', () => ({
  getPrisma: () => ({
    upload: { findUnique },
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

const UPLOAD_ID = 7;

// Fila tal como la devolvería Prisma (con include de relaciones).
const uploadRow = {
  id: UPLOAD_ID,
  type: 'ZIP_SINGLE',
  originalName: 'correo.zip',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  htmlDocuments: [
    {
      id: 10,
      uploadId: UPLOAD_ID,
      name: 'index.html',
      content: '<!doctype html><html><body><h1>Hola</h1></body></html>',
      relativePath: 'email',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      images: [
        {
          id: 20,
          htmlId: 10,
          originalName: 'banner.jpg',
          url: 'storage/uploads/uuid/email/images/banner.jpg',
          relativePath: 'images/banner.jpg',
          mimeType: 'image/jpeg',
          isAccesible: true,
          created_at: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 21,
          htmlId: 10,
          originalName: 'logo.png',
          url: 'https://cdn.aries.es/logo.png',
          relativePath: null,
          mimeType: 'image/png',
          isAccesible: false,
          created_at: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    },
  ],
};

beforeEach(() => {
  findUnique.mockReset();
  findUnique.mockResolvedValue(null);
});

describe('GET /uploads/:id', () => {
  it('requiere token (401 sin autenticación)', async () => {
    const res = await request(app).get(`/uploads/${UPLOAD_ID}`);

    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('devuelve 200 con el detalle completo (html_documents e images)', async () => {
    findUnique.mockResolvedValue(uploadRow);

    const res = await request(app).get(`/uploads/${UPLOAD_ID}`).set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/json/);
    expect(res.body.id).toBe(UPLOAD_ID);
    expect(res.body.type).toBe('ZIP_SINGLE');
    expect(res.body.originalName).toBe('correo.zip');
    expect(res.body.createdAt).toBeDefined();

    // El detalle SÍ incluye las relaciones anidadas (a diferencia del listado).
    expect(res.body.htmlDocuments).toHaveLength(1);
    const doc = res.body.htmlDocuments[0];
    expect(doc.content).toContain('<h1>Hola</h1>');
    expect(doc.relativePath).toBe('email');
    expect(doc.images).toHaveLength(2);

    const local = doc.images.find((i: any) => i.relativePath === 'images/banner.jpg');
    expect(local.isAccesible).toBe(true);
    const remote = doc.images.find((i: any) => i.url === 'https://cdn.aries.es/logo.png');
    expect(remote.isAccesible).toBe(false);

    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: UPLOAD_ID } }));
  });

  it('devuelve 404 si la subida no existe', async () => {
    findUnique.mockResolvedValue(null);

    const res = await request(app).get('/uploads/999').set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });

  it('devuelve 404 si el id no es numérico (sin consultar la BD)', async () => {
    const res = await request(app).get('/uploads/abc').set('Authorization', authHeader);

    expect(res.status).toBe(404);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
