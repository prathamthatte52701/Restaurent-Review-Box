import { Router } from 'express';
import { protect, restrictTo, optionalAuth, adminForInactive } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { uploadOne, uploadMany } from '../middlewares/upload.js';
import { idParam, idOrSlugParam } from '../validators/common.js';
import * as v from '../validators/restaurants.js';
import * as c from '../controllers/restaurantController.js';

const r = Router();
const admin = [protect, restrictTo('admin')]; // always before multer so anonymous users never get to buffer uploads

r.get('/', validate({ query: v.restaurantListQuery }), adminForInactive, c.list);
r.post('/bulk-import', ...admin, validate({ body: v.bulkBody }), c.bulkImport);
r.get('/:id', optionalAuth, validate({ params: idOrSlugParam }), c.getOne);

r.post('/', ...admin, validate({ body: v.restaurantCreate }), c.create);
r.patch('/:id', ...admin, validate({ params: idParam, body: v.restaurantPatch }), c.update);
r.delete('/:id', ...admin, validate({ params: idParam }), c.remove);
r.patch('/:id/toggle', ...admin, validate({ params: idParam, body: v.toggleBody }), c.toggle);

r.patch('/:id/cover', ...admin, validate({ params: idParam }), uploadOne, c.setCover);
r.post('/:id/gallery', ...admin, validate({ params: idParam }), uploadMany, c.addGallery);
r.patch('/:id/gallery/reorder', ...admin, validate({ params: idParam, body: v.reorderBody }), c.reorderGallery);
r.delete('/:id/gallery/:imageId', ...admin, validate({ params: v.galleryParams }), c.removeGalleryImage);

export default r;
