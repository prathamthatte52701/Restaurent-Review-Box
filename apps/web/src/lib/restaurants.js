// Listing state <-> URL query string <-> API params. The URL is the single source of truth.
export const SORTS = [
  { value: 'relevance', label: 'Recommended' },
  { value: 'rating', label: 'Top rated' },
  { value: 'popular', label: 'Most reviewed' },
  { value: 'newest', label: 'Newest' },
  { value: 'priceAsc', label: 'Price: low to high' },
  { value: 'priceDesc', label: 'Price: high to low' },
  { value: 'name', label: 'Name A-Z' },
];
export const COSTS = [
  { value: 'budget', label: 'Budget', hint: 'under ₹300' },
  { value: 'mid', label: 'Mid-range', hint: '₹300-800' },
  { value: 'premium', label: 'Premium', hint: '₹800-2000' },
  { value: 'luxury', label: 'Luxury', hint: '₹2000+' },
];
export const CATEGORIES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'street-food', label: 'Street food' },
  { value: 'bar', label: 'Bar' },
  { value: 'cloud-kitchen', label: 'Cloud kitchen' },
];
export const TYPES = [
  { value: 'veg', label: 'Pure veg' },
  { value: 'non-veg', label: 'Non-veg' },
  { value: 'both', label: 'Veg & non-veg' },
];
export const RATINGS = [4.5, 4, 3.5, 3];
export const RADII = [1, 2, 5, 10, 25];
export const PAGE_SIZE = 12;
export const MAP_LIMIT = 50;

const num = (v) => {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) ? n : null;
};
const list = (sp, key, allowed) => {
  const out = (sp.get(key) || '').split(',').map((x) => x.trim()).filter(Boolean);
  return [...new Set(allowed ? out.filter((x) => allowed.includes(x)) : out)].slice(0, 20);
};

/** Tolerant parser: junk in the URL falls back to defaults, never throws. */
export function readParams(sp) {
  const page = Math.floor(num(sp.get('page')) ?? 1);
  const minRating = num(sp.get('minRating'));
  const sort = sp.get('sort');
  const near = (sp.get('near') || '').split(',');
  const lat = num(near[0]);
  const lng = num(near[1]);
  const radius = num(sp.get('radius'));
  return {
    q: (sp.get('q') || '').slice(0, 100),
    cuisines: list(sp, 'cuisines'),
    amenities: list(sp, 'amenities'),
    cost: list(sp, 'cost', COSTS.map((c) => c.value)),
    category: list(sp, 'category', CATEGORIES.map((c) => c.value)),
    type: list(sp, 'type', TYPES.map((c) => c.value)),
    minRating: minRating !== null && minRating > 0 && minRating <= 5 ? minRating : null,
    openNow: sp.get('openNow') === 'true',
    city: (sp.get('city') || '').slice(0, 60),
    sort: SORTS.some((s) => s.value === sort) ? sort : 'relevance',
    page: Math.min(Math.max(1, page), 100000),
    view: sp.get('view') === 'map' ? 'map' : 'list',
    nearMe: sp.get('near') === 'me',
    near: lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null,
    radius: RADII.includes(radius) ? radius : 5,
  };
}

/** Defaults are omitted so URLs stay short and canonical. */
export function writeParams(s) {
  const sp = new URLSearchParams();
  if (s.q) sp.set('q', s.q);
  if (s.city) sp.set('city', s.city);
  for (const k of ['cuisines', 'amenities', 'cost', 'category', 'type']) if (s[k]?.length) sp.set(k, s[k].join(','));
  if (s.minRating) sp.set('minRating', String(s.minRating));
  if (s.openNow) sp.set('openNow', 'true');
  if (s.sort && s.sort !== 'relevance') sp.set('sort', s.sort);
  if (s.page > 1) sp.set('page', String(s.page));
  if (s.view === 'map') sp.set('view', 'map');
  if (s.nearMe) sp.set('near', 'me');
  else if (s.near) {
    sp.set('near', `${s.near.lat.toFixed(4)},${s.near.lng.toFixed(4)}`);
    if (s.radius !== 5) sp.set('radius', String(s.radius));
  }
  return sp;
}

/** State -> API filters (paging/sort added by the caller). */
export function toApiFilters(s) {
  const p = {};
  if (s.q) p.search = s.q;
  if (s.city) p.city = s.city;
  for (const k of ['cuisines', 'amenities', 'cost', 'category', 'type']) if (s[k]?.length) p[k] = s[k].join(',');
  if (s.minRating) p.minRating = s.minRating;
  if (s.openNow) p.openNow = 'true';
  return p;
}

export const costForTwo = (n) => (Number(n) > 0 ? `₹${Number(n).toLocaleString('en-IN')} for two` : null);
export const humanize = (s) => String(s || '').replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export const distanceLabel = (m) => (m == null ? null : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export function time12(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}${m[2] === '00' ? '' : `:${m[2]}`} ${h < 12 ? 'AM' : 'PM'}`;
}
export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const todayIST = () => new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).toLowerCase();

/** One-line status for badges/cards; null when the restaurant has no timings. */
export function statusText(st) {
  if (!st || !st.hasTimings) return null;
  if (st.isOpen) return st.closesAt ? `Open · closes ${time12(st.closesAt)}` : 'Open now';
  if (st.opensAt) return `Closed · opens ${time12(st.opensAt)}${st.nextOpenDay ? ` ${humanize(st.nextOpenDay)}` : ''}`;
  return 'Closed';
}
