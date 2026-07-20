import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Doble de persistencia (hoisted para poder referenciarlo en vi.mock) ---
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock('@db/prisma', () => ({
  getPrisma: () => ({
    upload: { findMany },
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

beforeEach(() => {
  findMany.mockReset();
});

describe('GET /uploads', () => {
  it('requiere token (401 sin autenticación)', async () => {
    const res = await request(app).get('/uploads');

    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('devuelve 200 con la lista (resumen) de todas las subidas', async () => {
    findMany.mockResolvedValue([
      {
        id: 1,
        type: 'HTML',
        originalName: 'correo.html',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 2,
        type: 'ZIP_MULTIPLE',
        originalName: 'lote.zip',
        created_at: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);

    const res = await request(app).get('/uploads').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/json/);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);

    const [first] = res.body;
    expect(first.id).toBe(1);
    expect(first.type).toBe('HTML');
    expect(first.originalName).toBe('correo.html');
    expect(first.createdAt).toBeDefined();
  });

  it('devuelve un array vacío si no hay subidas', async () => {
    findMany.mockResolvedValue([]);

    const res = await request(app).get('/uploads').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
