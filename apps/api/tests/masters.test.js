import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, auth } from './helpers.js';

let ctx, admin, user;
before(async () => {
  ctx = await boot();
  admin = await ctx.makeAdmin();
  user = (await ctx.makeUser()).token;
});
after(() => ctx.close());

const R = ['cities', 'cuisines', 'amenities'];

test('every admin endpoint: 401 without token, 403 for normal user', async () => {
  const fakeId = '64b64b64b64b64b64b64b64b';
  const eps = [
    ...R.flatMap((r) => [['post', `/${r}`], ['patch', `/${r}/${fakeId}`], ['delete', `/${r}/${fakeId}`]]),
    ['post', '/restaurants'], ['post', '/restaurants/bulk-import'],
    ['patch', `/restaurants/${fakeId}`], ['delete', `/restaurants/${fakeId}`],
    ['patch', `/restaurants/${fakeId}/toggle`], ['patch', `/restaurants/${fakeId}/cover`],
    ['post', `/restaurants/${fakeId}/gallery`], ['patch', `/restaurants/${fakeId}/gallery/reorder`],
    ['delete', `/restaurants/${fakeId}/gallery/${fakeId}`], ['get', '/admin/stats'],
  ];
  for (const [m, p] of eps) {
    const none = await ctx.request[m](`/api/v1${p}`).send({});
    assert.equal(none.status, 401, `${m} ${p} anon`);
    const usr = await ctx.request[m](`/api/v1${p}`).set(auth(user)).send({});
    assert.equal(usr.status, 403, `${m} ${p} user`);
    assert.equal(usr.body.success, false);
  }
  // includeInactive needs an admin token
  for (const r of R) {
    assert.equal((await ctx.request.get(`/api/v1/${r}?includeInactive=true`)).status, 401);
    assert.equal((await ctx.request.get(`/api/v1/${r}?includeInactive=true`).set(auth(user))).status, 403);
    assert.equal((await ctx.request.get(`/api/v1/${r}?includeInactive=true`).set(auth(admin))).status, 200);
  }
});

test('cuisine CRUD, slug generation and collisions (-2, -3)', async () => {
  const mk = (name) => ctx.request.post('/api/v1/cuisines').set(auth(admin)).send({ name });
  const a = await mk('Café Special');
  assert.equal(a.status, 201);
  assert.equal(a.body.data.slug, 'cafe-special');
  const b = await mk('Cafe Special');
  assert.equal(b.body.data.slug, 'cafe-special-2');
  const c = await mk('Cafe  Special!');
  assert.equal(c.body.data.slug, 'cafe-special-3');
  assert.equal((await mk('cafe special')).status, 409, 'same name (case-insensitive) rejected');

  const get = await ctx.request.get(`/api/v1/cuisines/${a.body.data.slug}`);
  assert.equal(get.body.data.name, 'Café Special');
  assert.equal((await ctx.request.get(`/api/v1/cuisines/${a.body.data._id}`)).status, 200);

  const patch = await ctx.request.patch(`/api/v1/cuisines/${a.body.data._id}`).set(auth(admin)).send({ icon: 'coffee', name: 'Café Deluxe' });
  assert.equal(patch.body.data.icon, 'coffee');
  assert.equal(patch.body.data.slug, 'cafe-special', 'slug stays stable');
  assert.equal((await ctx.request.patch(`/api/v1/cuisines/${a.body.data._id}`).set(auth(admin)).send({ name: 'Cafe Special' })).status, 409);

  assert.equal((await ctx.request.delete(`/api/v1/cuisines/${c.body.data._id}`).set(auth(admin))).status, 200);
  assert.equal((await ctx.request.get(`/api/v1/cuisines/${c.body.data._id}`)).status, 404);
  assert.equal((await ctx.request.get('/api/v1/cuisines/not-an-id-or-slug')).status, 404);
});

test('soft delete: inactive hidden from public, visible to admin with includeInactive', async () => {
  const created = await ctx.request.post('/api/v1/amenities').set(auth(admin)).send({ name: 'Hidden Amenity' });
  await ctx.request.patch(`/api/v1/amenities/${created.body.data._id}`).set(auth(admin)).send({ isActive: false });
  const pub = await ctx.request.get('/api/v1/amenities?search=Hidden');
  assert.equal(pub.body.data.length, 0);
  assert.equal((await ctx.request.get(`/api/v1/amenities/${created.body.data._id}`)).status, 404);
  const adm = await ctx.request.get('/api/v1/amenities?search=Hidden&includeInactive=true').set(auth(admin));
  assert.equal(adm.body.data.length, 1);
  assert.equal((await ctx.request.get(`/api/v1/amenities/${created.body.data._id}`).set(auth(admin))).status, 200);
});

