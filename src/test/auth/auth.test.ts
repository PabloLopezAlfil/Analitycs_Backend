import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Dobles de prueba (hoisted para poder referenciarlos en vi.mock) ---
const { findUnique, compare } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  compare: vi.fn(),
}));

// Borde de datos: aislamos los tests de MySQL real mockeando getPrisma().
vi.mock('@db/prisma', () => ({
  getPrisma: () => ({
    user: { findUnique },
  }),
}));

// Borde de hashing: la verificación de la contraseña debe apoyarse en bcrypt.
// Se cubren ambos estilos de import (default y nombrado).
vi.mock('bcrypt', () => ({
  default: { compare },
  compare,
}));

import { createApp } from '../../app.js';

const app = createApp();

// Usuario de referencia. El valor de passwordHash es irrelevante porque
// bcrypt.compare está mockeado; lo que decide el resultado es `compare`.
const testUser = {
  id: 1,
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};

const validCredentials = {
  email: testUser.email,
  password: 'secret-password',
};

beforeEach(() => {
  findUnique.mockReset();
  compare.mockReset();
});

describe('POST /auth/login', () => {
  describe('validación del body (400)', () => {
    it('rechaza el body vacío sin consultar la base de datos', async () => {
      const res = await request(app).post('/auth/login').send({});

      expect(res.status).toBe(400);
      expect(findUnique).not.toHaveBeenCalled();
    });

    it('rechaza si falta el email', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ password: validCredentials.password });

      expect(res.status).toBe(400);
      expect(findUnique).not.toHaveBeenCalled();
    });

    it('rechaza si falta la contraseña', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: validCredentials.email });

      expect(res.status).toBe(400);
      expect(findUnique).not.toHaveBeenCalled();
    });
  });

  describe('credenciales inválidas (401)', () => {
    it('devuelve 401 si el usuario no existe y no comprueba la contraseña', async () => {
      findUnique.mockResolvedValue(null);

      const res = await request(app).post('/auth/login').send(validCredentials);

      expect(res.status).toBe(401);
      expect(compare).not.toHaveBeenCalled();
      expect(res.body).not.toHaveProperty('token');
    });

    it('devuelve 401 si la contraseña es incorrecta', async () => {
      findUnique.mockResolvedValue(testUser);
      compare.mockResolvedValue(false);

      const res = await request(app).post('/auth/login').send(validCredentials);

      expect(res.status).toBe(401);
      expect(res.body).not.toHaveProperty('token');
    });

    it('no revela si el fallo fue por usuario o por contraseña (mismo 401)', async () => {
      findUnique.mockResolvedValueOnce(null);
      const resNoUser = await request(app).post('/auth/login').send(validCredentials);

      findUnique.mockResolvedValueOnce(testUser);
      compare.mockResolvedValueOnce(false);
      const resBadPass = await request(app).post('/auth/login').send(validCredentials);

      expect(resNoUser.status).toBe(401);
      expect(resBadPass.status).toBe(401);
    });
  });

  describe('credenciales válidas (200)', () => {
    beforeEach(() => {
      findUnique.mockResolvedValue(testUser);
      compare.mockResolvedValue(true);
    });

    it('busca al usuario por email', async () => {
      await request(app).post('/auth/login').send(validCredentials);

      expect(findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: validCredentials.email } }),
      );
    });

    it('verifica la contraseña contra el hash almacenado con bcrypt', async () => {
      await request(app).post('/auth/login').send(validCredentials);

      expect(compare).toHaveBeenCalledWith(
        validCredentials.password,
        testUser.passwordHash,
      );
    });

    it('responde 200 con un token JWT y los datos públicos del usuario', async () => {
      const res = await request(app).post('/auth/login').send(validCredentials);

      expect(res.status).toBe(200);
      expect(res.type).toMatch(/json/);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.length).toBeGreaterThan(0);
      expect(res.body.user).toMatchObject({
        id: testUser.id,
        name: testUser.name,
        email: testUser.email,
      });
    });

    it('nunca expone el hash ni la contraseña en la respuesta', async () => {
      const res = await request(app).post('/auth/login').send(validCredentials);

      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.user).not.toHaveProperty('password_hash');
      expect(res.body.user).not.toHaveProperty('password');
      expect(JSON.stringify(res.body)).not.toContain(testUser.passwordHash);
    });
  });
});

describe('POST /auth/logout', () => {
  it('responde 200 con un token válido (JWT stateless: el cliente descarta el token)', async () => {
    // Obtiene un token real iniciando sesión.
    findUnique.mockResolvedValue(testUser);
    compare.mockResolvedValue(true);
    const loginRes = await request(app).post('/auth/login').send(validCredentials);
    const token = loginRes.body.token as string;

    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/json/);
  });

  it('devuelve 401 si no se envía el token', async () => {
    const res = await request(app).post('/auth/logout');

    expect(res.status).toBe(401);
  });

  it('devuelve 401 si el token es inválido', async () => {
    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', 'Bearer token-invalido');

    expect(res.status).toBe(401);
  });
});
