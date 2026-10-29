import { z } from 'zod';
import { DAYS, TYPES, CATEGORIES, BRACKETS } from '../models/Restaurant.js';
import { objectId, listQuery, blankToNull } from './common.js';

// ---------- helpers ----------
const optStr = (max) => z.preprocess(blankToNull, z.string().trim().max(max).nullish());
const hostIs = (h, d) => h === d || h.endsWith(`.${d}`);

function urlField(label, check) {
  return z.preprocess(
    blankToNull,
    z
      .string()
      .trim()
      .max(500)
      .refine((s) => {
        try {
          const u = new URL(s);
          return ['http:', 'https:'].includes(u.protocol) && check(u.hostname.toLowerCase(), u.pathname);
        } catch {
          return false;
        }
      }, `Must be a valid ${label} URL`)
      .nullish(),
  );
}

const externalLinks = z.object({
  zomatoUrl: urlField('Zomato', (h) => hostIs(h, 'zomato.com') || h === 'zoma.to'),
  swiggyUrl: urlField('Swiggy', (h) => hostIs(h, 'swiggy.com') || h === 'swiggy.onelink.me'),
  mapsUrl: urlField(
    'Google Maps / OpenStreetMap',
    (h, p) =>
      (/^(www\.)?google\.(com|co\.in)$/.test(h) && p.startsWith('/maps')) ||
      h === 'maps.google.com' ||
      h === 'maps.app.goo.gl' ||
      (h === 'goo.gl' && p.startsWith('/maps')) ||
      hostIs(h, 'openstreetmap.org'),
  ),
  website: urlField('website', () => true),
  instagram: urlField('Instagram', (h) => hostIs(h, 'instagram.com')),
});

const lat = z.number({ invalid_type_error: 'Latitude must be a number' }).min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90');
const lng = z.number({ invalid_type_error: 'Longitude must be a number' }).min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180');

/** Accepts GeoJSON {coordinates:[lng,lat]} or {lat,lng}; outputs GeoJSON Point. */
const location = z
  .object({ type: z.literal('Point').optional(), coordinates: z.tuple([lng, lat]).optional(), lat: lat.optional(), lng: lng.optional() })
  .refine((l) => l.coordinates || (l.lat !== undefined && l.lng !== undefined), 'Provide coordinates [lng, lat] or lat and lng')
  .transform((l) => ({ type: 'Point', coordinates: l.coordinates ?? [l.lng, l.lat] }));

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm (24h)');
const timing = z
  .object({ day: z.enum(DAYS), openTime: time.optional(), closeTime: time.optional(), isClosed: z.boolean().default(false) })
  .refine((t) => t.isClosed || (t.openTime && t.closeTime), { message: 'openTime and closeTime are required unless isClosed', path: ['openTime'] });
// closeTime earlier than openTime is valid (closes after midnight)
const timings = z
  .array(timing)
  .length(7, 'Provide all 7 days')
  .refine((a) => new Set(a.map((t) => t.day)).size === 7, 'Each day must appear exactly once')
  .or(z.array(z.never()).length(0)); // [] clears all timings

const addr = (city) =>
  z.object({
    line1: z.string().trim().min(2, 'Address line 1 is required').max(200),
    line2: optStr(200),
    area: optStr(100),
    city,
    pincode: z.preprocess(blankToNull, z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits').nullish()),
  });

const core = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  description: optStr(3000),
  ownerName: optStr(80),
  contactPhone: z.preprocess(blankToNull, z.string().trim().regex(/^[+()\d\s-]{7,20}$/, 'Enter a valid phone number').nullish()),
  contactEmail: z.preprocess(blankToNull, z.string().trim().toLowerCase().email('Enter a valid email').nullish()),
  location,
  type: z.enum(TYPES),
  category: z.enum(CATEGORIES),
  establishedYear: z.number().int().min(1800).max(new Date().getFullYear()).nullish(),
  priceForTwo: z.number({ invalid_type_error: 'priceForTwo must be a number' }).positive('priceForTwo must be greater than 0').max(1_000_000),
  timings: timings.optional(),
  externalLinks: externalLinks.optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional(),
};

// ---------- API schemas ----------
export const restaurantCreate = z.object({
  ...core,
  address: addr(objectId),
  cuisines: z.array(objectId).max(30).default([]),
  amenities: z.array(objectId).max(40).default([]),
});

export const restaurantPatch = restaurantCreate.partial().extend({ address: addr(objectId).partial().optional() });

export const toggleBody = z.object({ field: z.enum(['isActive', 'isFeatured']) });
export const reorderBody = z.object({ order: z.array(objectId).min(1).max(10) });
export const galleryParams = z.object({ id: z.string().min(1).max(120), imageId: objectId });

const csv = (values) =>
  z.string().max(300).refine((s) => s.split(',').map((x) => x.trim()).filter(Boolean).every((x) => values.includes(x)), `Allowed: ${values.join(', ')}`);
const bool = z.enum(['true', 'false']);

export const restaurantListQuery = listQuery.extend({
  city: z.string().max(300).optional(),
  cuisine: z.string().max(300).optional(),
  amenity: z.string().max(300).optional(),
  category: csv(CATEGORIES).optional(),
  type: csv(TYPES).optional(),
  costBracket: csv(BRACKETS).optional(),
  isFeatured: bool.optional(),
  isActive: bool.optional(),
  // public discovery (3.1); aliases: cuisine=cuisines, amenity=amenities, costBracket=cost, isFeatured=featured
  cuisines: z.string().max(500).optional(),
  amenities: z.string().max(500).optional(),
  cost: csv(BRACKETS).optional(),
  featured: bool.optional(),
  openNow: bool.optional(),
  minRating: z.string().max(10).refine((s) => Number.isFinite(Number(s)) && Number(s) >= 0 && Number(s) <= 5, 'minRating must be between 0 and 5').optional(),
});

const num = (min, max, msg) =>
  z.string().max(30).refine((s) => s.trim() !== '' && Number.isFinite(Number(s)) && Number(s) >= min && Number(s) <= max, msg).transform(Number);

export const nearbyQuery = restaurantListQuery.extend({
  lat: num(-90, 90, 'lat must be a number between -90 and 90'),
  lng: num(-180, 180, 'lng must be a number between -180 and 180'),
  radius: z.string().max(30).refine((s) => Number.isFinite(Number(s)) && Number(s) > 0, 'radius (km) must be greater than 0').optional(),
});

export const suggestQuery = z.object({
  q: z.preprocess((v) => (typeof v === 'string' ? v.trim().slice(0, 100) : v), z.string().min(1, 'q is required')),
});

// ---------- bulk import ----------
const nameList = (max) => z.array(z.string().trim().min(1).max(80)).max(max).optional();
const cityRef = z.union([
  z.string().trim().min(2).max(80).transform((name) => ({ name })),
  z.object({ name: z.string().trim().min(2).max(80), state: z.string().trim().max(80).optional() }),
]);

export const bulkRow = z.object({
  ...core,
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase letters, numbers, dashes').max(140).optional(),
  address: addr(cityRef),
  cuisines: nameList(30),
  amenities: nameList(40),
});

export const bulkBody = z.union([
  z.array(z.unknown()).min(1, 'No rows').max(20000, 'Max 20000 rows per request'),
  z.object({
    rows: z.array(z.unknown()).min(1, 'No rows').max(20000, 'Max 20000 rows per request'),
    autoCreate: z.boolean().optional(),
    dryRun: z.boolean().optional(),
  }),
]);
