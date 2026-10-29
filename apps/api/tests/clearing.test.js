import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, auth } from './helpers.js';
import { makeMasters, restaurantBody } from './fixtures.js';

let ctx, admin, m, id;
before(async () => {
  ctx = await boot();
  admin = await ctx.makeAdmin();
  m = await makeMasters(ctx, admin);
});
after(() => ctx.close());

const patch = (path, body) => ctx.request.patch(`/api/v1/${path}`).set(auth(admin)).send(body);
const get = async (path) => (await ctx.request.get(`/api/v1/${path}`).set(auth(admin))).body.data;
const full = {
  ownerName: 'Owner', contactPhone: '+91 98765 43210', contactEmail: 'A@B.com', description: 'desc', establishedYear: 1999,
  address: { line1: '12 MG Road', line2: 'Floor 2', area: 'Vijay Nagar', pincode: '452010' },
  externalLinks: { zomatoUrl: 'https://www.zomato.com/x', swiggyUrl: 'https://www.swiggy.com/x', mapsUrl: 'https://maps.app.goo.gl/x', website: 'https://x.com', instagram: 'https://instagram.com/x' },
};
async function fresh() {
  const body = restaurantBody(m, { ...full, address: { ...full.address, city: m.city._id } });
  const res = await ctx.request.post('/api/v1/restaurants').set(auth(admin)).send(body);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data._id;
}

test('set contactEmail, clear with "" and null -> null', async () => {
  id = await fresh();
  assert.equal((await get(`restaurants/${id}`)).contactEmail, 'a@b.com');
  for (const empty of ['', null]) {
    await patch(`restaurants/${id}`, { contactEmail: 'x@y.com' });
    const r = await patch(`restaurants/${id}`, { contactEmail: empty });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await get(`restaurants/${id}`)).contactEmail, null);
  }
});

test('update only zomatoUrl -> swiggyUrl and others survive (5x in a row)', async () => {
  id = await fresh();
  for (let i = 0; i < 5; i++) {
    const r = await patch(`restaurants/${id}`, { externalLinks: { zomatoUrl: `https://www.zomato.com/v${i}` } });
    assert.equal(r.status, 200);
    const l = (await get(`restaurants/${id}`)).externalLinks;
    assert.equal(l.zomatoUrl, `https://www.zomato.com/v${i}`);
    assert.equal(l.swiggyUrl, full.externalLinks.swiggyUrl);
    assert.equal(l.mapsUrl, full.externalLinks.mapsUrl);
  }
});

test('clear one nested link -> only that clears', async () => {
  id = await fresh();
  assert.equal((await patch(`restaurants/${id}`, { externalLinks: { swiggyUrl: '' } })).status, 200);
  const l = (await get(`restaurants/${id}`)).externalLinks;
  assert.equal(l.swiggyUrl, null);
  assert.equal(l.zomatoUrl, full.externalLinks.zomatoUrl);
  assert.equal(l.instagram, full.externalLinks.instagram);
  assert.equal((await patch(`restaurants/${id}`, { externalLinks: { zomatoUrl: null } })).status, 200);
  const l2 = (await get(`restaurants/${id}`)).externalLinks;
  assert.equal(l2.zomatoUrl, null);
  assert.equal(l2.website, full.externalLinks.website);
});

test('clear an address line -> empty, siblings untouched', async () => {
  id = await fresh();
  assert.equal((await patch(`restaurants/${id}`, { address: { line2: '' } })).status, 200);
  const a = (await get(`restaurants/${id}`)).address;
  assert.equal(a.line2, null);
  assert.equal(a.line1, '12 MG Road');
  assert.equal(a.area, 'Vijay Nagar');
  assert.equal(a.pincode, '452010');
  assert.equal(a.city._id, String(m.city._id));
  assert.equal((await patch(`restaurants/${id}`, { address: { pincode: null, area: '' } })).status, 200);
  const b = (await get(`restaurants/${id}`)).address;
  assert.equal(b.pincode, null);
  assert.equal(b.area, null);
  assert.equal(b.line1, '12 MG Road');
});

