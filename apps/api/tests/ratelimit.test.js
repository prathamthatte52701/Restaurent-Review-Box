process.env.RATE_LIMIT_DISABLED = 'false';
const { test, before, after } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const { boot } = await import('./helpers.js');

let ctx;
before(async () => { ctx = await boot(); });
after(() => ctx.close());

test('rate limiter fires on rapid logins (20/15min) and uses standard shape', async () => {
  const statuses = [];
  for (let i = 0; i < 24; i++) statuses.push((await ctx.request.post('/api/v1/auth/login').send({ email: 'a@b.co', password: 'Wrong-pass1' })).status);
  assert.equal(statuses.filter((s) => s === 401).length, 20);
  assert.ok(statuses.slice(20).every((s) => s === 429), statuses.join());
  const res = await ctx.request.post('/api/v1/auth/login').send({ email: 'a@b.co', password: 'x' });
  assert.equal(res.status, 429);
  assert.equal(res.body.success, false);
  assert.ok(res.headers['ratelimit-limit'] || res.headers['ratelimit']);
});

test('resend-otp limited to 3 per 10 minutes', async () => {
  const s = [];
  for (let i = 0; i < 5; i++) s.push((await ctx.request.post('/api/v1/auth/resend-otp').send({ email: 'a@b.co' })).status);
  assert.deepEqual(s, [200, 200, 200, 429, 429]);
});

test('forgot-password limited to 5 per hour', async () => {
  const s = [];
  for (let i = 0; i < 6; i++) s.push((await ctx.request.post('/api/v1/auth/forgot-password').send({ email: 'a@b.co' })).status);
  assert.deepEqual(s, [200, 200, 200, 200, 200, 429]);
});
