import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { boot, auth } from './helpers.js';
import { makeMasters, restaurantBody, jpeg, png } from './fixtures.js';

let ctx, admin, m, rid;
const url = (suffix = '') => `/api/v1/restaurants/${rid}${suffix}`;
const onDisk = (publicId) => fs.existsSync(path.join(ctx.uploadsDir, publicId));
const fileCount = () => {
  const dir = path.join(ctx.uploadsDir, 'restaurants');
  return fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
};

before(async () => {
  ctx = await boot();
  admin = await ctx.makeAdmin();
  m = await makeMasters(ctx, admin);
});
after(() => ctx.close());

async function freshRestaurant(name) {
  const res = await ctx.request.post('/api/v1/restaurants').set(auth(admin)).send(restaurantBody(m, { name }));
  rid = res.body.data._id;
  return rid;
}

test('cover: valid PNG stored as webp under random name, served from /uploads; replacing deletes old file', async () => {
  await freshRestaurant('Cover Cafe');
  const res = await ctx.request.patch(url('/cover')).set(auth(admin)).attach('image', await png(2400, 1200), '../../evil name.png');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { url: imgUrl, publicId } = res.body.data;
  assert.match(publicId, /^restaurants\/[0-9a-f-]{36}\.webp$/);
  assert.ok(!publicId.includes('evil'));
  assert.ok(onDisk(publicId));
  const served = await ctx.request.get(new URL(imgUrl).pathname);
  assert.equal(served.status, 200);
  assert.match(served.headers['content-type'], /image\/webp/);
  assert.equal(served.headers['cross-origin-resource-policy'], 'cross-origin');
  const sharp = (await import('sharp')).default;
  assert.equal((await sharp(fs.readFileSync(path.join(ctx.uploadsDir, publicId))).metadata()).width, 1600, 'resized to max 1600');

  const second = await ctx.request.patch(url('/cover')).set(auth(admin)).attach('image', await jpeg(), 'b.jpg');
  assert.equal(second.status, 200);
  assert.ok(!onDisk(publicId), 'old cover removed');
  assert.ok(onDisk(second.body.data.publicId));
});

test('exe renamed .jpg is rejected by real signature (even with image/jpeg header)', async () => {
  await freshRestaurant('Sig Cafe');
  const base = fileCount();
  const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(90, 0), Buffer.from('PE\0\0'), Buffer.alloc(2000, 1)]);
  const res = await ctx.request.patch(url('/cover')).set(auth(admin)).attach('image', exe, { filename: 'totally-a-photo.jpg', contentType: 'image/jpeg' });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /not a valid image/);
  assert.equal((await ctx.request.get(url())).body.data.coverImage, undefined);
  const text = await ctx.request.patch(url('/cover')).set(auth(admin)).attach('image', Buffer.from('<?php system($_GET[1]); ?>'), { filename: 'a.png', contentType: 'image/png' });
  assert.equal(text.status, 400);
  const gif = Buffer.from('R0lGODlhAQABAAAAACw=', 'base64');
  assert.equal((await ctx.request.patch(url('/cover')).set(auth(admin)).attach('image', gif, 'x.jpg')).status, 400, 'gif not allowed');
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.equal((await ctx.request.patch(url('/cover')).set(auth(admin)).attach('image', svg, { filename: 'x.png', contentType: 'image/png' })).status, 400);
  // truncated-but-signature-valid jpeg
  const trunc = (await jpeg()).subarray(0, 40);
  assert.equal((await ctx.request.patch(url('/cover')).set(auth(admin)).attach('image', trunc, 'x.jpg')).status, 400);
  assert.equal(fileCount(), base, 'nothing stored');
});

test('50MB image rejected clearly (413), missing file -> 400, wrong field -> 400', async () => {
  await freshRestaurant('Big Cafe');
  const big = Buffer.alloc(50 * 1024 * 1024, 7);
  const res = await ctx.request.patch(url('/cover')).set(auth(admin)).attach('image', big, 'huge.jpg');
  assert.equal(res.status, 413);
  assert.match(res.body.message, /too large.*5MB/i);
  assert.equal(res.body.success, false);
  assert.equal((await ctx.request.patch(url('/cover')).set(auth(admin)).send({})).status, 400);
  const wrong = await ctx.request.patch(url('/cover')).set(auth(admin)).attach('photo', await jpeg(), 'a.jpg');
  assert.equal(wrong.status, 400);
  // a just-under-limit valid image still works
  const ok = await ctx.request.patch(url('/cover')).set(auth(admin)).attach('image', await jpeg(3000, 2000), 'a.jpg');
  assert.equal(ok.status, 200);
});

