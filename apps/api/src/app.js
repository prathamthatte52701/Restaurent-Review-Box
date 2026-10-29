import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { sanitize } from './middlewares/sanitize.js';
import { apiLimiter } from './middlewares/rateLimit.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import routes from './routes/index.js';

const BULK_PATH = '/api/v1/restaurants/bulk-import';

/** @param {(app: import('express').Express) => void} [extra] hook to mount extra routes (tests) before the 404 handler */
export function createApp(extra) {
  const app = express();
  app.disable('x-powered-by');
  if (env.isProd) app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: [env.clientUrl, env.adminUrl], credentials: true }));
  if (env.nodeEnv === 'development') app.use(morgan('dev'));

  app.use('/uploads', express.static(env.uploadsDir, { index: false, maxAge: '7d' }));

  const small = express.json({ limit: '1mb' });
  const big = express.json({ limit: '25mb' });
  app.use((req, res, next) => (req.path === BULK_PATH ? big(req, res, next) : small(req, res, next)));
  app.use(sanitize);

  app.use('/api', apiLimiter);
  app.use('/api/v1', routes);
  extra?.(app);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp();
