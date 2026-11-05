import express from 'express';
import cors from 'cors';
import { config, APP_VERSION } from './config.js';
import { initDb } from './db/sqlite.js';
import { ApiError } from './errors.js';
import { authRouter } from './routes/auth.js';
import { hospitalRouter } from './routes/hospitals.js';
import { mapRouter } from './routes/maps.js';
import { entranceRouter } from './routes/entrances.js';
import { qrRouter, qrResolveRouter } from './routes/qr.js';
import { feedbackRouter, feedbackPublicRouter } from './routes/feedback.js';
import { auditRouter } from './routes/public.js';
import { patientRouter } from './routes/patient.js';

export function createApp() {
  initDb(); // create schema + seed if missing
  const app = express();
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '5mb' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok', version: APP_VERSION, time: new Date().toISOString() }));

  // Public patient API
  app.use('/api/patient', patientRouter);
  app.use('/api/patient', qrResolveRouter);
  app.use('/api/patient', feedbackPublicRouter);

  // Admin API
  app.use('/api/auth', authRouter);
  app.use('/api/admin/hospitals', hospitalRouter);
  app.use('/api/admin/hospitals', mapRouter);
  app.use('/api/admin/hospitals', entranceRouter);
  app.use('/api/admin/hospitals', qrRouter);
  app.use('/api/admin/hospitals', feedbackRouter);
  app.use('/api/admin/hospitals', auditRouter);

  // 404
  app.use((req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });
  });

  // Central error handler
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ApiError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details ?? undefined } });
    }
    if (err instanceof Error && (err as unknown as { code?: string }).code && (err as unknown as { code: string }).code.startsWith('QR')) {
      return res.status(400).json({ error: { code: (err as unknown as { code: string }).code, message: err.message } });
    }
    // Zod errors handled by parse(); otherwise 500.
    console.error('[unhandled]', err);
    return res.status(500).json({ error: { code: 'internal_error', message: 'Internal server error' } });
  });

  return app;
}
