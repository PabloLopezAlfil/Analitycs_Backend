import type { RequestHandler } from 'express';
import type { TokenService, TokenPayload } from '../modules/auth/infrastructure/security/token.service.js';

declare global {
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}


export function createRequireAuth(tokens: TokenService): RequestHandler {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const token = header.slice('Bearer '.length).trim();
    const payload = tokens.verify(token);
    if (!payload) {
      res.status(401).json({ error: 'Token inválido o caducado' });
      return;
    }

    req.auth = payload;
    next();
  };
}
