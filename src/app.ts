import express, { type Express } from 'express';
import cors from 'cors';
import { buildAuthRouter, createTokenService } from './modules/auth/auth.module.js';
import { buildUploadsRouter } from './modules/uploads/uploads.module.js';
import { buildHtmlRouter } from './modules/html/html.module.js';
import { buildImagesRouter } from './modules/images/images.module.js';
import { buildAnalysisRouter } from './modules/analysis/analysis.module.js';
import { createRequireAuth } from './middleware/auth.js';

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: 'http://localhost:5173' }));

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/auth', buildAuthRouter());


  const requireAuth = createRequireAuth(createTokenService());
  app.use('/uploads', requireAuth, buildUploadsRouter());
  app.use('/html', requireAuth, buildHtmlRouter());
  app.use('/images', requireAuth, buildImagesRouter());
  app.use('/analysis', requireAuth, buildAnalysisRouter());

  return app;
}
