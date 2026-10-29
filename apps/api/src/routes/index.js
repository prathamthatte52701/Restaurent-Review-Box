import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { sendOk } from '../utils/response.js';
import authRoutes from './auth.routes.js';

const r = Router();

r.get('/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  sendOk(
    res,
    {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      db: { state: states[mongoose.connection.readyState] || 'unknown', name: mongoose.connection.name || null },
      env: env.nodeEnv,
    },
    'Healthy',
  );
});

r.use('/auth', authRoutes);

export default r;
