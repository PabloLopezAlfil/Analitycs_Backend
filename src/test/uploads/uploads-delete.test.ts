import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Dobles de persistencia (hoisted para poder referenciarlos en vi.mock) ---
const { findUnique, deleteMock } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('@db/prisma', () => ({
  getPrisma: () => ({
    upload: { findUnique, delete: deleteMock },
    user: { findUnique: vi.fn() },
  }),
}));

// Evita borrados reales en disco: interceptamos `rm` mantenimiento el resto real.
const { rm } = vi.hoisted(() => ({ rm: vi.fn(async () => undefined) }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, rm };
});

import { createApp } from '../../app.js';

const app = createApp();

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
const token = jwt.sign({ sub: 1, email: 'admin@aries.es' }, JWT_SECRET, {
  expiresIn: '1h',
});
const authHeader = `Bearer ${token}`;

const UPLOAD_ID = 7;

const LOCAL_IMAGE_URL = 'storage/uploads/uuid/email/images/banner.jpg';
const REMOTE_IMAGE_URL = 'https://cdn.aries.es/logo.png';

const localImage = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 20,
  htmlId: 10,
  originalName: 'banner.jpg',
  url: LOCAL_IMAGE_URL,
  relativePath: 'images/banner.jpg',
  mimeType: 'image/jpeg',
  isAccesible: true,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const remoteImage = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 21,
  htmlId: 10,
  originalName: 'logo.png',
  url: REMOTE_IMAGE_URL,
  relativePath: null,
  mimeType: 'image/png',
  isAccesible: false,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

// Fila tal como la devolvería Prisma (con include de relaciones), igual que en
// GET /uploads/:id: el use case necesita conocer las imágenes para poder
// borrar del disco las que son locales.
function buildUploadRow(htmlDocumentsImages: Array<ReturnType<typeof localImage>>[]) {
  return {
    id: UPLOAD_ID,
    type: 'ZIP_SINGLE',
    originalName: 'correo.zip',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    htmlDocuments: htmlDocumentsImages.map((images, i) => ({
      id: 10 + i,
      uploadId: UPLOAD_ID,
      name: 'index.html',
      content: '<!doctype html><html><body><h1>Hola</h1></body></html>',
      relativePath: 'email',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      images,
    })),
  };
}

beforeEach(() => {
  findUnique.mockReset();
  deleteMock.mockReset();
  rm.mockReset();
  findUnique.mockResolvedValue(null);
  deleteMock.mockResolvedValue(undefined);
  rm.mockResolvedValue(undefined);
});

describe('DELETE /uploads/:id', () => {
  it('requiere token (401 sin autenticación)', async () => {
    const res = await request(app).delete(`/uploads/${UPLOAD_ID}`);

    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
    expect(rm).not.toHaveBeenCalled();
  });

  it('devuelve 404 si la subida no existe', async () => {
    findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/uploads/${UPLOAD_ID}`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
    expect(deleteMock).not.toHaveBeenCalled();
    expect(rm).not.toHaveBeenCalled();
  });

  it('devuelve 404 si el id no es numérico (sin consultar la BD)', async () => {
    const res = await request(app).delete('/uploads/abc').set('Authorization', authHeader);

    expect(res.status).toBe(404);
    expect(findUnique).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('elimina la subida y responde 204 sin cuerpo', async () => {
    findUnique.mockResolvedValue(buildUploadRow([[localImage(), remoteImage()]]));

    const res = await request(app)
      .delete(`/uploads/${UPLOAD_ID}`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(deleteMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: UPLOAD_ID } }));
  });

  it('borra del disco el fichero de las imágenes locales, pero no las remotas', async () => {
    findUnique.mockResolvedValue(buildUploadRow([[localImage(), remoteImage()]]));

    const res = await request(app)
      .delete(`/uploads/${UPLOAD_ID}`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(204);
    expect(rm).toHaveBeenCalledTimes(1);
    expect(rm.mock.calls[0][0]).toBe(LOCAL_IMAGE_URL);
    expect(rm.mock.calls.some((call) => call[0] === REMOTE_IMAGE_URL)).toBe(false);
  });

  it('borra los ficheros de imágenes locales de todos los html_documents (ZIP_MULTIPLE)', async () => {
    findUnique.mockResolvedValue(
      buildUploadRow([
        [localImage({ id: 20, url: 'storage/uploads/uuid/email-1/images/banner.jpg' })],
        [localImage({ id: 22, url: 'storage/uploads/uuid/email-2/images/banner.jpg' })],
      ]),
    );

    const res = await request(app)
      .delete(`/uploads/${UPLOAD_ID}`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(204);
    expect(rm).toHaveBeenCalledTimes(2);
    const removedPaths = rm.mock.calls.map((call) => call[0]);
    expect(removedPaths).toContain('storage/uploads/uuid/email-1/images/banner.jpg');
    expect(removedPaths).toContain('storage/uploads/uuid/email-2/images/banner.jpg');
  });

  it('no falla si la subida no tiene imágenes locales (solo remotas o ninguna)', async () => {
    findUnique.mockResolvedValue(buildUploadRow([[remoteImage()], []]));

    const res = await request(app)
      .delete(`/uploads/${UPLOAD_ID}`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(204);
    expect(rm).not.toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: UPLOAD_ID } }));
  });
});
