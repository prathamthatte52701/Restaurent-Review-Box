import { Router } from 'express';
import { City, Cuisine, Amenity } from '../models/index.js';
import { makeMasterController } from '../controllers/masterController.js';
import { protect, restrictTo, optionalAuth, adminForInactive } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { idOrSlugParam, listQuery } from '../validators/common.js';
import * as v from '../validators/masters.js';

function build({ Model, label, usageField, withState, create, patch }) {
  const c = makeMasterController({ Model, label, usageField, withState });
  const admin = [protect, restrictTo('admin')];
  const r = Router();
  r.get('/', validate({ query: listQuery }), adminForInactive, c.list);
  r.get('/:id', optionalAuth, validate({ params: idOrSlugParam }), c.getOne);
  r.post('/', ...admin, validate({ body: create }), c.create);
  r.patch('/:id', ...admin, validate({ params: idOrSlugParam, body: patch }), c.update);
  r.delete('/:id', ...admin, validate({ params: idOrSlugParam }), c.remove);
  return r;
}

export const cityRoutes = build({ Model: City, label: 'City', usageField: 'address.city', withState: true, create: v.cityCreate, patch: v.cityPatch });
export const cuisineRoutes = build({ Model: Cuisine, label: 'Cuisine', usageField: 'cuisines', create: v.cuisineCreate, patch: v.cuisinePatch });
export const amenityRoutes = build({ Model: Amenity, label: 'Amenity', usageField: 'amenities', create: v.cuisineCreate, patch: v.cuisinePatch });
