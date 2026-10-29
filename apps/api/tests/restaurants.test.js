import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, auth } from './helpers.js';
import { makeMasters, restaurantBody, week } from './fixtures.js';

let ctx, admin, m;
before(async () => {
  ctx = await boot();
  admin = await ctx.makeAdmin();
  m = await makeMasters(ctx, admin);
});
after(() => ctx.close());

const post = (body) => ctx.request.post('/api/v1/restaurants').set(auth(admin)).send(body);

test('create: derived costBracket (client value ignored) + boundaries', async () => {
  const cases = [[299, 'budget'], [300, 'mid'], [799, 'mid'], [800, 'premium'], [1999, 'premium'], [2000, 'luxury']];
  for (const [price, bracket] of cases) {
    const res = await post(restaurantBody(m, { name: `Price ${price}`, priceForTwo: price, costBracket: 'luxury', ratingAvg: 5, createdBy: 'x' }));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.costBracket, bracket, `price ${price}`);
    assert.equal(res.body.data.ratingAvg, 0, 'client cannot set ratingAvg');
    assert.equal(res.body.data.location.coordinates[0], 75.8937);
  }
});

test('same-name restaurants get distinct slugs', async () => {
  const slugs = [];
  for (let i = 0; i < 3; i++) slugs.push((await post(restaurantBody(m, { name: 'Twin Dhaba' }))).body.data.slug);
  assert.deepEqual(slugs, ['twin-dhaba', 'twin-dhaba-2', 'twin-dhaba-3']);
  const parallel = await Promise.all(Array.from({ length: 5 }, () => post(restaurantBody(m, { name: 'Race Cafe' }))));
  assert.ok(parallel.every((r) => r.status === 201));
  assert.equal(new Set(parallel.map((r) => r.body.data.slug)).size, 5, 'parallel creates must not collide');
});

test('coordinates validation: 999,999 / out-of-range rejected, lat/lng form accepted', async () => {
  for (const coordinates of [[999, 999], [75.8, 91], [181, 22], [-181, 0]]) {
    const res = await post(restaurantBody(m, { location: { type: 'Point', coordinates } }));
    assert.equal(res.status, 400, JSON.stringify(coordinates));
    assert.ok(Object.keys(res.body.errors).some((k) => k.startsWith('location')));
  }
  const bad = await post(restaurantBody(m, { location: { lat: 999, lng: 999 } }));
  assert.equal(bad.status, 400);
  assert.match(JSON.stringify(bad.body.errors), /between -90 and 90|between -180 and 180/);
  assert.equal((await post(restaurantBody(m, { location: { coordinates: ['a', 'b'] } }))).status, 400);
  assert.equal((await post(restaurantBody(m, { location: undefined }))).status, 400);
  const ok = await post(restaurantBody(m, { name: 'LatLng Form', location: { lat: 22.7196, lng: 75.8577 } }));
  assert.equal(ok.status, 201);
  assert.deepEqual(ok.body.data.location, { type: 'Point', coordinates: [75.8577, 22.7196] });
});

test('nonexistent cuisine / amenity / city ids -> 400 with clear message', async () => {
  const ghost = '64b64b64b64b64b64b64b64b';
  const c = await post(restaurantBody(m, { cuisines: [m.cuisine._id, ghost] }));
  assert.equal(c.status, 400);
  assert.match(c.body.message, /Cuisine.*not found.*64b64b64b64b64b64b64b64b/);
  const a = await post(restaurantBody(m, { amenities: [ghost] }));
  assert.equal(a.status, 400);
  assert.match(a.body.message, /Amenity/);
  const city = await post(restaurantBody(m, { address: { line1: '1 Road', city: ghost } }));
  assert.equal(city.status, 400);
  assert.match(city.body.message, /City not found/);
  const bad = await post(restaurantBody(m, { cuisines: ['not-an-id'] }));
  assert.equal(bad.status, 400);
  assert.equal((await post(restaurantBody(m, { cuisines: [{ $ne: 1 }] }))).status, 400);
});

