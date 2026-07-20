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
    image: { findMany, findUnique },
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

// Fila tal como la devolvería Prisma.
const imageRow = (id: number, htmlId: number, name: string) => ({
  id,
  htmlId,
  originalName: name,
  url: `storage/uploads/uuid/email-1/images/${name}`,
  relativePath: `images/${name}`,
  mimeType: 'image/jpeg',
  isAccesible: true,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
});

beforeEach(() => {
  findMany.mockReset();
  findMany.mockResolvedValue([]);
  findUnique.mockReset();
  findUnique.mockResolvedValue(null);
});

describe('GET /images', () => {
  it('requiere token (401 sin autenticación)', async () => {
    const res = await request(app).get('/images');

    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('devuelve 200 con la lista de todas las imágenes', async () => {
    findMany.mockResolvedValue([imageRow(1, 10, 'banner.jpg'), imageRow(2, 11, 'logo.png')]);

    const res = await request(app).get('/images').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/json/);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);

    const [first] = res.body;
    expect(first.id).toBe(1);
    expect(first.htmlId).toBe(10);
    expect(first.originalName).toBe('banner.jpg');
    expect(first.url).toBeDefined();
    expect(first.relativePath).toBe('images/banner.jpg');
    expect(first.mimeType).toBe('image/jpeg');
    expect(first.isAccesible).toBe(true);
    expect(first.createdAt).toBeDefined();
  });

  it('devuelve un array vacío si no hay imágenes', async () => {
    findMany.mockResolvedValue([]);

    const res = await request(app).get('/images').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('filtra por documento con ?html_id', async () => {
    findMany.mockResolvedValue([imageRow(1, 10, 'banner.jpg')]);

    const res = await request(app).get('/images?html_id=10').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { htmlId: 10 } }));
  });
});

describe('GET /images/:id', () => {
  const IMAGE_ID = 30;

  it('requiere token (401 sin autenticación)', async () => {
    const res = await request(app).get(`/images/${IMAGE_ID}`);

    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('devuelve 200 con el detalle de la imagen', async () => {
    findUnique.mockResolvedValue(imageRow(IMAGE_ID, 12, 'banner.jpg'));

    const res = await request(app).get(`/images/${IMAGE_ID}`).set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/json/);
    expect(res.body.id).toBe(IMAGE_ID);
    expect(res.body.htmlId).toBe(12);
    expect(res.body.originalName).toBe('banner.jpg');
    expect(res.body.url).toBeDefined();
    expect(res.body.relativePath).toBe('images/banner.jpg');
    expect(res.body.mimeType).toBe('image/jpeg');
    expect(res.body.isAccesible).toBe(true);
    expect(res.body.createdAt).toBeDefined();

    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: IMAGE_ID } }));
  });

  it('devuelve 404 si la imagen no existe', async () => {
    findUnique.mockResolvedValue(null);

    const res = await request(app).get('/images/999').set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });

  it('devuelve 404 si el id no es numérico (sin consultar la BD)', async () => {
    const res = await request(app).get('/images/abc').set('Authorization', authHeader);

    expect(res.status).toBe(404);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
