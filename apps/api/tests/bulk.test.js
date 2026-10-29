import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boot, auth } from './helpers.js';
import { week } from './fixtures.js';

const API = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(API, '../..');
let ctx, admin;
const URL_ = '/api/v1/restaurants/bulk-import';

before(async () => {
  ctx = await boot();
  admin = await ctx.makeAdmin();
});
after(() => ctx.close());
beforeEach(async () => {
  await ctx.models.Restaurant.deleteMany({});
  await Promise.all([ctx.models.City.deleteMany({}), ctx.models.Cuisine.deleteMany({}), ctx.models.Amenity.deleteMany({})]);
});

const row = (i, over = {}) => ({
  name: `Row Restaurant ${i}`,
  address: { line1: `${i} Main Street`, area: 'Vijay Nagar', city: { name: 'Indore', state: 'Madhya Pradesh' }, pincode: '452010' },
  location: { lat: 22.7 + (i % 1000) * 0.0005, lng: 75.8 + Math.floor(i / 1000) * 0.01 + (i % 7) * 0.0003 },
  type: 'both',
  category: 'restaurant',
  priceForTwo: 200 + (i % 30) * 100,
  cuisines: ['North Indian', `Cuisine ${i % 20}`],
  amenities: ['Parking'],
  timings: week('18:00', '02:00'),
  ...over,
});
const send = (body) => ctx.request.post(URL_).set(auth(admin)).send(body);

test('3 valid + 2 broken: valid created, broken reported with exact reasons', async () => {
  const rows = [
    row(1),
    row(2, { priceForTwo: -5 }),
    row(3),
    row(4, { location: { lat: 999, lng: 75 }, externalLinks: { zomatoUrl: 'https://evil.com/x' } }),
    row(5),
  ];
  const res = await send(rows);
  assert.equal(res.status, 200, JSON.stringify(res.body).slice(0, 500));
  const { totals, results } = res.body.data;
  assert.deepEqual(totals, { total: 5, created: 3, updated: 0, skipped: 2 });
  assert.deepEqual(results.map((r) => r.status), ['created', 'skipped', 'created', 'skipped', 'created']);
  assert.deepEqual(results.map((r) => r.index), [0, 1, 2, 3, 4]);
  assert.match(results[1].reason, /priceForTwo: priceForTwo must be greater than 0/);
  assert.match(results[3].reason, /location\.lat: Latitude must be between -90 and 90/);
  assert.match(results[3].reason, /address|externalLinks\.zomatoUrl: Must be a valid Zomato URL/);
  assert.ok(results[0].id);
  assert.equal(await ctx.models.Restaurant.countDocuments(), 3);
  const saved = await ctx.models.Restaurant.findById(results[0].id).lean();
  assert.equal(saved.costBracket, 'mid');
  assert.ok(saved.createdAt && saved.createdBy);
  assert.equal(saved.slug, 'row-restaurant-1');
  assert.equal(saved.timings[0].closeTime, '02:00');
  // masters auto-created exactly once
  assert.equal(await ctx.models.City.countDocuments(), 1);
  assert.equal(await ctx.models.Amenity.countDocuments(), 1);
  assert.equal(await ctx.models.Cuisine.countDocuments({ name: 'North Indian' }), 1);
});

test('non-array / missing rows / unknown row shapes handled', async () => {
  assert.equal((await send({})).status, 400);
  assert.equal((await send([])).status, 400);
  assert.equal((await send('hello')).status, 400);
  const res = await send([null, 5, 'str', { name: 'x' }]);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.totals.skipped, 4);
});

test('idempotent: second run creates nothing; changed row is updated; moved >50m is a new restaurant', async () => {
  const rows = [row(1), row(2), row(3)];
  const a = await send(rows);
  assert.equal(a.body.data.totals.created, 3);
  const b = await send(rows);
  assert.deepEqual(b.body.data.totals, { total: 3, created: 0, updated: 0, skipped: 3 });
  assert.ok(b.body.data.results.every((r) => r.reason === 'No changes' && r.id));
  assert.equal(await ctx.models.Restaurant.countDocuments(), 3);

  // manual admin edits (featured flag) survive re-import when the row does not mention them
  await ctx.models.Restaurant.updateOne({ name: 'Row Restaurant 1' }, { isFeatured: true });
  const c = await send([row(1, { priceForTwo: 900 }), row(2), row(3, { location: { lat: 22.7 + 0.01, lng: 75.8 } })]);
  assert.deepEqual(c.body.data.results.map((r) => r.status), ['updated', 'skipped', 'created']);
  const r1 = await ctx.models.Restaurant.findOne({ name: 'Row Restaurant 1' }).lean();
  assert.equal(r1.priceForTwo, 900);
  assert.equal(r1.costBracket, 'premium');
  assert.equal(r1.isFeatured, true);
  const slugs = (await ctx.models.Restaurant.find({ name: 'Row Restaurant 3' }).lean()).map((r) => r.slug).sort();
  assert.deepEqual(slugs, ['row-restaurant-3', 'row-restaurant-3-2']);
});

test('same name + same coords inside one import is detected as duplicate', async () => {
  const res = await send([row(1), row(1), row(1, { location: { lat: 10, lng: 10 } })]);
  assert.deepEqual(res.body.data.results.map((r) => r.status), ['created', 'skipped', 'created']);
  assert.match(res.body.data.results[1].reason, /Duplicate of row 0/);
});

