import express from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import { analyzeRouter } from './routes/analyze.js';
import type { VisionClient } from './services/vision.js';

export function createApp(opts: { client: VisionClient; model: string; maxUploadMb: number }) {
  const app = express();
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', analyzeRouter(opts));
  app.use(errorHandler);
  return app;
}
