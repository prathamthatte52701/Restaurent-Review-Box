import { Router } from 'express';
import { protect, restrictTo } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { mapLinkLimiter } from '../middlewares/rateLimit.js';
import { resolveMapLinkBody } from '../validators/utils.js';
import { resolveMap } from '../controllers/utilsController.js';

const r = Router();
r.post('/resolve-map-link', protect, restrictTo('admin'), mapLinkLimiter, validate({ body: resolveMapLinkBody }), resolveMap);
export default r;
