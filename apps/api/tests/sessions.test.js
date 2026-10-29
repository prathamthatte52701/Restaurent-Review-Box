import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { boot, auth, allKeys, ADMIN } from './helpers.js';

let ctx;
const A = '/api/v1/auth';
before(async () => { ctx = await boot(); });
after(() => ctx.close());
beforeEach(() => ctx.reset());

const login = (u, ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36') =>
  ctx.request.post(`${A}/login`).set('User-Agent', ua).send({ email: u.email, password: u.password });
const me = (t) => ctx.request.get(`${A}/me`).set(auth(t));
const code = (res) => res.body.errors?.code;
const tokenOf = async (u) => (await login(u)).body.data.token;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('two devices: logout A kills A only; logout-all with B kills both', async () => {
  const u = await ctx.makeUser();
  const a = await tokenOf(u), b = await tokenOf(u);
  assert.equal((await me(a)).status, 200);
  assert.equal((await ctx.request.post(`${A}/logout`).set(auth(a))).status, 200);
  const dead = await me(a);
  assert.equal(dead.status, 401);
  assert.equal(code(dead), 'SESSION_REVOKED');
  assert.equal((await me(b)).status, 200);
  const c = await tokenOf(u);
  assert.equal((await ctx.request.post(`${A}/logout-all`).set(auth(b))).status, 200);
  for (const t of [b, c, u.token]) assert.equal(code(await me(t)), 'SESSION_REVOKED');
});

test('logout with a dead/missing token is still 200', async () => {
  assert.equal((await ctx.request.post(`${A}/logout`)).status, 200);
  assert.equal((await ctx.request.post(`${A}/logout`).set(auth('garbage'))).status, 200);
});

test('change password: all other sessions dead with PASSWORD_CHANGED, new token works', async () => {
  const u = await ctx.makeUser();
  const a = await tokenOf(u), b = await tokenOf(u);
  const r = await ctx.request.post(`${A}/change-password`).set(auth(a)).send({ currentPassword: u.password, newPassword: 'Newer-pass-12' });
  assert.equal(r.status, 200);
  for (const t of [a, b, u.token]) {
    const x = await me(t);
    assert.equal(x.status, 401);
    assert.equal(code(x), 'PASSWORD_CHANGED');
  }
  assert.equal((await me(r.body.data.token)).status, 200);
});

test('forgot/reset password: all sessions dead', async () => {
  const u = await ctx.makeUser();
  const a = await tokenOf(u), b = await tokenOf(u);
  await ctx.request.post(`${A}/forgot-password`).send({ email: u.email });
  const reset = await ctx.request.post(`${A}/reset-password`).send({ email: u.email, token: ctx.resetTokenFor(u.email), newPassword: 'Brand-new-pw-1' });
  assert.equal(reset.status, 200);
  for (const t of [a, b]) assert.equal(code(await me(t)), 'PASSWORD_CHANGED');
});

test('admin deactivation kills sessions immediately; reactivation does not revive them', async () => {
  const u = await ctx.makeUser();
  const a = await tokenOf(u), b = await tokenOf(u);
  const admin = await ctx.makeAdmin();
  const path = `/api/v1/admin/users/${u.id}/active`;
  assert.equal((await ctx.request.patch(path).set(auth(a)).send({ isActive: false })).status, 403);
  const off = await ctx.request.patch(path).set(auth(admin)).send({ isActive: false });
  assert.equal(off.status, 200);
  assert.equal(off.body.data.user.isActive, false);
  for (const t of [a, b]) assert.equal(code(await me(t)), 'ACCOUNT_DISABLED');
  assert.equal((await login(u)).status, 403);
  await ctx.request.patch(path).set(auth(admin)).send({ isActive: true });
  assert.equal(code(await me(a)), 'SESSION_REVOKED');
  assert.equal((await login(u)).status, 200);
  const adm = await ctx.models.User.findOne({ email: ADMIN.email });
  assert.equal((await ctx.request.patch(`/api/v1/admin/users/${adm._id}/active`).set(auth(admin)).send({ isActive: false })).status, 400);
  assert.equal((await ctx.request.patch(path).set(auth(admin)).send({ isActive: 'no' })).status, 400);
  assert.equal((await ctx.request.patch(`/api/v1/admin/users/${'a'.repeat(24)}/active`).set(auth(admin)).send({ isActive: false })).status, 404);
});

test('12 logins: only the 10 newest survive', async () => {
  const u = await ctx.makeUser(); // verify-otp issued session #1
  const tokens = [u.token];
  for (let i = 0; i < 11; i++) tokens.push(await tokenOf(u));
  assert.equal((await ctx.models.User.findById(u.id)).sessions.length, 10);
  for (const t of tokens.slice(0, 2)) assert.equal(code(await me(t)), 'SESSION_REVOKED');
  for (const t of tokens.slice(2)) assert.equal((await me(t)).status, 200);
});

test('valid-signature JWT with random jti, missing jti, wrong tokenVersion, expired', async () => {
  const u = await ctx.makeUser();
  const sign = (extra, opts = { expiresIn: '1h' }) => jwt.sign({ sub: u.id, role: 'user', tokenVersion: 0, ...extra }, process.env.JWT_SECRET, opts);
  assert.equal(code(await me(sign({ jti: crypto.randomUUID() }))), 'SESSION_REVOKED');
  assert.equal(code(await me(sign({}))), 'TOKEN_INVALID');
  const jti = (await ctx.models.User.findById(u.id)).sessions[0].jti;
  assert.equal(code(await me(sign({ jti, tokenVersion: 5 }))), 'PASSWORD_CHANGED');
  assert.equal((await me(sign({ jti }))).status, 200);
  assert.equal(code(await me(sign({ jti }, { expiresIn: -10 }))), 'TOKEN_EXPIRED');
});

test('revoked token rejected 10x in a row', async () => {
  const u = await ctx.makeUser();
  const a = await tokenOf(u);
  await ctx.request.post(`${A}/logout`).set(auth(a));
  for (let i = 0; i < 10; i++) assert.equal((await me(a)).status, 401);
});

test('protect makes exactly one DB command per request', async () => {
  const u = await ctx.makeUser();
  const cmds = [];
  ctx.mongoose.set('debug', (coll, method) => cmds.push(`${coll}.${method}`));
  assert.equal((await me(u.token)).status, 200);
  ctx.mongoose.set('debug', false);
  assert.deepEqual(cmds, ['users.findOne']);
});

test('lastUsedAt is throttled (written only when stale)', async () => {
  const u = await ctx.makeUser();
  const read = async () => (await ctx.models.User.findById(u.id)).sessions[0].lastUsedAt.getTime();
  const first = await read();
  await me(u.token);
  await sleep(100);
  assert.equal(await read(), first);
  const old = new Date(Date.now() - 10 * 60 * 1000);
  await ctx.models.User.updateOne({ _id: u.id }, { $set: { 'sessions.0.lastUsedAt': old } });
  await me(u.token);
  await sleep(100);
  assert.ok(await read() > old.getTime());
});

test('expired sessions are pruned at next login', async () => {
  const u = await ctx.makeUser();
  await ctx.models.User.updateOne({ _id: u.id }, { $set: { 'sessions.0.expiresAt': new Date(Date.now() - 1000) } });
  await login(u);
  assert.equal((await ctx.models.User.findById(u.id)).sessions.length, 1);
});

test('sessions list + delete; device parsed; raw jti never in any response', async () => {
  const u = await ctx.makeUser();
  const a = (await login(u, 'Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537')).body.data.token;
  const b = (await login(u, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17 Safari/604')).body.data.token;
  const list = await ctx.request.get(`${A}/sessions`).set(auth(b));
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 3);
  assert.equal(list.body.data.filter((s) => s.current).length, 1);
  assert.ok(list.body.data.some((s) => s.device === 'Chrome on Windows'));
  assert.ok(list.body.data.some((s) => s.device === 'Safari on iOS'));
  const jtis = (await ctx.models.User.findById(u.id)).sessions.map((s) => s.jti);
  const everything = [list.body, (await me(b)).body, (await login(u)).body, (await ctx.request.get(`${A}/sessions`).set(auth(a))).body];
  for (const body of everything) {
    const s = JSON.stringify(body);
    for (const j of jtis) assert.ok(!s.includes(j), 'raw jti leaked');
    const keys = [...allKeys(body)];
    assert.ok(!keys.includes('jti') && !keys.includes('sessions') && !keys.includes('tokenVersion'));
  }
  const other = list.body.data.find((s) => !s.current && s.device === 'Chrome on Windows');
  assert.equal((await ctx.request.delete(`${A}/sessions/${other.id}`).set(auth(b))).status, 200);
  assert.equal(code(await me(a)), 'SESSION_REVOKED');
  assert.equal((await ctx.request.delete(`${A}/sessions/${other.id}`).set(auth(b))).status, 404);
  assert.equal((await ctx.request.delete(`${A}/sessions/nope`).set(auth(b))).status, 400);
  assert.equal((await ctx.request.get(`${A}/sessions`)).status, 401);
  // another user's session cannot be touched
  const v = await ctx.makeUser({ email: 'v@example.com', username: 'victim' });
  const vs = (await ctx.request.get(`${A}/sessions`).set(auth(v.token))).body.data[0];
  assert.equal((await ctx.request.delete(`${A}/sessions/${vs.id}`).set(auth(b))).status, 404);
  assert.equal((await me(v.token)).status, 200);
});

test('revoke while requests from that session are in flight: no 500, later requests dead', async () => {
  const u = await ctx.makeUser();
  const a = await tokenOf(u), b = await tokenOf(u);
  const results = await Promise.all([
    ...Array.from({ length: 15 }, () => me(a)),
    ctx.request.post(`${A}/logout-all`).set(auth(b)),
    ...Array.from({ length: 15 }, () => me(a)),
  ]);
  for (const r of results) assert.ok([200, 401].includes(r.status), `status ${r.status}`);
  assert.equal(code(await me(a)), 'SESSION_REVOKED');
});

test('device parser fallbacks', async () => {
  const { parseDevice } = await import('../src/services/sessions.js');
  assert.equal(parseDevice(''), 'Unknown device');
  assert.equal(parseDevice('curl/8.0'), 'Unknown device');
  assert.equal(parseDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537 Edg/120'), 'Edge on Windows');
  assert.equal(parseDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X) Firefox/120'), 'Firefox on macOS');
  assert.equal(parseDevice('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari'), 'Chrome on Android');
});
