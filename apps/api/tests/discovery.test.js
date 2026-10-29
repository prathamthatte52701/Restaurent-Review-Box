import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, auth, allKeys } from './helpers.js';
import { makeMasters, restaurantBody, week } from './fixtures.js';
import { openStatus } from '../src/utils/openStatus.js';

let ctx, admin, m, ujjain, wifi, R;
const A = '/api/v1/restaurants';
const get = (qs) => ctx.request.get(`${A}?${qs}`);
const names = (res) => res.body.data.map((x) => x.name);
const at = (iso) => { ctx.app.locals.now = () => new Date(iso); }; // injectable clock

const WED_20_IST = '2026-01-07T14:30:00Z'; // Wed 20:00 IST
const THU_01_IST = '2026-01-07T19:30:00Z'; // Thu 01:00 IST (past midnight of Wed shift)
const THU_03_IST = '2026-01-07T21:30:00Z'; // Thu 03:00 IST
const WED_09_IST = '2026-01-07T03:30:00Z'; // Wed 09:00 IST

before(async () => {
  ctx = await boot();
  admin = await ctx.makeAdmin();
  m = await makeMasters(ctx, admin);
  const post = async (path, body) => (await ctx.request.post(`/api/v1/${path}`).set(auth(admin)).send(body)).body.data;
  wifi = await post('amenities', { name: 'WiFi' });
  ujjain = await post('cities', { name: 'Ujjain' });
  const mk = async (over, rating) => {
    const res = await ctx.request.post(A).set(auth(admin)).send(restaurantBody(m, over));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    if (rating) await ctx.models.Restaurant.updateOne({ _id: res.body.data._id }, { $set: rating });
    return res.body.data;
  };
  R = {};
  R.owl = await mk({ name: 'Night Owl Diner', priceForTwo: 500, timings: week('18:00', '02:00'), amenities: [m.amenity._id, wifi._id], location: { type: 'Point', coordinates: [75.8937, 22.7531] }, isFeatured: true }, { ratingAvg: 4.5, ratingCount: 10 });
  R.bakery = await mk({ name: 'Morning Bakery', type: 'veg', category: 'bakery', priceForTwo: 150, timings: week('07:00', '12:00'), cuisines: [m.cuisine2._id], amenities: [wifi._id], location: { type: 'Point', coordinates: [75.8577, 22.7196] } }, { ratingAvg: 3, ratingCount: 5 });
  R.luxe = await mk({ name: 'Grand Luxe', type: 'non-veg', priceForTwo: 1500, timings: week('10:00', '23:00'), cuisines: [m.cuisine._id, m.cuisine2._id], amenities: [], location: { type: 'Point', coordinates: [75.88, 22.74] } }, { ratingAvg: 4.9, ratingCount: 2 });
  R.far = await mk({ name: 'Ujjain Thali', type: 'veg', priceForTwo: 250, address: { line1: '1 Temple Rd', area: 'Mahakal', city: ujjain._id }, timings: week('09:00', '21:00'), location: { type: 'Point', coordinates: [75.7885, 23.1765] } });
  R.hidden = await mk({ name: 'Hidden Gem Inactive', isActive: false });
  at(WED_20_IST);
});
after(() => ctx.close());