test('upload requires admin before the body is processed', async () => {
  await freshRestaurant('Auth Cafe');
  assert.equal((await ctx.request.patch(url('/cover')).attach('image', await jpeg(), 'a.jpg')).status, 401);
  const user = await ctx.makeUser();
  assert.equal((await ctx.request.post(url('/gallery')).set(auth(user.token)).attach('images', await jpeg(), 'a.jpg')).status, 403);
});

test('gallery: max 10 total (sequential + single request), 15 at once blocked, reorder, delete, files cleaned', async () => {
  await freshRestaurant('Gallery Cafe');
  const base = fileCount();
  const img = await jpeg();
  const add = (n) => {
    const r = ctx.request.post(url('/gallery')).set(auth(admin));
    for (let i = 0; i < n; i++) r.attach('images', img, `p${i}.jpg`);
    return r;
  };
  const fifteen = await add(15);
  assert.equal(fifteen.status, 400, 'too many files in one request');
  assert.equal(fileCount(), base);
  const first = await add(6);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal(first.body.data.length, 6);
  const over = await add(5);
  assert.equal(over.status, 400);
  assert.match(over.body.message, /limit is 10/);
  assert.equal(fileCount(), base + 6, 'rejected batch stored nothing');
  assert.equal((await add(4)).status, 201);
  const eleventh = await add(1);
  assert.equal(eleventh.status, 400);
  const doc = (await ctx.request.get(url())).body.data;
  assert.equal(doc.gallery.length, 10);

  // concurrent uploads cannot exceed the cap
  await ctx.request.delete(url(`/gallery/${doc.gallery[0]._id}`)).set(auth(admin));
  await ctx.request.delete(url(`/gallery/${doc.gallery[1]._id}`)).set(auth(admin));
  const racers = await Promise.all([add(2), add(2), add(2)]);
  assert.equal(racers.filter((r) => r.status === 201).length, 1);
  assert.equal((await ctx.request.get(url())).body.data.gallery.length, 10);
  assert.equal(fileCount(), base + 10, 'rolled-back uploads removed from disk');

  // reorder
  const g = (await ctx.request.get(url())).body.data.gallery;
  const reversed = g.map((x) => x._id).reverse();
  const re = await ctx.request.patch(url('/gallery/reorder')).set(auth(admin)).send({ order: reversed });
  assert.equal(re.status, 200);
  assert.deepEqual(re.body.data.map((x) => x._id), reversed);
  assert.equal((await ctx.request.patch(url('/gallery/reorder')).set(auth(admin)).send({ order: reversed.slice(1) })).status, 400);
  assert.equal((await ctx.request.patch(url('/gallery/reorder')).set(auth(admin)).send({ order: [...reversed.slice(1), reversed[1]] })).status, 400);

  // delete one image removes the file
  const victim = g[3];
  assert.ok(onDisk(victim.publicId));
  assert.equal((await ctx.request.delete(url(`/gallery/${victim._id}`)).set(auth(admin))).status, 200);
  assert.ok(!onDisk(victim.publicId));
  assert.equal((await ctx.request.delete(url(`/gallery/${victim._id}`)).set(auth(admin))).status, 404);
});

test('deleting a restaurant removes its cover and gallery files from disk', async () => {
  await freshRestaurant('Doomed Cafe');
  const before = fileCount();
  await ctx.request.patch(url('/cover')).set(auth(admin)).attach('image', await jpeg(), 'c.jpg');
  await ctx.request.post(url('/gallery')).set(auth(admin)).attach('images', await jpeg(), 'a.jpg').attach('images', await png(), 'b.png');
  const doc = (await ctx.request.get(url())).body.data;
  const ids = [doc.coverImage.publicId, ...doc.gallery.map((x) => x.publicId)];
  assert.equal(ids.length, 3);
  assert.ok(ids.every(onDisk));
  assert.equal(fileCount(), before + 3);
  assert.equal((await ctx.request.delete(url()).set(auth(admin))).status, 200);
  assert.ok(ids.every((id) => !onDisk(id)), 'files removed');
  assert.equal(fileCount(), before);
  assert.equal((await ctx.request.get(url())).status, 404);
});
