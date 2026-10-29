import { z } from 'zod';
import { DAYS } from './constants.js';

export const DEFAULT_CENTER = { lat: 22.7196, lng: 75.8577 }; // Indore

const host = (u, d) => u.hostname === d || u.hostname.endsWith(`.${d}`);
const url = (label, ok) =>
  z.string().trim().max(500, 'URL is too long').refine((s) => {
    if (!s) return true;
    try {
      const u = new URL(s);
      return ['http:', 'https:'].includes(u.protocol) && ok(u);
    } catch {
      return false;
    }
  }, `Enter a valid ${label} URL`);

const numStr = (label, { min, max, gt } = {}) =>
  z.string().trim()
    .refine((s) => s !== '', `${label} is required`)
    .refine((s) => s === '' || Number.isFinite(Number(s)), `${label} must be a number`)
    .refine((s) => !Number.isFinite(Number(s)) || s === '' || gt === undefined || Number(s) > gt, `${label} must be greater than ${gt}`)
    .refine((s) => !Number.isFinite(Number(s)) || s === '' || min === undefined || Number(s) >= min, `${label} must be at least ${min}`)
    .refine((s) => !Number.isFinite(Number(s)) || s === '' || max === undefined || Number(s) <= max, `${label} must be at most ${max}`);

const year = new Date().getFullYear();
const timing = z
  .object({ day: z.enum(DAYS), isClosed: z.boolean(), openTime: z.string(), closeTime: z.string() })
  .superRefine((t, ctx) => {
    if (t.isClosed) return;
    if (!t.openTime) ctx.addIssue({ code: 'custom', path: ['openTime'], message: 'Required' });
    if (!t.closeTime) ctx.addIssue({ code: 'custom', path: ['closeTime'], message: 'Required' });
    if (t.openTime && t.closeTime && t.openTime === t.closeTime) ctx.addIssue({ code: 'custom', path: ['closeTime'], message: 'Must differ from opening time' });
  });

const mapsOk = (u) =>
  (/^(www\.)?google\.(com|co\.in)$/.test(u.hostname) && u.pathname.startsWith('/maps')) ||
  u.hostname === 'maps.google.com' || u.hostname === 'maps.app.goo.gl' ||
  (u.hostname === 'goo.gl' && u.pathname.startsWith('/maps')) || host(u, 'openstreetmap.org');

export const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120, 'Name is too long (max 120)'),
  description: z.string().trim().max(3000, 'Description is too long (max 3000)'),
  category: z.string().min(1, 'Select a category'),
  type: z.string().min(1, 'Select a type'),
  establishedYear: z.string().trim().refine((s) => s === '' || (/^\d{4}$/.test(s) && +s >= 1800 && +s <= year), `Enter a year between 1800 and ${year}`),
  priceForTwo: numStr('Price for two', { gt: 0, max: 1000000 }),
  ownerName: z.string().trim().max(80, 'Too long (max 80)'),
  contactPhone: z.string().trim().refine((s) => s === '' || /^[+()\d\s-]{7,20}$/.test(s), 'Enter a valid phone number'),
  contactEmail: z.string().trim().refine((s) => s === '' || z.string().email().safeParse(s).success, 'Enter a valid email'),
  address: z.object({
    line1: z.string().trim().min(2, 'Address line 1 is required').max(200),
    line2: z.string().trim().max(200),
    area: z.string().trim().max(100),
    city: z.string().min(1, 'Select a city'),
    pincode: z.string().trim().refine((s) => s === '' || /^\d{6}$/.test(s), 'Pincode must be 6 digits'),
  }),
  lat: numStr('Latitude', { min: -90, max: 90 }),
  lng: numStr('Longitude', { min: -180, max: 180 }),
  timings: z.array(timing).length(7),
  cuisines: z.array(z.string()),
  amenities: z.array(z.string()),
  externalLinks: z.object({
    zomatoUrl: url('Zomato', (u) => host(u, 'zomato.com') || u.hostname === 'zoma.to'),
    swiggyUrl: url('Swiggy', (u) => host(u, 'swiggy.com') || u.hostname === 'swiggy.onelink.me'),
    mapsUrl: url('Google Maps or OpenStreetMap', mapsOk),
    website: url('website', () => true),
    instagram: url('Instagram', (u) => host(u, 'instagram.com')),
  }),
});