test('timings: past-midnight 18:00->02:00 accepted; malformed rejected', async () => {
  const t = week();
  t[4] = { day: 'friday', openTime: '18:00', closeTime: '02:00' };
  const ok = await post(restaurantBody(m, { name: 'Night Owl', timings: t }));
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.timings[4].closeTime, '02:00');
  const closed = week();
  closed[6] = { day: 'sunday', isClosed: true };
  assert.equal((await post(restaurantBody(m, { name: 'Sunday Off', timings: closed }))).status, 201);
  assert.equal((await post(restaurantBody(m, { timings: week('25:00', '02:00') }))).status, 400);
  assert.equal((await post(restaurantBody(m, { timings: week().slice(0, 6) }))).status, 400);
  const dup = week();
  dup[1] = { ...dup[0] };
  assert.equal((await post(restaurantBody(m, { timings: dup }))).status, 400);
  assert.equal((await post(restaurantBody(m, { timings: [{ day: 'monday' }, ...week().slice(1)] }))).status, 400);
});

test('priceForTwo: -500, 0, string, NaN-ish rejected', async () => {
  for (const priceForTwo of [-500, 0, '500', null, 1e9]) {
    const res = await post(restaurantBody(m, { priceForTwo }));
    assert.equal(res.status, 400, String(priceForTwo));
  }
  assert.match((await post(restaurantBody(m, { priceForTwo: -500 }))).body.errors.priceForTwo, /greater than 0/);
});

test('external link domains are enforced', async () => {
  const bad = {
    zomatoUrl: 'https://evil.com/zomato.com',
    swiggyUrl: 'https://swiggy.com.evil.com/x',
    mapsUrl: 'https://www.google.com/search?q=x',
    instagram: 'https://notinstagram.com/x',
    website: 'javascript:alert(1)',
  };
  for (const [k, v] of Object.entries(bad)) {
    const res = await post(restaurantBody(m, { externalLinks: { [k]: v } }));
    assert.equal(res.status, 400, k);
    assert.ok(res.body.errors[`externalLinks.${k}`], k);
  }
  const good = {
    zomatoUrl: 'https://www.zomato.com/indore/x', swiggyUrl: 'https://www.swiggy.com/restaurants/x',
    mapsUrl: 'https://maps.app.goo.gl/abc123', website: 'https://example.com', instagram: 'https://www.instagram.com/x',
  };
  const ok = await post(restaurantBody(m, { name: 'Linked', externalLinks: good }));
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  for (const mapsUrl of ['https://goo.gl/maps/xyz', 'https://maps.google.com/?q=1', 'https://www.google.com/maps/place/x', 'https://www.openstreetmap.org/node/1']) {
    assert.equal((await post(restaurantBody(m, { externalLinks: { mapsUrl } }))).status, 201, mapsUrl);
  }
  for (const [k, v] of [['zomatoUrl', 'https://zoma.to/r/1'], ['swiggyUrl', 'https://swiggy.onelink.me/abc']]) {
    assert.equal((await post(restaurantBody(m, { externalLinks: { [k]: v } }))).status, 201, v);
  }
});