// ---------- 3.1 listing ----------
test('listing: each filter alone', async () => {
  assert.equal((await get('')).body.pagination.total, 4, 'inactive hidden');
  assert.deepEqual(names(await get('search=owl')), ['Night Owl Diner']);
  assert.deepEqual(names(await get('search=morn')), ['Morning Bakery'], 'name prefix matches partial words');
  assert.deepEqual(names(await get('search=bakery')), ['Morning Bakery'], 'whole word inside a name (text index)');
  assert.equal((await get('city=ujjain')).body.pagination.total, 1);
  assert.equal((await get(`city=${ujjain._id}`)).body.pagination.total, 1);
  assert.deepEqual(names(await get(`cuisines=${m.cuisine2.slug}`)).sort(), ['Grand Luxe', 'Morning Bakery']); // ANY
  assert.equal((await get(`cuisine=${m.cuisine2._id}`)).body.pagination.total, 2, 'legacy alias');
  assert.deepEqual(names(await get(`amenities=${wifi.slug},${m.amenity.slug}`)), ['Night Owl Diner']); // ALL
  assert.deepEqual(names(await get('category=bakery')), ['Morning Bakery']);
  assert.deepEqual(names(await get('type=non-veg')), ['Grand Luxe']);
  assert.deepEqual(names(await get('cost=budget,mid')).sort(), ['Morning Bakery', 'Night Owl Diner', 'Ujjain Thali']);
  assert.deepEqual(names(await get('minRating=4.6')), ['Grand Luxe']);
  assert.deepEqual(names(await get('featured=true')), ['Night Owl Diner']);
  assert.deepEqual(names(await get('isFeatured=true')), ['Night Owl Diner']);
});

test('listing: 3 combined filters', async () => {
  const r = await get(`city=indore&cuisines=${m.cuisine.slug},${m.cuisine2.slug}&cost=mid,premium&minRating=4`);
  assert.deepEqual(names(r).sort(), ['Grand Luxe', 'Night Owl Diner']);
  const r2 = await get(`type=veg&amenities=${wifi.slug}&category=bakery&sort=name`);
  assert.deepEqual(names(r2), ['Morning Bakery']);
});

test('listing: every sort', async () => {
  const exp = {
    rating: ['Grand Luxe', 'Night Owl Diner', 'Morning Bakery'],
    popular: ['Night Owl Diner', 'Morning Bakery', 'Grand Luxe'],
    priceDesc: ['Grand Luxe', 'Night Owl Diner', 'Ujjain Thali', 'Morning Bakery'],
    name: ['Grand Luxe', 'Morning Bakery', 'Night Owl Diner', 'Ujjain Thali'],
  };
  assert.deepEqual(names(await get('sort=rating')).slice(0, 3), exp.rating);
  assert.deepEqual(names(await get('sort=popular')).slice(0, 3), exp.popular);
  assert.deepEqual(names(await get('sort=priceAsc')), ['Morning Bakery', 'Ujjain Thali', 'Night Owl Diner', 'Grand Luxe']);
  assert.deepEqual(names(await get('sort=priceDesc')), exp.priceDesc.slice(0, 2).concat(['Ujjain Thali', 'Morning Bakery']));
  assert.deepEqual(names(await get('sort=name')), exp.name);
  assert.equal(names(await get('sort=newest'))[0], 'Ujjain Thali');
  assert.equal(names(await get('sort=relevance'))[0], 'Night Owl Diner', 'featured first without a search');
  assert.deepEqual(names(await get('sort=priceForTwo&order=desc'))[0], 'Grand Luxe', 'legacy key still works');
  const bad = await get('sort=garbage');
  assert.equal(bad.status, 400);
  assert.equal((await get('sort=$where')).status, 400);
});