test('explicit slug matches and updates; {rows,autoCreate:false} skips rows with unknown masters; dryRun writes nothing', async () => {
  await send([row(1, { slug: 'my-custom-slug' })]);
  const r = await send({ rows: [row(1, { slug: 'my-custom-slug', priceForTwo: 450 })] });
  assert.equal(r.body.data.results[0].status, 'updated');
  assert.equal(await ctx.models.Restaurant.countDocuments(), 1);

  const off = await send({ autoCreate: false, rows: [row(2, { cuisines: ['Martian'] }), row(3, { cuisines: ['North Indian'], address: { line1: 'x road', city: 'Atlantis' } })] });
  assert.equal(off.body.data.totals.skipped, 2);
  assert.match(off.body.data.results[0].reason, /Cuisine "Martian" does not exist/);
  assert.match(off.body.data.results[1].reason, /City "Atlantis" does not exist/);

  const before = await ctx.models.Restaurant.countDocuments();
  const cuisinesBefore = await ctx.models.Cuisine.countDocuments();
  const dry = await send({ dryRun: true, rows: [row(10), row(11), row(1, { slug: 'my-custom-slug', priceForTwo: 999 })] });
  assert.equal(dry.body.data.dryRun, true);
  assert.deepEqual(dry.body.data.results.map((x) => x.status), ['created', 'created', 'updated']);
  assert.equal(await ctx.models.Restaurant.countDocuments(), before);
  assert.equal(await ctx.models.Cuisine.countDocuments(), cuisinesBefore);
  assert.equal((await ctx.models.Restaurant.findOne({ slug: 'my-custom-slug' })).priceForTwo, 450);
});

test('bulk-import needs admin', async () => {
  assert.equal((await ctx.request.post(URL_).send([row(1)])).status, 401);
  const u = await ctx.makeUser();
  assert.equal((await ctx.request.post(URL_).set(auth(u.token)).send([row(1)])).status, 403);
});

test('10,000 rows complete (chunked by 500), idempotent re-run, correct counts', async () => {
  const N = 10000;
  const rows = Array.from({ length: N }, (_, i) => row(i));
  // 200 same-name restaurants at different places must all get distinct slugs
  for (let i = 0; i < 200; i++) rows[i] = row(i, { name: 'Chain Branch', location: { lat: 22 + i * 0.01, lng: 75 } });
  const bytes = Buffer.byteLength(JSON.stringify(rows));
  let t = Date.now();
  const res = await send(rows);
  const first = Date.now() - t;
  assert.equal(res.status, 200, JSON.stringify(res.body).slice(0, 300));
  assert.deepEqual(res.body.data.totals, { total: N, created: N, updated: 0, skipped: 0 });
  assert.equal(await ctx.models.Restaurant.countDocuments(), N);
  assert.equal(new Set((await ctx.models.Restaurant.find({}, 'slug').lean()).map((r) => r.slug)).size, N, 'all slugs unique');
  assert.equal(await ctx.models.City.countDocuments(), 1);

  t = Date.now();
  const again = await send(rows);
  const second = Date.now() - t;
  assert.deepEqual(again.body.data.totals, { total: N, created: 0, updated: 0, skipped: N });
  assert.equal(await ctx.models.Restaurant.countDocuments(), N);
  console.log(`  10,000-row bulk import: first run ${first}ms (payload ${(bytes / 1048576).toFixed(1)}MB), idempotent re-run ${second}ms`);
});

test('seed CLI: sample file dry-run, import, re-run; repo-root and cwd-relative paths both work', async () => {
  const env = { ...process.env, NODE_ENV: 'test', MONGO_URI: process.env.MONGO_URI, JWT_SECRET: process.env.JWT_SECRET };
  const run = (cwd, ...args) => spawnSync(process.execPath, [path.join(API, 'src/scripts/seed.js'), ...args], { cwd, env, encoding: 'utf8', timeout: 60000 });

  const dry = run(API, '--file=./data/restaurants.sample.json', '--dry-run');
  assert.equal(dry.status, 0, dry.stderr + dry.stdout);
  assert.match(dry.stdout, /5 created.*dry run/);
  assert.equal(await ctx.models.Restaurant.countDocuments(), 0, 'dry run wrote nothing');
  assert.equal(await ctx.models.City.countDocuments(), 0);

  const real = run(REPO, '--file=./data/restaurants.sample.json');
  assert.equal(real.status, 0, real.stderr + real.stdout);
  assert.match(real.stdout, /Johny Hot Dog\s+CREATED/);
  assert.match(real.stdout, /5 rows -> 5 created, 0 updated, 0 skipped/);
  assert.equal(await ctx.models.Restaurant.countDocuments(), 5);
  const johny = await ctx.models.Restaurant.findOne({ slug: 'johny-hot-dog' }).populate('cuisines address.city').lean();
  assert.equal(johny.address.city.name, 'Indore');
  assert.ok(johny.cuisines.length === 2);

  const again = run(API, '--file=../../data/restaurants.sample.json');
  assert.match(again.stdout, /0 created, 0 updated, 5 skipped/);
  assert.equal(await ctx.models.Restaurant.countDocuments(), 5);

  const missing = run(API, '--file=./nope.json');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /File not found/);
});
