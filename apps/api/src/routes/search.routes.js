import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { suggestQuery } from '../validators/restaurants.js';
import { suggest } from '../controllers/restaurantController.js';

const r = Router();
r.get('/suggest', validate({ query: suggestQuery }), suggest);
export default r;