test('listing: pagination, limits, hostile input never 500', async () => {
  const p1 = await get('limit=3&page=1&sort=name');
  const p2 = await get('limit=3&page=2&sort=name');
  assert.equal(p1.body.data.length, 3);
  assert.equal(p2.body.data.length, 1);
  assert.deepEqual(p1.body.pagination, { page: 1, limit: 3, total: 4, totalPages: 2 });
  const far = await get('page=99999');
  assert.equal(far.status, 200);
  assert.deepEqual(far.body.data, []);
  assert.equal(far.body.pagination.total, 4);
  assert.ok(far.body.facets.cuisines.length, 'facets still computed on empty page');
  assert.equal((await get('limit=1000')).body.pagination.limit, 50);
  assert.equal((await get('page=-5')).body.pagination.page, 1);
  assert.equal((await get('page=abc&limit=-3')).status, 200);
  assert.equal((await get('cuisines=notanid')).status, 200);
  assert.deepEqual((await get('cuisines=notanid')).body.data, []);
  assert.deepEqual((await get(`amenities=${wifi.slug},nope`)).body.data, [], 'ALL with an unknown amenity matches nothing');
  for (const s of ["';DROP", 'x'.repeat(500), '(((', '$ne', '🍕🍕', '"', '-', '\\']) {
    const r = await ctx.request.get(A).query({ search: s });
    assert.equal(r.status, 200, `search ${s.slice(0, 10)} -> ${r.status}`);
  }
  assert.equal((await ctx.request.get(A).query({ search: 'x'.repeat(501) })).status, 400, 'over-long search rejected cleanly');
  for (const qs of ['minRating=9', 'cost=free', 'openNow=maybe', 'city[$ne]=x']) assert.notEqual((await get(qs)).status, 500, qs);
  assert.equal((await get('minRating=9')).status, 400);
});

test('listing: openNow is Asia/Kolkata and past-midnight aware (injectable clock)', async () => {
  at(WED_20_IST);
  assert.deepEqual(names(await get('openNow=true')).sort(), ['Grand Luxe', 'Night Owl Diner', 'Ujjain Thali']);
  at(THU_01_IST); // Night Owl's Wed 18:00-02:00 shift is still running
  assert.deepEqual(names(await get('openNow=true')), ['Night Owl Diner']);
  at(THU_03_IST);
  assert.deepEqual(names(await get('openNow=true')), []);
  at(WED_09_IST);
  assert.deepEqual(names(await get('openNow=true')).sort(), ['Morning Bakery', 'Ujjain Thali']);
  const card = (await get('search=owl')).body.data[0];
  assert.equal(card.openStatus.isOpen, false);
  assert.equal(card.openStatus.opensAt, '18:00');
  assert.equal(card.timings, undefined, 'list cards carry openStatus, not raw timings');
  at(WED_20_IST);
  assert.equal((await get('search=owl')).body.data[0].openStatus.isOpen, true);
});

test('listing: facets reflect current filters minus the facet\'s own filter', async () => {
  const all = (await get('')).body.facets;
  const cnt = (list, key) => Object.fromEntries(list.map((x) => [x.name, x.count]))[key];
  assert.equal(cnt(all.cuisines, 'North Indian'), 3); // owl, luxe, far (default restaurantBody cuisine)
  assert.equal(cnt(all.cuisines, 'Chinese'), 2);
  assert.equal(cnt(all.category, 'bakery'), 1);
  assert.equal(cnt(all.category, 'restaurant'), 3);
  assert.equal(cnt(all.cost, 'mid'), 1);
  assert.ok(all.cuisines[0].id && all.cuisines[0].slug, 'cuisine facets carry id+slug+name');

  // category filter applied: category facet ignores itself, cuisine facet obeys it
  const f = (await get('category=bakery')).body.facets;
  assert.equal(cnt(f.category, 'restaurant'), 3, 'own filter excluded');
  assert.equal(cnt(f.cuisines, 'Chinese'), 1);
  assert.equal(cnt(f.cuisines, 'North Indian'), undefined, 'no bakery has North Indian');
  // base filter (city) applies to all facets
  const c = (await get('city=ujjain')).body.facets;
  assert.equal(cnt(c.category, 'restaurant'), 1);
  assert.equal(c.category.length, 1);
  // data and total agree with filters while facets span siblings
  const both = await get(`cuisines=${m.cuisine2.slug}&cost=budget`);
  assert.deepEqual(names(both), ['Morning Bakery']);
  assert.equal(cnt(both.body.facets.cost, 'premium'), 1, 'cost facet ignores cost but obeys cuisine');
  assert.equal(cnt(both.body.facets.cost, 'mid'), undefined);
  // amenity facet counts
  const am = (await get(`amenities=${wifi.slug}`)).body.facets.amenities;
  assert.equal(cnt(am, 'WiFi'), 2);
  assert.equal(cnt(am, 'Parking'), 2, 'amenity facet ignores its own filter');
  const am2 = (await get(`amenities=${wifi.slug}&city=ujjain`)).body.facets.amenities;
  assert.equal(cnt(am2, 'Parking'), 1, 'but obeys other filters (city: Thali only)');
});