export const STEPS = [
  { id: 'basics', label: 'Basics', fields: ['name', 'description', 'category', 'type', 'establishedYear', 'priceForTwo', 'ownerName', 'contactPhone', 'contactEmail'] },
  { id: 'location', label: 'Location', fields: ['address.line1', 'address.line2', 'address.area', 'address.city', 'address.pincode', 'lat', 'lng'] },
  { id: 'timings', label: 'Timings', fields: ['timings'] },
  { id: 'tags', label: 'Tags', fields: ['cuisines', 'amenities'] },
  { id: 'media', label: 'Media', fields: [] },
  { id: 'links', label: 'Links', fields: ['externalLinks.zomatoUrl', 'externalLinks.swiggyUrl', 'externalLinks.mapsUrl', 'externalLinks.website', 'externalLinks.instagram'] },
];

export const emptyValues = () => ({
  name: '', description: '', category: '', type: '', establishedYear: '', priceForTwo: '', ownerName: '', contactPhone: '', contactEmail: '',
  address: { line1: '', line2: '', area: '', city: '', pincode: '' },
  lat: String(DEFAULT_CENTER.lat), lng: String(DEFAULT_CENTER.lng),
  timings: DAYS.map((day) => ({ day, isClosed: false, openTime: '10:00', closeTime: '22:00' })),
  cuisines: [], amenities: [],
  externalLinks: { zomatoUrl: '', swiggyUrl: '', mapsUrl: '', website: '', instagram: '' },
});

/** Server document -> form values (every step prefilled in edit mode). */
export function fromServer(r) {
  const base = emptyValues();
  const s = (v) => (v == null ? '' : String(v));
  const [lng, lat] = r.location?.coordinates || [];
  return {
    name: s(r.name), description: s(r.description), category: s(r.category), type: s(r.type),
    establishedYear: s(r.establishedYear), priceForTwo: s(r.priceForTwo), ownerName: s(r.ownerName),
    contactPhone: s(r.contactPhone), contactEmail: s(r.contactEmail),
    address: {
      line1: s(r.address?.line1), line2: s(r.address?.line2), area: s(r.address?.area),
      city: s(r.address?.city?._id || r.address?.city), pincode: s(r.address?.pincode),
    },
    lat: lat != null ? String(lat) : base.lat,
    lng: lng != null ? String(lng) : base.lng,
    timings: DAYS.map((day) => {
      const t = (r.timings || []).find((x) => x.day === day);
      return t ? { day, isClosed: !!t.isClosed, openTime: t.openTime || '10:00', closeTime: t.closeTime || '22:00' } : base.timings.find((x) => x.day === day);
    }),
    cuisines: (r.cuisines || []).map((c) => c._id || c),
    amenities: (r.amenities || []).map((c) => c._id || c),
    externalLinks: Object.fromEntries(Object.keys(base.externalLinks).map((k) => [k, s(r.externalLinks?.[k])])),
  };
}

/** Form values -> API body. costBracket is server-derived and never sent. Blank optionals are omitted. */
export function toPayload(v) {
  const opt = (x) => (x === '' || x == null ? undefined : x);
  const links = Object.fromEntries(Object.entries(v.externalLinks).filter(([, x]) => x));
  return {
    name: v.name.trim(),
    description: opt(v.description.trim()),
    ownerName: opt(v.ownerName.trim()),
    contactPhone: opt(v.contactPhone.trim()),
    contactEmail: opt(v.contactEmail.trim()),
    address: { line1: v.address.line1.trim(), line2: opt(v.address.line2.trim()), area: opt(v.address.area.trim()), city: v.address.city, pincode: opt(v.address.pincode.trim()) },
    location: { type: 'Point', coordinates: [Number(v.lng), Number(v.lat)] },
    type: v.type,
    category: v.category,
    establishedYear: v.establishedYear ? Number(v.establishedYear) : undefined,
    priceForTwo: Number(v.priceForTwo),
    timings: v.timings.map((t) => (t.isClosed ? { day: t.day, isClosed: true } : { day: t.day, isClosed: false, openTime: t.openTime, closeTime: t.closeTime })),
    cuisines: v.cuisines,
    amenities: v.amenities,
    externalLinks: Object.keys(links).length ? links : undefined,
  };
}
