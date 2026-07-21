import request from 'supertest';
import jwt from 'jsonwebtoken';
import AdmZip from 'adm-zip';
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

// HTML del email con una imagen LOCAL (dentro del ZIP) y una PÚBLICA (remota).
const HTML_ZIP_SINGLE =
  '<!doctype html><html><body>' +
  '<img src="images/banner.jpg" alt="banner local">' +
  '<img src="https://cdn.aries.es/logo.png" alt="logo remoto">' +
  '</body></html>';

// Bytes que simulan un JPEG (no se valida el contenido real).
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

// ZIP_SINGLE: una única carpeta con un HTML y su imagen local.
function buildZipSingle(): Buffer {
  const zip = new AdmZip();
  zip.addFile('email/index.html', Buffer.from(HTML_ZIP_SINGLE));
  zip.addFile('email/images/banner.jpg', JPEG_BYTES);
  return zip.toBuffer();
}

// Simula el nested create de Prisma reconstruyendo el agregado a partir de los
// datos, para que la respuesta refleje lo que el endpoint decide persistir.
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

function uploadZipSingle() {
  return request(app)
    .post('/uploads')
    .set('Authorization', authHeader)
    .attach('file', buildZipSingle(), {
      filename: 'correo.zip',
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

describe('POST /uploads — ZIP_SINGLE', () => {
  it('detecta ZIP_SINGLE (una carpeta) y genera un único html_document', async () => {
    const res = await uploadZipSingle();

    expect(res.status).toBe(201);
    expect(res.type).toMatch(/json/);
    expect(res.body.type).toBe('ZIP_SINGLE');
    expect(res.body.htmlDocuments).toHaveLength(1);
    expect(res.body.htmlDocuments[0].relativePath).toBe('email');
  });

  it('asocia la imagen local del ZIP (accesible) sin validarla por red', async () => {
    const fetchMock = vi.fn(async () => fakeFetchResponse(true));
    vi.stubGlobal('fetch', fetchMock);

    const res = await uploadZipSingle();

    expect(res.status).toBe(201);
    const images = res.body.htmlDocuments[0].images;
    const local = images.find((i: any) => i.relativePath === 'images/banner.jpg');
    expect(local).toBeDefined();
    expect(local.isAccesible).toBe(true);
    expect(local.mimeType).toBe('image/jpeg');
    expect(typeof local.url).toBe('string');
    expect(local.url.length).toBeGreaterThan(0);

    // La imagen local NO se valida con fetch; solo la pública.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://cdn.aries.es/logo.png');
  });

  it('valida la imagen pública referenciada en el HTML (accesible)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeFetchResponse(true)));

    const res = await uploadZipSingle();

    expect(res.status).toBe(201);
    const images = res.body.htmlDocuments[0].images;
    const remote = images.find((i: any) => i.url === 'https://cdn.aries.es/logo.png');
    expect(remote).toBeDefined();
    expect(remote.isAccesible).toBe(true);
    expect(remote.relativePath).toBeNull();
  });

  it('ignora el ruido de macOS (__MACOSX/._*) y no genera documentos fantasma', async () => {
    const zip = new AdmZip();
    zip.addFile('email/index.html', Buffer.from(HTML_ZIP_SINGLE));
    zip.addFile('email/images/banner.jpg', JPEG_BYTES);
    // Basura que macOS mete al comprimir una carpeta.
    zip.addFile('__MACOSX/email/._index.html', Buffer.from([0x00, 0x05, 0x16, 0x07]));
    zip.addFile('__MACOSX/email/images/._banner.jpg', Buffer.from([0x00, 0x05, 0x16, 0x07]));
    zip.addFile('email/.DS_Store', Buffer.from([0x00, 0x00, 0x00, 0x01]));

    const res = await request(app)
      .post('/uploads')
      .set('Authorization', authHeader)
      .attach('file', zip.toBuffer(), {
        filename: 'correo.zip',
        contentType: 'application/zip',
      });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('ZIP_SINGLE');
    expect(res.body.htmlDocuments).toHaveLength(1);
    expect(res.body.htmlDocuments[0].relativePath).toBe('email');
  });

  it('marca is_accesible=false si la imagen pública no responde', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeFetchResponse(false)));

    const res = await uploadZipSingle();

    expect(res.status).toBe(201);
    const images = res.body.htmlDocuments[0].images;
    const remote = images.find((i: any) => i.url === 'https://cdn.aries.es/logo.png');
    expect(remote.isAccesible).toBe(false);
  });
});