test('listing: no leaked fields, inactive never public, admin list keeps working', async () => {
  const body = (await get('')).body;
  const keys = allKeys(body);
  for (const k of ['createdBy', '__v', 'publicId', 'gallery', 'ownerName', 'contactEmail', 'timings']) assert.ok(!keys.has(k), `leaked ${k}`);
  assert.ok(!names({ body }).includes('Hidden Gem Inactive'));
  assert.equal((await ctx.request.get(`${A}?includeInactive=true`)).status, 401);
  const adm = await ctx.request.get(`${A}?includeInactive=true&limit=100&sort=createdAt&order=desc`).set(auth(admin));
  assert.equal(adm.status, 200);
  assert.equal(adm.body.pagination.total, 5);
  const adm2 = await ctx.request.get(`${A}?includeInactive=true&isActive=false&cuisines=${m.cuisine.slug}&featured=false`).set(auth(admin));
  assert.deepEqual(names(adm2), ['Hidden Gem Inactive']);
});

// ---------- 3.2 nearby ----------
test('nearby: ordering, distances, radius, filters, validation', async () => {
  const q = (qs) => ctx.request.get(`${A}/nearby?${qs}`);
  const vj = 'lat=22.7531&lng=75.8937';
  let r = await q(`${vj}&radius=10`);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(names(r), ['Night Owl Diner', 'Grand Luxe', 'Morning Bakery']);
  const d = r.body.data.map((x) => x.distanceMeters);
  assert.equal(d[0], 0);
  assert.ok(d[1] > 1000 && d[1] < 2500, `Grand Luxe ${d[1]} m`);
  assert.ok(d[2] > 3500 && d[2] < 5500, `Bakery ${d[2]} m`);
  assert.deepEqual([...d].sort((a, b) => a - b), d, 'nearest first');
  assert.ok(r.body.data[0].openStatus && r.body.data[0].address.city.name);
  assert.equal(r.body.center.radiusKm, 10);

  assert.deepEqual(names(await q(`${vj}`)), ['Night Owl Diner', 'Grand Luxe'], 'default radius 5km (bakery is further)');
  assert.deepEqual(names(await q(`${vj}&radius=0.1`)), ['Night Owl Diner'], 'radius 100 m -> only the one right here');
  assert.deepEqual(names(await q('lat=22.60&lng=75.70&radius=0.1')), []);
  assert.equal((await q(`${vj}&radius=500`)).body.center.radiusKm, 50);
  assert.equal((await q(`${vj}&radius=10&limit=2`)).body.data.length, 2);

  assert.deepEqual(names(await q(`${vj}&radius=10&cuisines=${m.cuisine2.slug}`)), ['Grand Luxe', 'Morning Bakery']);
  assert.deepEqual(names(await q(`${vj}&radius=10&cost=budget&search=morn`)), ['Morning Bakery']);
  at(THU_01_IST);
  assert.deepEqual(names(await q(`${vj}&radius=10&openNow=true`)), ['Night Owl Diner']);
  at(WED_20_IST);
  assert.ok(!names(await q(`${vj}&radius=50`)).includes('Hidden Gem Inactive'));

  for (const bad of ['lat=999&lng=75.8', 'lat=22&lng=999', 'lat=abc&lng=75', 'lng=75', 'lat=&lng=', `${vj}&radius=0`, `${vj}&radius=-3`, `${vj}&radius=x`]) {
    assert.equal((await q(bad)).status, 400, bad);
  }
  assert.equal((await ctx.request.get(`${A}/nearby`)).status, 400, 'missing coords');
  assert.equal((await q(`${vj}&sort=garbage&page=-5&limit=99999`)).status, 200);
});