test('PATCH / toggle / get by slug and id / inactive hiding', async () => {
  const created = (await post(restaurantBody(m, { name: 'Patch Me', priceForTwo: 250 }))).body.data;
  const patch = await ctx.request.patch(`/api/v1/restaurants/${created._id}`).set(auth(admin))
    .send({ priceForTwo: 1500, address: { area: 'Palasia' }, externalLinks: { zomatoUrl: 'https://zomato.com/x' }, slug: 'hacked', ratingAvg: 5 });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.data.costBracket, 'premium');
  assert.equal(patch.body.data.address.area, 'Palasia');
  assert.equal(patch.body.data.address.line1, '12 MG Road', 'untouched sub-fields kept');
  assert.equal(patch.body.data.slug, 'patch-me');
  assert.equal(patch.body.data.ratingAvg, 0);
  assert.equal((await ctx.request.patch(`/api/v1/restaurants/${created._id}`).set(auth(admin)).send({ priceForTwo: -1 })).status, 400);
  assert.equal((await ctx.request.patch('/api/v1/restaurants/zzz').set(auth(admin)).send({})).status, 400);
  assert.equal((await ctx.request.patch('/api/v1/restaurants/64b64b64b64b64b64b64b64b').set(auth(admin)).send({ name: 'Nope' })).status, 404);

  const t = await ctx.request.patch(`/api/v1/restaurants/${created._id}/toggle`).set(auth(admin)).send({ field: 'isFeatured' });
  assert.equal(t.body.data.isFeatured, true);
  assert.equal((await ctx.request.patch(`/api/v1/restaurants/${created._id}/toggle`).set(auth(admin)).send({ field: 'ratingAvg' })).status, 400);

  const bySlug = await ctx.request.get('/api/v1/restaurants/patch-me');
  assert.equal(bySlug.status, 200);
  assert.equal(bySlug.body.data.address.city.name, 'Indore');
  assert.equal(bySlug.body.data.cuisines[0].name, 'North Indian');
  assert.equal((await ctx.request.get(`/api/v1/restaurants/${created._id}`)).body.data.slug, 'patch-me');

  await ctx.request.patch(`/api/v1/restaurants/${created._id}`).set(auth(admin)).send({ isActive: false });
  assert.equal((await ctx.request.get('/api/v1/restaurants/patch-me')).status, 404);
  assert.equal((await ctx.request.get('/api/v1/restaurants/patch-me').set(auth(admin))).status, 200);
  const pub = await ctx.request.get('/api/v1/restaurants?search=Patch Me');
  assert.equal(pub.body.data.length, 0);
  const adm = await ctx.request.get('/api/v1/restaurants?search=Patch Me&includeInactive=true').set(auth(admin));
  assert.equal(adm.body.data.length, 1);
  assert.equal((await ctx.request.get('/api/v1/restaurants?includeInactive=true')).status, 401);
});

test('list: filters by city/cuisine (id or slug, csv)/category/type/bracket/featured, sort, pagination, safety', async () => {
  const other = (await ctx.request.post('/api/v1/cities').set(auth(admin)).send({ name: 'Ujjain', state: 'Madhya Pradesh' })).body.data;
  await post(restaurantBody(m, { name: 'Ujjain Sweet', type: 'veg', category: 'bakery', priceForTwo: 100, cuisines: [m.cuisine2._id], address: { line1: '1 Temple Rd', city: other._id }, isFeatured: true }));
  await post(restaurantBody(m, { name: 'Ujjain Grill', type: 'non-veg', category: 'bar', priceForTwo: 2500, cuisines: [m.cuisine._id], address: { line1: '2 Temple Rd', city: other._id } }));
  const q = (qs) => ctx.request.get(`/api/v1/restaurants?${qs}`);

  let r = await q('city=ujjain');
  assert.equal(r.body.pagination.total, 2);
  r = await q(`city=${other._id}`);
  assert.equal(r.body.pagination.total, 2);
  r = await q(`city=ujjain&cuisine=${m.cuisine2.slug}`);
  assert.deepEqual(r.body.data.map((x) => x.name), ['Ujjain Sweet']);
  r = await q(`city=ujjain&cuisine=${m.cuisine2._id},${m.cuisine.slug}`);
  assert.equal(r.body.pagination.total, 2);
  r = await q('city=ujjain&category=bar');
  assert.deepEqual(r.body.data.map((x) => x.name), ['Ujjain Grill']);
  r = await q('city=ujjain&type=veg');
  assert.deepEqual(r.body.data.map((x) => x.name), ['Ujjain Sweet']);
  r = await q('city=ujjain&costBracket=luxury');
  assert.deepEqual(r.body.data.map((x) => x.name), ['Ujjain Grill']);
  r = await q('isFeatured=true');
  assert.ok(r.body.data.every((x) => x.isFeatured));
  r = await q('city=ujjain&sort=priceForTwo&order=desc');
  assert.deepEqual(r.body.data.map((x) => x.name), ['Ujjain Grill', 'Ujjain Sweet']);
  assert.equal(r.body.data[0].gallery, undefined, 'list omits gallery');
  assert.equal(r.body.data[0].address.city.name, 'Ujjain');
  r = await q('cuisine=does-not-exist');
  assert.equal(r.body.data.length, 0);
  assert.equal((await q('category=pizza')).status, 400);
  assert.equal((await q('city[$ne]=x')).status, 200);

  r = await q('page=99999&limit=5');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data, []);
  assert.ok(r.body.pagination.total > 0);
  for (const s of ["';DROP", 'x'.repeat(500), '(((', '$ne']) assert.equal((await ctx.request.get('/api/v1/restaurants').query({ search: s })).status, 200);
  r = await q('limit=3&page=2&sort=name&order=asc');
  assert.equal(r.body.data.length, 3);
  assert.equal(r.body.pagination.limit, 3);
});

