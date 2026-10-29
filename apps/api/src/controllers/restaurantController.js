import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendOk, sendList } from '../utils/response.js';
import { runListQuery } from '../utils/queryHelper.js';
import { createWithSlug, toSlug } from '../utils/slug.js';
import { City, Cuisine, Amenity } from '../models/index.js';
import Restaurant, { costBracketOf } from '../models/Restaurant.js';
import { storeImages, removeImages } from '../services/imageService.js';
import { importRestaurants } from '../services/restaurantImport.js';

const MAX_GALLERY = 10;
const isObjectId = (v) => /^[a-f\d]{24}$/i.test(v);
const byIdOrSlug = (v) => (isObjectId(v) ? { _id: v } : { slug: String(v).toLowerCase() });
const POPULATE = [
  { path: 'address.city', select: 'name state slug' },
  { path: 'cuisines', select: 'name slug icon' },
  { path: 'amenities', select: 'name slug icon' },
];

/** 400 with a clear field message when referenced masters do not exist. */
async function assertRefs({ city, cuisines = [], amenities = [] }) {
  const errors = {};
  const check = async (Model, ids, key, label) => {
    const uniq = [...new Set(ids)];
    if (!uniq.length) return;
    const found = new Set((await Model.find({ _id: { $in: uniq } }, '_id').lean()).map((d) => String(d._id)));
    const missing = uniq.filter((i) => !found.has(String(i)));
    if (missing.length) errors[key] = `${label} not found: ${missing.join(', ')}`;
  };
  await Promise.all([
    check(City, city ? [city] : [], 'address.city', 'City'),
    check(Cuisine, cuisines, 'cuisines', 'Cuisine id(s)'),
    check(Amenity, amenities, 'amenities', 'Amenity id(s)'),
  ]);
  if (Object.keys(errors).length) throw ApiError.badRequest(Object.values(errors).join('; '), errors);
}

async function idsFromCsv(Model, csvValue) {
  const parts = csvValue.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20);
  const docs = await Model.find({ $or: [{ _id: { $in: parts.filter(isObjectId) } }, { slug: { $in: parts.filter((p) => !isObjectId(p)).map((p) => p.toLowerCase()) } }] }, '_id').lean();
  return docs.map((d) => d._id);
}

const load = async (id) => {
  const doc = await Restaurant.findOne(byIdOrSlug(id));
  if (!doc) throw ApiError.notFound('Restaurant not found');
  return doc;
};

export const list = asyncHandler(async (req, res) => {
  const q = req.validated.query;
  const filter = {};
  if (q.includeInactive === 'true') {
    if (q.isActive) filter.isActive = q.isActive === 'true';
  } else filter.isActive = true;
  if (q.isFeatured) filter.isFeatured = q.isFeatured === 'true';
  const split = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
  if (q.category) filter.category = { $in: split(q.category) };
  if (q.type) filter.type = { $in: split(q.type) };
  if (q.costBracket) filter.costBracket = { $in: split(q.costBracket) };
  if (q.city) filter['address.city'] = { $in: await idsFromCsv(City, q.city) };
  if (q.cuisine) filter.cuisines = { $in: await idsFromCsv(Cuisine, q.cuisine) };
  if (q.amenity) filter.amenities = { $in: await idsFromCsv(Amenity, q.amenity) };

  const out = await runListQuery(Restaurant, req.query, {
    filter,
    searchFields: ['name', 'address.area', 'address.line1', 'ownerName'],
    sortable: ['createdAt', 'name', 'ratingAvg', 'ratingCount', 'priceForTwo'],
    populate: POPULATE,
    select: '-gallery',
  });
  sendList(res, out, 'Restaurants');
});

export const getOne = asyncHandler(async (req, res) => {
  const doc = await Restaurant.findOne(byIdOrSlug(req.validated.params.id)).populate(POPULATE).lean();
  if (!doc || (!doc.isActive && req.user?.role !== 'admin')) throw ApiError.notFound('Restaurant not found');
  sendOk(res, doc);
});

export const create = asyncHandler(async (req, res) => {
  const b = req.validated.body;
  await assertRefs({ city: b.address.city, cuisines: b.cuisines, amenities: b.amenities });
  const doc = await createWithSlug(Restaurant, toSlug(b.name), { ...b, costBracket: costBracketOf(b.priceForTwo), createdBy: req.user._id });
  sendOk(res, doc, 'Restaurant created', 201);
});

