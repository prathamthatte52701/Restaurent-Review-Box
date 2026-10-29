import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, auth, allKeys } from './helpers.js';
import { makeMasters, restaurantBody } from './fixtures.js';

let ctx, admin;
before(async () => {
  ctx = await boot();
  admin = await ctx.makeAdmin();
});
after(() => ctx.close());

test('GET /admin/stats returns counts, recent lists, 12-month series, no sensitive fields', async () => {
  const m = await makeMasters(ctx, admin);
  for (let i = 0; i < 7; i++) {
    await ctx.request.post('/api/v1/restaurants').set(auth(admin)).send(restaurantBody(m, { name: `Stat ${i}`, isFeatured: i < 2, isActive: i !== 6 }));
  }
  await ctx.makeUser();
  const res = await ctx.request.get('/api/v1/admin/stats').set(auth(admin));
  assert.equal(res.status, 200);
  const d = res.body.data;
  assert.deepEqual(d.counts, { restaurants: 7, activeRestaurants: 6, featuredRestaurants: 2, users: 2, cities: 1, cuisines: 2, amenities: 1 });
  assert.equal(d.recentRestaurants.length, 5);
  assert.equal(d.recentRestaurants[0].name, 'Stat 6', 'newest first');
  assert.equal(d.recentUsers.length, 2);
  assert.equal(d.restaurantsPerMonth.length, 12);
  const now = new Date();
  const key = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  assert.deepEqual(d.restaurantsPerMonth.at(-1), { month: key, count: 7 });
  assert.equal(d.restaurantsPerMonth.slice(0, 11).every((x) => x.count === 0 && /^\d{4}-\d{2}$/.test(x.month)), true);
  const bad = [...allKeys(res.body)].filter((k) => /^(password|otp|codeHash|passwordResetTokenHash|passwordResetExpires)$/i.test(k));
  assert.deepEqual(bad, []);
});
