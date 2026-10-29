process.env.RATE_LIMIT_DISABLED = 'false';
const { test, before, after } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const { boot, auth } = await import('./helpers.js');

let ctx;
before(async () => { ctx = await boot(); });
after(() => ctx.close());

test('resolve-map-link is rate limited (30 per 10 min) with the standard 429 shape', async () => {
  const token = await ctx.makeAdmin();
  const s = [];
  for (let i = 0; i < 32; i++) s.push((await ctx.request.post('/api/v1/utils/resolve-map-link').set(auth(token)).send({ url: 'https://example.com' })).status);
  assert.equal(s.filter((x) => x === 400).length, 30);
  assert.deepEqual(s.slice(30), [429, 429]);
});