export const update = asyncHandler(async (req, res) => {
  const b = req.validated.body;
  const doc = await load(req.validated.params.id);
  await assertRefs({ city: b.address?.city, cuisines: b.cuisines, amenities: b.amenities });
  // undefined = not sent -> skip; ""/null = cleared -> written as null. Nested objects use dot paths so siblings survive.
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue;
    if ((k === 'address' || k === 'externalLinks') && v) {
      for (const [sk, sv] of Object.entries(v)) if (sv !== undefined) doc.set(`${k}.${sk}`, sv);
    } else doc.set(k, v);
  }
  if (b.priceForTwo !== undefined) doc.costBracket = costBracketOf(b.priceForTwo);
  await doc.save();
  sendOk(res, doc, 'Restaurant updated');
});

export const toggle = asyncHandler(async (req, res) => {
  const doc = await load(req.validated.params.id);
  const { field } = req.validated.body;
  doc[field] = !doc[field];
  await doc.save();
  sendOk(res, { _id: doc._id, [field]: doc[field] }, `${field} is now ${doc[field]}`);
});

export const remove = asyncHandler(async (req, res) => {
  const doc = await load(req.validated.params.id);
  const ids = [doc.coverImage?.publicId, ...doc.gallery.map((g) => g.publicId)];
  await doc.deleteOne();
  await removeImages(ids);
  sendOk(res, null, 'Restaurant deleted');
});

export const setCover = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("Attach an image file in the form field 'image'");
  const doc = await load(req.validated.params.id);
  const [img] = await storeImages([req.file]);
  const oldId = doc.coverImage?.publicId;
  doc.coverImage = img;
  await doc.save();
  await removeImages([oldId]);
  sendOk(res, doc.coverImage, 'Cover image updated');
});

export const addGallery = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) throw ApiError.badRequest("Attach image files in the form field 'images'");
  const doc = await load(req.validated.params.id);
  if (doc.gallery.length + files.length > MAX_GALLERY) {
    throw ApiError.badRequest(`Gallery limit is ${MAX_GALLERY} images (it has ${doc.gallery.length}, you sent ${files.length}).`);
  }
  const stored = await storeImages(files);
  // atomic cap: only pushes while the array still has room, so concurrent uploads cannot exceed the limit
  const upd = await Restaurant.findOneAndUpdate(
    { _id: doc._id, [`gallery.${MAX_GALLERY - files.length}`]: { $exists: false } },
    { $push: { gallery: { $each: stored } } },
    { new: true },
  );
  if (!upd) {
    await removeImages(stored.map((s) => s.publicId));
    throw ApiError.badRequest(`Gallery limit is ${MAX_GALLERY} images.`);
  }
  sendOk(res, upd.gallery, `${files.length} image(s) added`, 201);
});

export const removeGalleryImage = asyncHandler(async (req, res) => {
  const { id, imageId } = req.validated.params;
  const doc = await load(id);
  const img = doc.gallery.id(imageId);
  if (!img) throw ApiError.notFound('Gallery image not found');
  const publicId = img.publicId;
  await Restaurant.updateOne({ _id: doc._id }, { $pull: { gallery: { _id: img._id } } });
  await removeImages([publicId]);
  sendOk(res, null, 'Image removed');
});

export const reorderGallery = asyncHandler(async (req, res) => {
  const doc = await load(req.validated.params.id);
  const { order } = req.validated.body;
  const current = doc.gallery.map((g) => String(g._id));
  if (order.length !== current.length || new Set(order).size !== order.length || !order.every((o) => current.includes(o))) {
    throw ApiError.badRequest('order must list every current gallery image id exactly once');
  }
  const byId = new Map(doc.gallery.map((g) => [String(g._id), g]));
  doc.gallery = order.map((o) => byId.get(o));
  await doc.save();
  sendOk(res, doc.gallery, 'Gallery reordered');
});

export const bulkImport = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  const rows = Array.isArray(body) ? body : body.rows;
  const result = await importRestaurants(rows, {
    autoCreate: Array.isArray(body) ? true : body.autoCreate ?? true,
    dryRun: Array.isArray(body) ? false : body.dryRun ?? false,
    createdBy: req.user._id,
  });
  const t = result.totals;
  sendOk(res, result, `${result.dryRun ? '[dry run] ' : ''}${t.created} created, ${t.updated} updated, ${t.skipped} skipped`);
});
