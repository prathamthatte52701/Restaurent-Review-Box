import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boot } from './helpers.js';

const API = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ctx;
before(async () => {
  ctx = await boot((app) => {
    app.get('/boom', () => { throw new Error('kaboom'); });
    app.get('/boom-async', async () => { throw new Error('async kaboom'); });
  });
});
after(() => ctx.close());

test('GET /health returns standard shape with db state', async () => {
  const res = await ctx.request.get('/api/v1/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.status, 'ok');
  assert.equal(res.body.data.db.state, 'connected');
  assert.ok(res.body.data.db.name);
  assert.equal(typeof res.body.data.uptime, 'number');
  assert.equal(res.body.data.env, 'test');
});

test('unknown route -> JSON 404', async () => {
  const res = await ctx.request.get('/api/v1/nope');
  assert.equal(res.status, 404);
  assert.match(res.headers['content-type'], /json/);
  assert.equal(res.body.success, false);
});

test('thrown (sync + async) error -> standard error shape', async () => {
  for (const p of ['/boom', '/boom-async']) {
    const res = await ctx.request.get(p);
    assert.equal(res.status, 500);
    assert.equal(res.body.success, false);
    assert.equal(typeof res.body.message, 'string');
  }
});

test('malformed JSON -> 400 JSON', async () => {
  const res = await ctx.request.post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email": ');
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /json/i);
});

test('CORS allows only CLIENT_URL / ADMIN_URL', async () => {
  const ok = await ctx.request.get('/api/v1/health').set('Origin', 'http://localhost:5173');
  assert.equal(ok.headers['access-control-allow-origin'], 'http://localhost:5173');
  const admin = await ctx.request.get('/api/v1/health').set('Origin', 'http://localhost:5174');
  assert.equal(admin.headers['access-control-allow-origin'], 'http://localhost:5174');
  const bad = await ctx.request.get('/api/v1/health').set('Origin', 'http://evil.example');
  assert.equal(bad.headers['access-control-allow-origin'], undefined);
});

test('NODE_ENV=production: error response has no stack and no internal message', () => {
  const r = spawnSync(process.execPath, [path.join(API, 'tests/fixtures/prod-error.mjs')], {
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40) },
    encoding: 'utf8',
  });
  const out = JSON.parse(r.stdout.trim().split('\n').pop());
  assert.equal(out.status, 500);
  assert.equal(out.body.stack, undefined);
  assert.ok(!JSON.stringify(out.body).includes('secret internal detail'));
  assert.equal(out.body.success, false);
});

test('production with missing MONGO_URI exits(1) with one clear line', () => {
  const r = spawnSync(process.execPath, [path.join(API, 'src/server.js')], {
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), MONGO_URI: '' },
    encoding: 'utf8',
    timeout: 20000,
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /MONGO_URI is not set/);
  assert.equal(r.stderr.trim().split('\n').length, 1, `expected one line, got: ${r.stderr}`);
});

test('production with unreachable DB exits(1) quickly, no stack dump', () => {
  const t = Date.now();
  const r = spawnSync(process.execPath, [path.join(API, 'src/server.js')], {
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), MONGO_URI: 'mongodb://127.0.0.1:1/none' },
    encoding: 'utf8',
    timeout: 20000,
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Cannot connect to MongoDB/);
  assert.equal(r.stderr.trim().split('\n').length, 1);
  assert.ok(Date.now() - t < 15000);
});
