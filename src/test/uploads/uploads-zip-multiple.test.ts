import request from 'supertest';
import jwt from 'jsonwebtoken';
import AdmZip from 'adm-zip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Doble de persistencia (hoisted para poder referenciarlo en vi.mock) ---
const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('@db/prisma', () => ({
  getPrisma: () => ({
    upload: { create },
    user: { findUnique: vi.fn() },
  }),
}));

// Evita escrituras reales en disco al guardar las imágenes locales del ZIP,
// manteniendo readFile real (el router lo usa para leer el archivo subido).
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    writeFile: vi.fn(async () => undefined),
    mkdir: vi.fn(async () => undefined),
  };
});

import { createApp } from '../../app.js';

const app = createApp();

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
const token = jwt.sign({ sub: 1, email: 'admin@aries.es' }, JWT_SECRET, {
  expiresIn: '1h',
});
const authHeader = `Bearer ${token}`;

const fakeFetchResponse = (ok: boolean, contentType = 'image/jpeg') => ({
  ok,
  status: ok ? 200 : 404,
  headers: {
    get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null),
  },
});

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

// ZIP_MULTIPLE: varias carpetas, cada una un email independiente.
function buildZipMultiple(): Buffer {
  const html1 =
    '<!doctype html><html><body>' +
    '<img src="images/banner1.jpg" alt="local 1">' +
    '<img src="https://cdn.aries.es/logo1.png" alt="remota 1">' +
    '</body></html>';
  const html2 =
    '<!doctype html><html><body>' +
    '<img src="images/banner2.jpg" alt="local 2">' +
    '</body></html>';

  const zip = new AdmZip();
  zip.addFile('email-1/index.html', Buffer.from(html1));
  zip.addFile('email-1/images/banner1.jpg', JPEG_BYTES);
  zip.addFile('email-2/index.html', Buffer.from(html2));
  zip.addFile('email-2/images/banner2.jpg', JPEG_BYTES);
  return zip.toBuffer();
}

// Simula el nested create de Prisma reconstruyendo el agregado a partir de los datos.
const echoCreate = async ({ data }: any) => ({
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
});

function uploadZipMultiple() {
  return request(app)
    .post('/uploads')
    .set('Authorization', authHeader)
    .attach('file', buildZipMultiple(), {
      filename: 'lote.zip',
      contentType: 'application/zip',
    });
}

beforeEach(() => {
  create.mockReset();
  create.mockImplementation(echoCreate);
  vi.stubGlobal('fetch', vi.fn(async () => fakeFetchResponse(true)));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /uploads — ZIP_MULTIPLE', () => {
  it('detecta ZIP_MULTIPLE (varias carpetas) y genera un html_document por carpeta', async () => {
    const res = await uploadZipMultiple();

    expect(res.status).toBe(201);
    expect(res.type).toMatch(/json/);
    expect(res.body.type).toBe('ZIP_MULTIPLE');
    expect(res.body.htmlDocuments).toHaveLength(2);

    const folders = res.body.htmlDocuments.map((d: any) => d.relativePath).sort();
    expect(folders).toEqual(['email-1', 'email-2']);
  });

  it('asocia cada imagen local con su email correspondiente', async () => {
    const res = await uploadZipMultiple();

    expect(res.status).toBe(201);
    const doc1 = res.body.htmlDocuments.find((d: any) => d.relativePath === 'email-1');
    const doc2 = res.body.htmlDocuments.find((d: any) => d.relativePath === 'email-2');
    expect(doc1).toBeDefined();
    expect(doc2).toBeDefined();

    const local1 = doc1.images.find((i: any) => i.relativePath === 'images/banner1.jpg');
    expect(local1).toBeDefined();
    expect(local1.isAccesible).toBe(true);
    expect(local1.mimeType).toBe('image/jpeg');

    const local2 = doc2.images.find((i: any) => i.relativePath === 'images/banner2.jpg');
    expect(local2).toBeDefined();
    expect(local2.isAccesible).toBe(true);

    // Cada email tiene SOLO su imagen local, no la del otro.
    expect(doc1.images.some((i: any) => i.relativePath === 'images/banner2.jpg')).toBe(false);
    expect(doc2.images.some((i: any) => i.relativePath === 'images/banner1.jpg')).toBe(false);
  });

  it('valida las imágenes públicas de cada email', async () => {
    const res = await uploadZipMultiple();

    expect(res.status).toBe(201);
    const doc1 = res.body.htmlDocuments.find((d: any) => d.relativePath === 'email-1');
    const remote = doc1.images.find((i: any) => i.url === 'https://cdn.aries.es/logo1.png');
    expect(remote).toBeDefined();
    expect(remote.isAccesible).toBe(true);
    expect(remote.relativePath).toBeNull();
  });
});
