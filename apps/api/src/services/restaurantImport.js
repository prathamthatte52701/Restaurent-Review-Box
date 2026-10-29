import mongoose from 'mongoose';
import { isDeepStrictEqual } from 'node:util';
import { City, Cuisine, Amenity } from '../models/index.js';
import Restaurant, { costBracketOf } from '../models/Restaurant.js';
import { bulkRow } from '../validators/restaurants.js';
import { createWithSlug, toSlug, escapeRegex } from '../utils/slug.js';

/**
 * Bulk import. Rows are processed in CHUNKS of 500: each chunk does a handful of batched
 * lookups (masters, existing restaurants, taken slugs), then ONE unordered bulkWrite. Chunks run
 * sequentially so later chunks see earlier inserts and memory/timeouts stay bounded for 10k+ rows.
 *
 * Idempotent: a row matches an existing restaurant by explicit `slug`, or by same name
 * + coordinates within 50 m. Matching + identical data -> skipped ("No changes"); different -> updated.
 */
export const CHUNK_SIZE = 500;
const MATCH_RADIUS_M = 50;
const ci = { locale: 'en', strength: 2 };
const lower = (s) => String(s).trim().toLowerCase();

function distanceM([lng1, lat1], [lng2, lat2]) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const plain = (v) => JSON.parse(JSON.stringify(v ?? null));
const normalise = (key, v) => {
  const p = plain(v);
  return key === 'cuisines' || key === 'amenities' ? [...(p || [])].sort() : p;
};
const unchanged = (existing, payload) => Object.entries(payload).every(([k, v]) => isDeepStrictEqual(normalise(k, existing[k]), normalise(k, v)));

const issueText = (err) => err.issues.map((i) => `${i.path.join('.') || 'row'}: ${i.message}`).join('; ');

/** Resolve (and optionally create) cuisines/amenities/cities for a chunk. Returns lookups + per-row error map. */
async function resolveMasters(valid, { autoCreate, dryRun, cache }) {
  const problems = new Map(); // rowIndex -> reason

  async function resolveSimple(Model, label, field, mapName) {
    const map = cache[mapName];
    const need = new Map(); // lower -> original name
    for (const r of valid) for (const n of r.row[field] || []) if (!map.has(lower(n))) need.set(lower(n), n);
    if (need.size) {
      for (const d of await Model.find({ name: { $in: [...need.values()] } }).collation(ci).lean()) map.set(lower(d.name), d._id);
      for (const [k, name] of need) {
        if (map.has(k) || !autoCreate) continue;
        map.set(k, dryRun ? `dry:${k}` : (await createMaster(Model, { name })));
      }
    }
    for (const r of valid) for (const n of r.row[field] || []) if (!map.has(lower(n))) problems.set(r.index, `${label} "${n}" does not exist (autoCreate is off)`);
  }

  async function createMaster(Model, data) {
    try {
      return (await createWithSlug(Model, toSlug(data.name), data))._id;
    } catch (err) {
      if (err?.code !== 11000) throw err;
      return (await Model.findOne({ name: data.name }).collation(ci).lean())._id; // concurrent creator won
    }
  }

  await resolveSimple(Cuisine, 'Cuisine', 'cuisines', 'cuisine');
  await resolveSimple(Amenity, 'Amenity', 'amenities', 'amenity');

  // cities: key = name|state
  const cityMap = cache.city;
  const ck = (c) => `${lower(c.name)}|${lower(c.state || '')}`;
  const needCity = new Map();
  for (const r of valid) if (!cityMap.has(ck(r.row.address.city))) needCity.set(ck(r.row.address.city), r.row.address.city);
  if (needCity.size) {
    const names = [...new Set([...needCity.values()].map((c) => c.name))];
    for (const d of await City.find({ name: { $in: names } }).collation(ci).lean()) cityMap.set(ck(d), d._id);
    for (const [k, c] of needCity) {
      if (cityMap.has(k) || !autoCreate) continue;
      if (dryRun) cityMap.set(k, `dry:${k}`);
      else {
        try {
          cityMap.set(k, (await createWithSlug(City, toSlug(c.name), { name: c.name, state: c.state || null }))._id);
        } catch (err) {
          if (err?.code !== 11000) throw err;
          const again = await City.find({ name: c.name }).collation(ci).lean();
          cityMap.set(k, again.find((d) => ck(d) === k)?._id);
        }
      }
    }
  }
  for (const r of valid) if (!cityMap.has(ck(r.row.address.city))) problems.set(r.index, `City "${r.row.address.city.name}" does not exist (autoCreate is off)`);
  return { problems, cityKey: ck };
}

function buildPayload(row, cache, cityKey) {
  const { slug, address, cuisines, amenities, ...rest } = row;
  const payload = { ...rest, address: { ...address, city: cache.city.get(cityKey(address.city)) }, costBracket: costBracketOf(row.priceForTwo) };
  if (cuisines) payload.cuisines = cuisines.map((n) => cache.cuisine.get(lower(n)));
  if (amenities) payload.amenities = amenities.map((n) => cache.amenity.get(lower(n)));
  return { slug, payload };
}

