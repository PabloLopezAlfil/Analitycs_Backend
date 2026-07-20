import { Router, type RequestHandler } from 'express';
import { LoginUseCase } from '../../domain/login.use-case.js';
import { ValidationError, InvalidCredentialsError } from '../../domain/errors.js';

interface AuthRouterDeps {
  login: LoginUseCase;
  requireAuth: RequestHandler;
}


export function AuthRouter({ login, requireAuth }: AuthRouterDeps): Router {
  const router = Router();

  router.post('/login', async (req, res) => {
    try {
      const result = await login.execute({
        email: req.body?.email,
        password: req.body?.password,
      });
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error instanceof InvalidCredentialsError) {
        res.status(401).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  router.post('/logout', requireAuth, (_req, res) => {
    
    res.status(200).json({ message: 'Sesión cerrada' });
  });

  return router;
}