// ---------- 3.3 detail ----------
test('detail: populated, openStatus, similar, no leaked fields, 404s', async () => {
  const res = await ctx.request.get(`${A}/night-owl-diner`);
  assert.equal(res.status, 200);
  const d = res.body.data;
  assert.equal(d.address.city.name, 'Indore');
  assert.equal(d.cuisines[0].name, 'North Indian');
  assert.deepEqual(d.amenities.map((a) => a.name).sort(), ['Parking', 'WiFi']);
  assert.equal(d.openStatus.isOpen, true);
  assert.equal(d.openStatus.closesAt, '02:00');
  assert.equal(d.timings.length, 7);
  const keys = allKeys(res.body);
  for (const k of ['createdBy', '__v', 'publicId']) assert.ok(!keys.has(k), `leaked ${k}`);

  // similar: shares a cuisine, same city, excludes self, max 4, no inactive
  assert.ok(d.similar.length >= 1 && d.similar.length <= 4);
  assert.ok(d.similar.every((s) => s.slug !== 'night-owl-diner' && s.slug !== 'hidden-gem-inactive' && s.slug !== 'ujjain-thali'));
  assert.deepEqual(d.similar.map((s) => s.name), ['Grand Luxe']); // North Indian + Indore; bakery is Chinese-only
  assert.equal(allKeys(d.similar).has('publicId'), false);
  assert.ok(d.similar[0].openStatus);

  at(THU_03_IST);
  const closed = (await ctx.request.get(`${A}/night-owl-diner`)).body.data.openStatus;
  assert.deepEqual([closed.isOpen, closed.opensAt, closed.nextOpenDay], [false, '18:00', 'thursday']);
  at(WED_20_IST);

  assert.equal((await ctx.request.get(`${A}/no-such-place`)).status, 404);
  assert.equal((await ctx.request.get(`${A}/hidden-gem-inactive`)).status, 404, 'inactive hidden');
  assert.equal((await ctx.request.get(`${A}/hidden-gem-inactive`).set(auth(admin))).status, 200, 'admin still sees inactive');
  assert.equal((await ctx.request.get(`${A}/${'a'.repeat(24)}`)).status, 404);
});

test('detail: admin token keeps full document (createdBy, publicId) for the edit form', async () => {
  const withImg = R.luxe._id;
  await ctx.models.Restaurant.updateOne({ _id: withImg }, { $set: { coverImage: { url: 'http://x/c.webp', publicId: 'pid-cover' }, gallery: [{ url: 'http://x/g.webp', publicId: 'pid-g' }] } });
  const pub = await ctx.request.get(`${A}/grand-luxe`);
  assert.equal(pub.body.data.coverImage.url, 'http://x/c.webp');
  assert.equal(pub.body.data.gallery[0].url, 'http://x/g.webp');
  assert.ok(!allKeys(pub.body).has('publicId'));
  const adm = await ctx.request.get(`${A}/${withImg}`).set(auth(admin));
  assert.equal(adm.body.data.coverImage.publicId, 'pid-cover');
  assert.ok(adm.body.data.createdBy);
  assert.equal(adm.body.data.address.city.name, 'Indore');
});

test('detail: restaurant with no timings / no cuisines is fine', async () => {
  const res = await ctx.request.post(A).set(auth(admin)).send(restaurantBody(m, { name: 'Bare Place', timings: [], cuisines: [] }));
  const d = (await ctx.request.get(`${A}/${res.body.data.slug}`)).body.data;
  assert.equal(d.openStatus.hasTimings, false);
  assert.equal(d.openStatus.isOpen, false);
  assert.deepEqual(d.similar, []);
  await ctx.models.Restaurant.deleteOne({ _id: res.body.data._id });
});

