// Public discovery: listing (+facets in ONE $facet), nearby, detail, search suggest.
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/slug.js';
import { openStatus, openNowExpr } from '../utils/openStatus.js';
import { City, Cuisine, Amenity } from '../models/index.js';
import Restaurant from '../models/Restaurant.js';

const oid = (s) => new mongoose.Types.ObjectId(s);
const isObjectId = (v) => /^[a-f\d]{24}$/i.test(v);
const csv = (s) => [...new Set(String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 20);
const int = (v, d, lo, hi) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const and = (list) => (list.length ? { $and: list } : {});

export const POPULATE = [
  { path: 'address.city', select: 'name state slug' },
  { path: 'cuisines', select: 'name slug icon' },
  { path: 'amenities', select: 'name slug icon' },
];
const CARD_POPULATE = POPULATE.slice(0, 2);
// never sent to the public
const HIDE = { gallery: 0, createdBy: 0, __v: 0, 'coverImage.publicId': 0, ownerName: 0, contactEmail: 0, _score: 0 };

/** Resolve "id|slug,id|slug" to ObjectIds. `missing` = parts that matched nothing. */
async function resolveRefs(Model, value) {
  const parts = csv(value);
  if (!parts.length) return null;
  const docs = await Model.find(
    { $or: [{ _id: { $in: parts.filter(isObjectId) } }, { slug: { $in: parts.filter((p) => !isObjectId(p)).map((p) => p.toLowerCase()) } }] },
    '_id slug',
  ).lean();
  const known = new Set(docs.flatMap((d) => [String(d._id), d.slug]));
  return { ids: docs.map((d) => d._id), missing: parts.filter((p) => !known.has(p.toLowerCase())).length };
}

const SORTS = {
  relevance: null,
  rating: { ratingAvg: -1, ratingCount: -1 },
  popular: { ratingCount: -1, ratingAvg: -1 },
  newest: { createdAt: -1 },
  priceAsc: { priceForTwo: 1 },
  priceDesc: { priceForTwo: -1 },
  name: { name: 1 },
};
// admin-era sort keys still accepted publicly (with ?order=)
const LEGACY_SORT = new Set(['createdAt', 'name', 'ratingAvg', 'ratingCount', 'priceForTwo']);

function sortSpec(q, hasSearch) {
  const s = q.sort || 'relevance';
  let spec;
  if (s in SORTS) spec = SORTS[s] ?? (hasSearch ? { _score: -1, isFeatured: -1, ratingAvg: -1 } : { isFeatured: -1, ratingAvg: -1, ratingCount: -1 });
  else if (LEGACY_SORT.has(s)) spec = { [s]: q.order === 'desc' ? -1 : 1 };
  else throw ApiError.badRequest(`Unknown sort "${String(s).slice(0, 40)}". Allowed: ${Object.keys(SORTS).join(', ')}`, { sort: 'Unknown sort' });
  if (s === 'name' && q.order === 'desc') spec = { name: -1 };
  return { ...spec, _id: 1 };
}

/**
 * Splits the query into: base (search/city/type/minRating/featured/openNow - applied to everything) and the four
 * faceted filters (cuisines/amenities/cost/category), which each facet branch applies except its own.
 */
async function buildFilters(q, { now, geo = false }) {
  const base = [{ isActive: true }];
  const facetF = {};
  const impossible = { _id: { $in: [] } };
  const search = (q.search || '').trim().slice(0, 100);

  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    const prefix = { $regex: `^${escapeRegex(search)}`, $options: 'i' };
    // $text (word match, ranked) OR name prefix so partial words like "pizz" still work. $text cannot be combined with $geoNear.
    base.push(geo ? { $or: [{ name: rx }, { 'address.area': rx }] } : { $or: [{ $text: { $search: search } }, { name: prefix }] });
  }
  const cityRefs = await resolveRefs(City, q.city);
  if (cityRefs) base.push(cityRefs.ids.length ? { 'address.city': { $in: cityRefs.ids } } : impossible);
  if (q.type) base.push({ type: { $in: csv(q.type) } });
  if (q.minRating !== undefined && Number(q.minRating) > 0) base.push({ ratingAvg: { $gte: Number(q.minRating) } });
  const featured = q.featured ?? q.isFeatured;
  if (featured === 'true') base.push({ isFeatured: true });
  if (q.openNow === 'true') base.push(openNowExpr(now));

  const cuisineRefs = await resolveRefs(Cuisine, q.cuisines ?? q.cuisine); // ANY
  if (cuisineRefs) facetF.cuisines = cuisineRefs.ids.length ? { cuisines: { $in: cuisineRefs.ids } } : impossible;
  const amenityRefs = await resolveRefs(Amenity, q.amenities ?? q.amenity); // ALL
  if (amenityRefs) facetF.amenities = amenityRefs.missing || !amenityRefs.ids.length ? impossible : { amenities: { $all: amenityRefs.ids } };
  const cost = q.cost ?? q.costBracket;
  if (cost) facetF.cost = { costBracket: { $in: csv(cost) } };
  if (q.category) facetF.category = { category: { $in: csv(q.category) } };
  return { base, facetF, search };
}

const withStatus = (docs, now) =>
  docs.map(({ timings, ...r }) => ({ ...r, openStatus: openStatus(timings, now) }));

async function finish(docs, now) {
  await Restaurant.populate(docs, CARD_POPULATE);
  return withStatus(docs, now);
}

