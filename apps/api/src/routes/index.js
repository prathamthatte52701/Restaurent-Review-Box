import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { sendOk } from '../utils/response.js';
import { protect, restrictTo } from '../middlewares/auth.js';
import { stats } from '../controllers/adminController.js';
import authRoutes from './auth.routes.js';
import restaurantRoutes from './restaurant.routes.js';
import { cityRoutes, cuisineRoutes, amenityRoutes } from './masters.routes.js';

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
r.use('/cities', cityRoutes);
r.use('/cuisines', cuisineRoutes);
r.use('/amenities', amenityRoutes);
r.use('/restaurants', restaurantRoutes);
r.get('/admin/stats', protect, restrictTo('admin'), stats);

export default r;