test('openStatus unit: past midnight, closed day, week wrap', () => {
  const t = week('18:00', '02:00');
  const sun = t.find((x) => x.day === 'sunday');
  sun.isClosed = true;
  // Sat 23:00 IST -> open; Sun 01:00 IST (Sat shift) -> open; Sun 20:00 -> closed (closed day), next = monday 18:00
  assert.equal(openStatus(t, new Date('2026-01-10T17:30:00Z')).isOpen, true); // Sat 23:00 IST
  assert.equal(openStatus(t, new Date('2026-01-10T20:00:00Z')).isOpen, true); // Sun 01:30 IST
  const s = openStatus(t, new Date('2026-01-11T14:30:00Z')); // Sun 20:00 IST
  assert.deepEqual([s.isOpen, s.opensAt, s.nextOpenDay], [false, '18:00', 'monday']);
  // Mon 01:00 IST: sunday is closed so Sunday has no late shift
  assert.equal(openStatus(t, new Date('2026-01-11T19:30:00Z')).isOpen, false);
  // server timezone must not matter: 23:00 UTC Wed = Thu 04:30 IST
  assert.equal(openStatus(week('10:00', '23:00'), new Date('2026-01-07T23:00:00Z')).isOpen, false);
  assert.equal(openStatus(week('00:00', '00:00'), new Date('2026-01-07T05:00:00Z')).isOpen, true, 'open==close is 24h');
  assert.equal(openStatus(undefined).hasTimings, false);
});

// ---------- 3.8 suggest ----------
test('suggest: grouped, capped, escaped, validated', async () => {
  const q = (s) => ctx.request.get('/api/v1/search/suggest').query({ q: s });
  let r = await q('n');
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body.data).sort(), ['areas', 'cuisines', 'restaurants']);
  assert.deepEqual(r.body.data.restaurants.map((x) => x.slug), ['night-owl-diner']);
  assert.deepEqual(r.body.data.cuisines.map((x) => x.name), ['North Indian']);
  assert.deepEqual(Object.keys(r.body.data.cuisines[0]).sort(), ['id', 'name', 'slug']);
  assert.deepEqual(Object.keys(r.body.data.restaurants[0]).sort(), ['area', 'coverImage', 'name', 'slug']);

  r = await q('vij');
  assert.deepEqual(r.body.data.areas, [{ name: 'Vijay Nagar', count: 3 }]);
  assert.deepEqual((await q('MAHA')).body.data.areas, [{ name: 'Mahakal', count: 1 }], 'case-insensitive');
  assert.deepEqual((await q('luxe')).body.data.restaurants.map((x) => x.name), ['Grand Luxe'], 'word inside a name via text index');
  assert.ok(!(await q('hidden')).body.data.restaurants.length, 'inactive never suggested');

  // cap 5 each
  for (let i = 0; i < 7; i++) await ctx.request.post('/api/v1/cuisines').set(auth(admin)).send({ name: `Zed Cuisine ${i}` });
  for (let i = 0; i < 7; i++) await ctx.request.post(A).set(auth(admin)).send(restaurantBody(m, { name: `Zed Place ${i}`, address: { line1: 'x road', area: `Zed Area ${i}`, city: m.city._id } }));
  r = await q('zed');
  assert.equal(r.body.data.restaurants.length, 5);
  assert.equal(r.body.data.cuisines.length, 5);
  assert.equal(r.body.data.areas.length, 5);

  assert.equal((await ctx.request.get('/api/v1/search/suggest')).status, 400);
  assert.equal((await q('')).status, 400);
  assert.equal((await q('   ')).status, 400);
  for (const s of ['.*', "';DROP", '(((', '$ne', '[', '\\', '"', '🍕', 'x'.repeat(5000)]) {
    const x = await q(s);
    assert.equal(x.status, 200, `${s.slice(0, 8)} -> ${x.status}`);
  }
  assert.equal((await q('.*')).body.data.restaurants.length, 0, 'regex chars are escaped, not interpreted');
  assert.equal((await ctx.request.get('/api/v1/search/suggest?q[$ne]=x')).status, 400);
});