test('delete used cuisine/amenity/city refused (409 naming the conflict); allowed once unused', async () => {
  const city = (await ctx.request.post('/api/v1/cities').set(auth(admin)).send({ name: 'Dewas' })).body.data;
  const cu = (await ctx.request.post('/api/v1/cuisines').set(auth(admin)).send({ name: 'Momo' })).body.data;
  const am = (await ctx.request.post('/api/v1/amenities').set(auth(admin)).send({ name: 'Rooftop' })).body.data;
  const ids = [];
  for (const n of ['A', 'B', 'C']) {
    ids.push((await post(restaurantBody(m, { name: `Momo Hub ${n}`, cuisines: [cu._id], amenities: [am._id], address: { line1: '1 St', city: city._id } }))).body.data._id);
  }
  const d1 = await ctx.request.delete(`/api/v1/cuisines/${cu._id}`).set(auth(admin));
  assert.equal(d1.status, 409);
  assert.equal(d1.body.message.startsWith('Cuisine is used by 3 restaurants'), true, d1.body.message);
  assert.match((await ctx.request.delete(`/api/v1/amenities/${am._id}`).set(auth(admin))).body.message, /Amenity is used by 3 restaurants/);
  assert.match((await ctx.request.delete(`/api/v1/cities/${city._id}`).set(auth(admin))).body.message, /City is used by 3 restaurants/);
  for (const id of ids) assert.equal((await ctx.request.delete(`/api/v1/restaurants/${id}`).set(auth(admin))).status, 200);
  assert.equal((await ctx.request.delete(`/api/v1/cuisines/${cu._id}`).set(auth(admin))).status, 200);
  assert.equal((await ctx.request.delete(`/api/v1/amenities/${am._id}`).set(auth(admin))).status, 200);
  assert.equal((await ctx.request.delete(`/api/v1/cities/${city._id}`).set(auth(admin))).status, 200);
});

test('indexes exist on restaurants', async () => {
  const idx = await ctx.models.Restaurant.collection.indexes();
  const keys = idx.map((i) => JSON.stringify(i.key));
  assert.ok(keys.some((k) => k.includes('"2dsphere"')));
  assert.ok(idx.some((i) => i.weights && i.weights.name && i.weights['address.area'] && i.weights.description));
  assert.ok(keys.includes('{"address.city":1,"isActive":1}'));
  assert.ok(keys.includes('{"cuisines":1,"isActive":1}'));
  assert.ok(keys.includes('{"costBracket":1}'));
  assert.ok(keys.includes('{"ratingAvg":-1}'));
  assert.ok(idx.find((i) => i.key.slug && i.unique));
});