async function processChunk(rows, offset, ctx, results) {
  // 1. per-row validation
  const valid = [];
  rows.forEach((raw, i) => {
    const index = offset + i;
    const parsed = bulkRow.safeParse(raw);
    if (!parsed.success) {
      results[index] = { index, name: typeof raw?.name === 'string' ? raw.name : null, status: 'skipped', reason: issueText(parsed.error) };
    } else valid.push({ index, row: parsed.data });
  });
  if (!valid.length) return;

  // 2. masters
  const { problems, cityKey } = await resolveMasters(valid, ctx);
  const ok = [];
  for (const v of valid) {
    if (problems.has(v.index)) results[v.index] = { index: v.index, name: v.row.name, status: 'skipped', reason: problems.get(v.index) };
    else ok.push(v);
  }
  if (!ok.length) return;

  // 3. existing restaurants that could match (one query)
  const names = [...new Set(ok.map((v) => v.row.name))];
  const slugs = ok.map((v) => v.row.slug).filter(Boolean);
  const existing = await Restaurant.find({ $or: [{ name: { $in: names } }, ...(slugs.length ? [{ slug: { $in: slugs } }] : [])] }).lean();
  const bySlug = new Map(existing.map((d) => [d.slug, d]));
  const byName = new Map();
  const addName = (d) => byName.set(lower(d.name), [...(byName.get(lower(d.name)) || []), d]);
  existing.forEach(addName);

  // 4. slugs already taken for the bases we may need
  const bases = [...new Set(ok.filter((v) => !v.row.slug).map((v) => toSlug(v.row.name)))];
  const taken = new Set(existing.map((d) => d.slug));
  if (bases.length) {
    // one anchored-prefix regex per base: each is an index range scan (a single big alternation is not)
    const $or = bases.map((b) => ({ slug: new RegExp(`^${escapeRegex(b)}(-\\d+)?$`) }));
    (await Restaurant.find({ $or }, 'slug').lean()).forEach((d) => taken.add(d.slug));
  }
  const freeSlug = (base) => {
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  };

  // 5. plan
  const ops = [];
  const opRow = []; // op position -> row index
  for (const { index, row } of ok) {
    const { slug: explicit, payload } = buildPayload(row, ctx.cache, cityKey);
    const coords = row.location.coordinates;
    const match = explicit ? bySlug.get(explicit) : (byName.get(lower(row.name)) || []).find((d) => distanceM(d.location.coordinates, coords) <= MATCH_RADIUS_M);
    const base = { index, name: row.name };

    if (match?.plannedBy !== undefined) {
      results[index] = { ...base, status: 'skipped', reason: `Duplicate of row ${match.plannedBy} in this import` };
    } else if (match) {
      if (unchanged(match, payload)) results[index] = { ...base, status: 'skipped', reason: 'No changes', id: String(match._id) };
      else {
        results[index] = { ...base, status: 'updated', id: String(match._id) };
        ops.push({ updateOne: { filter: { _id: match._id }, update: { $set: payload } } });
        opRow.push(index);
      }
    } else {
      const slug = explicit || freeSlug(toSlug(row.name));
      const _id = new mongoose.Types.ObjectId();
      taken.add(slug);
      const planned = { _id, slug, name: row.name, location: row.location, plannedBy: index };
      bySlug.set(slug, planned);
      addName(planned);
      results[index] = { ...base, status: 'created', id: String(_id) };
      ops.push({ insertOne: { document: { ...payload, _id, slug, createdBy: ctx.createdBy } } });
      opRow.push(index);
    }
  }

  // 6. write
  if (ctx.dryRun || !ops.length) return;
  try {
    await Restaurant.bulkWrite(ops, { ordered: false });
  } catch (err) {
    const writeErrors = err?.writeErrors;
    if (!Array.isArray(writeErrors) || !writeErrors.length) {
      for (const i of opRow) results[i] = { index: i, name: results[i].name, status: 'skipped', reason: `Write failed: ${String(err.message).split('\n')[0]}` };
      return;
    }
    for (const w of writeErrors) {
      const i = opRow[w.index ?? w.err?.index];
      results[i] = { index: i, name: results[i].name, status: 'skipped', reason: `Write failed: ${String(w.errmsg ?? w.err?.errmsg ?? 'unknown').slice(0, 200)}` };
    }
  }
}

/**
 * @param {unknown[]} rows
 * @param {{autoCreate?:boolean, dryRun?:boolean, createdBy?:any}} opts
 */
export async function importRestaurants(rows, { autoCreate = true, dryRun = false, createdBy } = {}) {
  const results = new Array(rows.length);
  const ctx = { autoCreate, dryRun, createdBy, cache: { city: new Map(), cuisine: new Map(), amenity: new Map() } };
  for (let off = 0; off < rows.length; off += CHUNK_SIZE) await processChunk(rows.slice(off, off + CHUNK_SIZE), off, ctx, results);
  const totals = { total: rows.length, created: 0, updated: 0, skipped: 0 };
  for (const r of results) totals[r.status]++;
  return { dryRun, totals, results };
}