test('validation: empty/short name, wrong types, bad id', async () => {
  const bad = await ctx.request.post('/api/v1/cities').set(auth(admin)).send({ name: 'x' });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.errors.name);
  assert.equal((await ctx.request.post('/api/v1/cities').set(auth(admin)).send({ name: ['a', 'b'] })).status, 400);
  assert.equal((await ctx.request.post('/api/v1/cities').set(auth(admin)).send({ name: { $ne: 1 } })).status, 400);
  const city = await ctx.request.post('/api/v1/cities').set(auth(admin)).send({ name: 'Bhopal', state: 'Madhya Pradesh' });
  assert.equal(city.status, 201);
  assert.equal((await ctx.request.post('/api/v1/cities').set(auth(admin)).send({ name: 'bhopal', state: 'madhya pradesh' })).status, 409);
  assert.equal((await ctx.request.post('/api/v1/cities').set(auth(admin)).send({ name: 'Bhopal', state: 'Other' })).status, 201, 'same name other state is a different city');
});

test('list helper: pagination, clamps, huge page, search safety', async () => {
  for (let i = 1; i <= 25; i++) await ctx.request.post('/api/v1/cuisines').set(auth(admin)).send({ name: `Bulk Cuisine ${String(i).padStart(2, '0')}` });
  const p1 = await ctx.request.get('/api/v1/cuisines?search=Bulk Cuisine&limit=10&page=1');
  assert.equal(p1.status, 200);
  assert.equal(p1.body.success, true);
  assert.equal(p1.body.data.length, 10);
  assert.deepEqual(p1.body.pagination, { page: 1, limit: 10, total: 25, totalPages: 3 });
  const p3 = await ctx.request.get('/api/v1/cuisines?search=Bulk Cuisine&limit=10&page=3');
  assert.equal(p3.body.data.length, 5);
  const desc = await ctx.request.get('/api/v1/cuisines?search=Bulk Cuisine&sort=name&order=desc&limit=1');
  assert.equal(desc.body.data[0].name, 'Bulk Cuisine 25');

  const huge = await ctx.request.get('/api/v1/cuisines?page=99999');
  assert.equal(huge.status, 200);
  assert.deepEqual(huge.body.data, []);
  assert.equal(huge.body.pagination.page, 99999);
  assert.ok(huge.body.pagination.total >= 25);

  assert.equal((await ctx.request.get('/api/v1/cuisines?limit=100000')).body.pagination.limit, 100);
  assert.equal((await ctx.request.get('/api/v1/cuisines?limit=0')).body.pagination.limit, 1);
  assert.equal((await ctx.request.get('/api/v1/cuisines?limit=-4&page=-3')).body.pagination.page, 1);
  assert.equal((await ctx.request.get('/api/v1/cuisines?page=abc&limit=xyz')).status, 200);
  assert.equal((await ctx.request.get('/api/v1/cuisines?page=99999999999999999999')).status, 200);

  for (const s of ["';DROP TABLE users;--", '.*', '(', '[a-', '\\', 'a'.repeat(500), '$where', '{"$ne":1}']) {
    const r = await ctx.request.get('/api/v1/cuisines').query({ search: s });
    assert.equal(r.status, 200, `search ${s.slice(0, 20)}`);
    assert.equal(r.body.success, true);
  }
  // '.*' must be matched literally (escaped), not as wildcard
  assert.equal((await ctx.request.get('/api/v1/cuisines').query({ search: '.*' })).body.data.length, 0);
  // arrays / nested operators in query are refused or ignored, never evaluated
  assert.equal((await ctx.request.get('/api/v1/cuisines?search=a&search=b')).status, 400);
  const nested = await ctx.request.get('/api/v1/cuisines?search[$ne]=x');
  assert.equal(nested.status, 200);
  assert.ok(nested.body.pagination.total >= 25, 'operator ignored => unfiltered');
  assert.equal((await ctx.request.get('/api/v1/cuisines?order=sideways')).status, 400);
  assert.ok((await ctx.request.get('/api/v1/cuisines?sort=__proto__')).body.success);
});