export async function publicList(q, now = new Date()) {
  const page = int(q.page, 1, 1, 1e7);
  const limit = int(q.limit, 12, 1, 50);
  const { base, facetF, search } = await buildFilters(q, { now });
  const sort = sortSpec(q, !!search);

  const other = (omit) => and(Object.entries(facetF).filter(([k]) => k !== omit).map(([, v]) => v));
  const countBy = (omit, field, unwind) => [
    { $match: other(omit) },
    ...(unwind ? [{ $unwind: `$${field}` }] : []),
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 60 },
  ];
  const named = (coll) => [
    { $lookup: { from: coll, localField: '_id', foreignField: '_id', as: 'm' } },
    { $project: { _id: 0, id: '$_id', name: { $arrayElemAt: ['$m.name', 0] }, slug: { $arrayElemAt: ['$m.slug', 0] }, count: 1 } },
    { $match: { name: { $ne: null } } },
  ];
  const plain = [{ $project: { _id: 0, id: '$_id', name: '$_id', count: 1 } }];

  const pipeline = [
    { $match: and(base) },
    ...(search ? [{ $addFields: { _score: { $meta: 'textScore' } } }] : []),
    {
      $facet: {
        data: [{ $match: other(null) }, { $sort: sort }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: HIDE }],
        total: [{ $match: other(null) }, { $count: 'n' }],
        cuisines: [...countBy('cuisines', 'cuisines', true), ...named(Cuisine.collection.name)],
        amenities: [...countBy('amenities', 'amenities', true), ...named(Amenity.collection.name)],
        cost: [...countBy('cost', 'costBracket'), ...plain],
        category: [...countBy('category', 'category'), ...plain],
      },
    },
  ];
  const [r] = await Restaurant.aggregate(pipeline).option({ allowDiskUse: true });
  const total = r.total[0]?.n || 0;
  return {
    data: await finish(r.data, now),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    facets: { cuisines: r.cuisines, amenities: r.amenities, cost: r.cost, category: r.category },
  };
}

export async function nearby(q, now = new Date()) {
  const limit = int(q.limit, 20, 1, 50);
  const radiusKm = Math.min(50, q.radius ? Number(q.radius) : 5);
  const { base, facetF } = await buildFilters(q, { now, geo: true });
  const open = base.filter((c) => c.$expr); // $expr is applied after $geoNear
  const query = and([...base.filter((c) => !c.$expr), ...Object.values(facetF)]);
  const data = await Restaurant.aggregate([
    { $geoNear: { near: { type: 'Point', coordinates: [q.lng, q.lat] }, distanceField: 'distanceMeters', maxDistance: radiusKm * 1000, spherical: true, query } },
    ...open.map((m) => ({ $match: m })),
    { $limit: limit },
    { $addFields: { distanceMeters: { $round: ['$distanceMeters', 0] } } },
    { $project: HIDE },
  ]);
  return {
    data: await finish(data, now),
    pagination: { page: 1, limit, total: data.length, totalPages: 1 },
    center: { lat: q.lat, lng: q.lng, radiusKm },
  };
}

/** Public shape: no createdBy / __v / publicIds. Admin tokens keep the full document (the edit form needs it). */
export async function detailPayload(doc, { isAdmin, now = new Date() }) {
  let out = doc;
  if (!isAdmin) {
    const { createdBy, __v, coverImage, ...rest } = doc;
    out = { ...rest, gallery: (rest.gallery || []).map(({ publicId, ...g }) => g) };
    if (coverImage?.url) out.coverImage = { url: coverImage.url };
  }
  const cuisineIds = (doc.cuisines || []).map((c) => c._id);
  const cityId = doc.address?.city?._id;
  let similar = [];
  if (cuisineIds.length && cityId) {
    const rows = await Restaurant.find({ _id: { $ne: doc._id }, isActive: true, 'address.city': cityId, cuisines: { $in: cuisineIds } })
      .select(Object.fromEntries(Object.keys(HIDE).map((k) => [k, 0])))
      .sort({ ratingAvg: -1, ratingCount: -1, _id: 1 })
      .limit(4)
      .lean();
    similar = await finish(rows, now);
  }
  return { ...out, openStatus: openStatus(doc.timings, now), similar };
}

export async function suggest(q) {
  const rx = { $regex: `^${escapeRegex(q)}`, $options: 'i' };
  const card = 'name slug address.area coverImage.url';
  const [byPrefix, cuisines, areas] = await Promise.all([
    Restaurant.find({ isActive: true, name: rx }).select(card).sort({ ratingCount: -1, name: 1 }).limit(5).lean(),
    Cuisine.find({ isActive: true, name: rx }).select('name slug').sort({ name: 1 }).limit(5).lean(),
    Restaurant.aggregate([
      { $match: { isActive: true, 'address.area': rx } },
      { $group: { _id: '$address.area', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 5 },
    ]),
  ]);
  let rows = byPrefix;
  if (rows.length < 5) {
    // word match inside names ("pizza" -> "Domino's Pizza"), served by the text index
    const more = await Restaurant.find({ isActive: true, $text: { $search: q }, _id: { $nin: rows.map((r) => r._id) } })
      .select(card)
      .limit(5 - rows.length)
      .lean();
    rows = [...rows, ...more];
  }
  return {
    restaurants: rows.map((r) => ({ name: r.name, slug: r.slug, area: r.address?.area ?? null, coverImage: r.coverImage?.url ?? null })),
    cuisines: cuisines.map((c) => ({ id: c._id, name: c.name, slug: c.slug })),
    areas: areas.map((a) => ({ name: a._id, count: a.count })),
  };
}