test('PATCH {name} only leaves everything else untouched', async () => {
  id = await fresh();
  const before = await get(`restaurants/${id}`);
  assert.equal((await patch(`restaurants/${id}`, { name: 'Renamed Place' })).status, 200);
  const after = await get(`restaurants/${id}`);
  const strip = ({ name, updatedAt, ...rest }) => rest;
  assert.deepEqual(strip(after), strip(before));
  assert.equal(after.name, 'Renamed Place');
});

test('clear every optional field at once, refetch, siblings and required fields intact', async () => {
  id = await fresh();
  const r = await patch(`restaurants/${id}`, {
    description: '', ownerName: '', contactPhone: '', contactEmail: '', establishedYear: null,
    address: { line2: '', area: '', pincode: '' },
    externalLinks: { zomatoUrl: '', swiggyUrl: '', mapsUrl: '', website: '', instagram: '' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const d = await get(`restaurants/${id}`);
  for (const k of ['description', 'ownerName', 'contactPhone', 'contactEmail', 'establishedYear']) assert.equal(d[k], null, k);
  for (const k of ['line2', 'area', 'pincode']) assert.equal(d.address[k], null, k);
  for (const k of Object.keys(full.externalLinks)) assert.equal(d.externalLinks[k], null, k);
  assert.equal(d.address.line1, '12 MG Road');
  assert.equal(d.name, 'Test Bistro');
  assert.equal(d.timings.length, 7);
  assert.equal(d.cuisines.length, 1);
});

test('required fields still reject blanks; invalid values still rejected', async () => {
  id = await fresh();
  assert.equal((await patch(`restaurants/${id}`, { address: { line1: '' } })).status, 400);
  assert.equal((await patch(`restaurants/${id}`, { name: '' })).status, 400);
  assert.equal((await patch(`restaurants/${id}`, { contactEmail: 'nope' })).status, 400);
  assert.equal((await patch(`restaurants/${id}`, { externalLinks: { zomatoUrl: 'https://evil.com' } })).status, 400);
});

test('timings can be cleared with []', async () => {
  id = await fresh();
  assert.equal((await patch(`restaurants/${id}`, { timings: [] })).status, 200);
  assert.deepEqual((await get(`restaurants/${id}`)).timings, []);
});

test('create accepts blank optionals', async () => {
  const res = await ctx.request.post('/api/v1/restaurants').set(auth(admin)).send(
    restaurantBody(m, { name: 'Blank Cafe', contactEmail: '', externalLinks: { zomatoUrl: '' } }),
  );
  assert.equal(res.status, 201, JSON.stringify(res.body));
});

for (const [res, create, set, clear] of [
  ['cities', { name: 'Bhopal', state: 'MP' }, { state: 'Madhya Pradesh' }, 'state'],
  ['cuisines', { name: 'Thai', icon: 'soup' }, { icon: 'bowl' }, 'icon'],
  ['amenities', { name: 'WiFi', icon: 'wifi' }, { icon: 'signal' }, 'icon'],
]) {
  test(`${res}: clear ${clear} with "" / null; name-only patch keeps it`, async () => {
    const c = await ctx.request.post(`/api/v1/${res}`).set(auth(admin)).send(create);
    assert.equal(c.status, 201);
    const mid = c.body.data._id;
    assert.equal((await patch(`${res}/${mid}`, set)).status, 200);
    assert.equal((await get(`${res}/${mid}`))[clear], set[clear]);
    assert.equal((await patch(`${res}/${mid}`, { name: `${create.name} Renamed` })).status, 200);
    assert.equal((await get(`${res}/${mid}`))[clear], set[clear], 'untouched by name-only patch');
    for (const empty of ['', null]) {
      await patch(`${res}/${mid}`, set);
      assert.equal((await patch(`${res}/${mid}`, { [clear]: empty })).status, 200);
      const d = await get(`${res}/${mid}`);
      assert.equal(d[clear], null);
      assert.equal(d.name, `${create.name} Renamed`);
      assert.equal(d.isActive, true);
    }
  });
}

test('city with cleared state: duplicate check still works', async () => {
  const a = await ctx.request.post('/api/v1/cities').set(auth(admin)).send({ name: 'Ujjain' });
  assert.equal(a.status, 201);
  assert.equal((await ctx.request.post('/api/v1/cities').set(auth(admin)).send({ name: 'ujjain', state: '' })).status, 409);
});
