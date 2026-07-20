import type { Router } from 'express';
import { getPrisma } from '../../db/prisma.js';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository.js';
import { BcryptPasswordHasher } from './infrastructure/security/password.hasher.js';
import { JwtTokenService } from './infrastructure/security/token.service.js';
import { LoginUseCase } from './domain/login.use-case.js';
import { AuthRouter } from './infrastructure/transport/auth.router.js';
import { createRequireAuth } from '../../middleware/auth.js';

// Configuración del token JWT.
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
const JWT_EXPIRES_IN = Number(process.env.JWT_EXPIRES_IN) || 3600; // segundos

/**
 * Fuente única del servicio de tokens, compartida por el router de auth y por
 * el middleware `requireAuth` que protege el resto de recursos (app.ts).
 */
export function createTokenService(): JwtTokenService {
  return new JwtTokenService(JWT_SECRET, JWT_EXPIRES_IN);
}

/**
 * Composition root del módulo de autenticación: instancia los adaptadores
 * concretos, los inyecta en los casos de uso y devuelve el router listo para
 * montar. Es el único punto que conoce las implementaciones concretas.
 */
export function buildAuthRouter(): Router {
  const users = new PrismaUserRepository(getPrisma());
  const hasher = new BcryptPasswordHasher();
  const tokens = createTokenService();

  const login = new LoginUseCase(users, hasher, tokens);
  const requireAuth = createRequireAuth(tokens);

  return AuthRouter({ login, requireAuth });
}
