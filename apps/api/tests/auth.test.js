import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { boot, auth, allKeys, VALID_USER } from './helpers.js';

let ctx;
const A = '/api/v1/auth';
before(async () => { ctx = await boot(); });
after(() => ctx.close());
beforeEach(() => ctx.reset());

const FORBIDDEN_KEYS = /^(password|otp|codeHash|passwordResetTokenHash|passwordResetExpires|hash)$/i;
const assertNoLeak = (body) => {
  const bad = [...allKeys(body)].filter((k) => FORBIDDEN_KEYS.test(k));
  assert.deepEqual(bad, [], `sensitive keys leaked: ${bad}`);
};

test('register -> 201, not logged in, OTP emailed, no leaks', async () => {
  const res = await ctx.request.post(`${A}/register`).send(VALID_USER);
  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.token, undefined);
  assert.match(ctx.otpFor(VALID_USER.email), /^\d{6}$/);
  assertNoLeak(res.body);
  const u = await ctx.models.User.findOne({ email: VALID_USER.email }).select('+password +otp.codeHash').lean();
  assert.notEqual(u.password, VALID_USER.password);
  assert.ok(u.password.startsWith('$2'));
  assert.ok(u.otp.codeHash && !u.otp.codeHash.includes(ctx.otpFor(VALID_USER.email)));
  assert.equal(u.role, 'user');
});

test('register ignores client-supplied role', async () => {
  await ctx.request.post(`${A}/register`).send({ ...VALID_USER, role: 'admin' });
  assert.equal((await ctx.models.User.findOne({ email: VALID_USER.email })).role, 'user');
});

test('validation: short password, bad email -> 400 with field errors', async () => {
  const res = await ctx.request.post(`${A}/register`).send({ ...VALID_USER, password: 'short', email: 'nope' });
  assert.equal(res.status, 400);
  assert.ok(res.body.errors.password);
  assert.ok(res.body.errors.email);
});

test('duplicate email / username -> clean 409 with field errors', async () => {
  await ctx.makeUser();
  const e = await ctx.request.post(`${A}/register`).send({ ...VALID_USER, username: 'other' });
  assert.equal(e.status, 409);
  assert.ok(e.body.errors.email);
  const u = await ctx.request.post(`${A}/register`).send({ ...VALID_USER, email: 'other@example.com' });
  assert.equal(u.status, 409);
  assert.ok(u.body.errors.username);
  const both = await ctx.request.post(`${A}/register`).send({ ...VALID_USER, email: 'TEST@example.com' });
  assert.equal(both.status, 409, 'email is case-insensitive');
});

test('6 parallel registers -> exactly one account', async () => {
  const results = await Promise.all(Array.from({ length: 6 }, () => ctx.request.post(`${A}/register`).send(VALID_USER)));
  const codes = results.map((r) => r.status).sort();
  assert.deepEqual(codes, [201, 409, 409, 409, 409, 409]);
  assert.equal(await ctx.models.User.countDocuments({ email: VALID_USER.email }), 1);
});

test('verify-otp success returns token+user; OTP cannot be reused', async () => {
  await ctx.request.post(`${A}/register`).send(VALID_USER);
  const otp = ctx.otpFor(VALID_USER.email);
  const ok = await ctx.request.post(`${A}/verify-otp`).send({ email: VALID_USER.email, otp });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.data.token);
  assert.equal(ok.body.data.user.isEmailVerified, true);
  assertNoLeak(ok.body);
  const again = await ctx.request.post(`${A}/verify-otp`).send({ email: VALID_USER.email, otp });
  assert.equal(again.status, 400);
});

test('wrong OTP 6x -> locked, even the correct code is refused, resend restores', async () => {
  await ctx.request.post(`${A}/register`).send(VALID_USER);
  const good = ctx.otpFor(VALID_USER.email);
  const bad = good === '000000' ? '111111' : '000000';
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await ctx.request.post(`${A}/verify-otp`).send({ email: VALID_USER.email, otp: bad })).status);
  assert.deepEqual(statuses, [400, 400, 400, 400, 400, 400]);
  const locked = await ctx.request.post(`${A}/verify-otp`).send({ email: VALID_USER.email, otp: good });
  assert.equal(locked.status, 400);
  assert.equal((await ctx.models.User.findOne({ email: VALID_USER.email })).isEmailVerified, false);
  await ctx.request.post(`${A}/resend-otp`).send({ email: VALID_USER.email });
  const fresh = ctx.otpFor(VALID_USER.email);
  const ok = await ctx.request.post(`${A}/verify-otp`).send({ email: VALID_USER.email, otp: fresh });
  assert.equal(ok.status, 200);
});

test('expired OTP is rejected with clear message', async () => {
  await ctx.request.post(`${A}/register`).send(VALID_USER);
  await ctx.models.User.updateOne({ email: VALID_USER.email }, { 'otp.expiresAt': new Date(Date.now() - 1000) });
  const res = await ctx.request.post(`${A}/verify-otp`).send({ email: VALID_USER.email, otp: ctx.otpFor(VALID_USER.email) });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /expired/i);
});

test('resend-otp gives same answer for unknown email', async () => {
  const a = await ctx.request.post(`${A}/resend-otp`).send({ email: 'ghost@example.com' });
  await ctx.request.post(`${A}/register`).send(VALID_USER);
  const b = await ctx.request.post(`${A}/resend-otp`).send({ email: VALID_USER.email });
  assert.equal(a.status, 200);
  assert.deepEqual(a.body, b.body);
});

test('login: unverified -> 403 requiresVerification', async () => {
  await ctx.request.post(`${A}/register`).send(VALID_USER);
  const res = await ctx.request.post(`${A}/login`).send({ email: VALID_USER.email, password: VALID_USER.password });
  assert.equal(res.status, 403);
  assert.equal(res.body.errors.requiresVerification, true);
  assert.match(res.body.message, /verify/i);
});

test('login by email or username; wrong password and unknown user give identical errors', async () => {
  await ctx.makeUser();
  const byEmail = await ctx.request.post(`${A}/login`).send({ email: VALID_USER.email, password: VALID_USER.password });
  const byUser = await ctx.request.post(`${A}/login`).send({ username: VALID_USER.username, password: VALID_USER.password });
  const byIdent = await ctx.request.post(`${A}/login`).send({ identifier: 'TESTUSER', password: VALID_USER.password });
  assert.equal(byEmail.status, 200);
  assert.equal(byUser.status, 200);
  assert.equal(byIdent.status, 200);
  assertNoLeak(byEmail.body);
  const wrong = await ctx.request.post(`${A}/login`).send({ email: VALID_USER.email, password: 'Wrong-pass1' });
  const ghost = await ctx.request.post(`${A}/login`).send({ email: 'ghost@example.com', password: 'Wrong-pass1' });
  assert.equal(wrong.status, 401);
  assert.equal(ghost.status, 401);
  assert.deepEqual(wrong.body, ghost.body);
});

test('isActive:false user cannot log in ("account disabled") and old tokens die', async () => {
  const u = await ctx.makeUser();
  await ctx.models.User.updateOne({ email: u.email }, { isActive: false });
  const res = await ctx.request.post(`${A}/login`).send({ email: u.email, password: u.password });
  assert.equal(res.status, 403);
  assert.match(res.body.message, /disabled/i);
  assert.equal((await ctx.request.get(`${A}/me`).set(auth(u.token))).status, 401);
});

test('NoSQL injection in login is blocked', async () => {
  await ctx.makeUser();
  const a = await ctx.request.post(`${A}/login`).send({ email: { $gt: '' }, password: 'whatever1' });
  assert.equal(a.status, 400);
  const b = await ctx.request.post(`${A}/login`).send({ email: VALID_USER.email, password: { $ne: null } });
  assert.equal(b.status, 400);
  const c = await ctx.request.post(`${A}/login`).send({ username: { $regex: '.*' }, password: 'x' });
  assert.equal(c.status, 400);
  const d = await ctx.request.post(`${A}/login`).send({ '$where': 'sleep(1)', email: VALID_USER.email, password: 'x' });
  assert.equal(d.status, 401, 'operator key stripped, request then fails normally');
});

test('protected route: garbage / expired / foreign-secret / deleted-user tokens -> 401', async () => {
  const u = await ctx.makeUser();
  const ok = await ctx.request.get(`${A}/me`).set(auth(u.token));
  assert.equal(ok.status, 200);
  assertNoLeak(ok.body);
  assert.equal(ok.body.data.user.email, u.email);

  const secret = process.env.JWT_SECRET;
  const cases = {
    none: undefined,
    garbage: 'Bearer not.a.jwt',
    emptyBearer: 'Bearer ',
    expired: `Bearer ${jwt.sign({ sub: u.id, role: 'user' }, secret, { expiresIn: -10 })}`,
    otherSecret: `Bearer ${jwt.sign({ sub: u.id, role: 'user' }, 'another-secret', { expiresIn: '1h' })}`,
    algNone: `Bearer ${jwt.sign({ sub: u.id }, '', { algorithm: 'none' })}`,
    ghostUser: `Bearer ${jwt.sign({ sub: '64b64b64b64b64b64b64b64b', role: 'admin' }, secret, { expiresIn: '1h' })}`,
    badSub: `Bearer ${jwt.sign({ sub: { $ne: 1 }, role: 'admin' }, secret, { expiresIn: '1h' })}`,
  };
  for (const [name, header] of Object.entries(cases)) {
    const r = ctx.request.get(`${A}/me`);
    if (header !== undefined) r.set('Authorization', header);
    const res = await r;
    assert.equal(res.status, 401, name);
    assert.equal(res.body.success, false, name);
  }
});

test("another user's token yields only that user's data; role claim in token is not trusted", async () => {
  const a = await ctx.makeUser();
  const b = await ctx.makeUser({ username: 'second', email: 'second@example.com' });
  const me = await ctx.request.get(`${A}/me`).set(auth(b.token));
  assert.equal(me.body.data.user.email, 'second@example.com');
  assert.notEqual(me.body.data.user._id, a.id);
  const jti = (await ctx.models.User.findById(a.id)).sessions[0].jti;
  const forged = jwt.sign({ sub: a.id, role: 'admin', jti, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const res = await ctx.request.get(`${A}/me`).set(auth(forged));
  assert.equal(res.body.data.user.role, 'user');
});

test('forgot-password: same response regardless of existence; reset link is single use', async () => {
  const u = await ctx.makeUser();
  const known = await ctx.request.post(`${A}/forgot-password`).send({ email: u.email });
  const unknown = await ctx.request.post(`${A}/forgot-password`).send({ email: 'ghost@example.com' });
  assert.equal(known.status, 200);
  assert.deepEqual(known.body, unknown.body);
  assert.equal(ctx.outbox.filter((m) => m.to === 'ghost@example.com').length, 0);
  const token = ctx.resetTokenFor(u.email);
  assert.ok(token);
  assert.match(ctx.outbox.at(-1).text, /localhost:5173\/reset-password\?token=.*&email=/);

  const body = { email: u.email, token, newPassword: 'Brand-new-pass1' };
  const first = await ctx.request.post(`${A}/reset-password`).send(body);
  assert.equal(first.status, 200);
  const reuse = await ctx.request.post(`${A}/reset-password`).send({ ...body, newPassword: 'Another-pass22' });
  assert.equal(reuse.status, 400);
  assert.equal((await ctx.request.post(`${A}/login`).send({ email: u.email, password: 'Brand-new-pass1' })).status, 200);
  assert.equal((await ctx.request.post(`${A}/login`).send({ email: u.email, password: u.password })).status, 401);
});

test('reset token: parallel use succeeds once; wrong email/token rejected; expired has clear message', async () => {
  const u = await ctx.makeUser();
  await ctx.request.post(`${A}/forgot-password`).send({ email: u.email });
  const token = ctx.resetTokenFor(u.email);
  const rs = await Promise.all([1, 2, 3].map((i) => ctx.request.post(`${A}/reset-password`).send({ email: u.email, token, newPassword: `Parallel-pass${i}` })));
  assert.equal(rs.filter((r) => r.status === 200).length, 1);

  await ctx.request.post(`${A}/forgot-password`).send({ email: u.email });
  const t2 = ctx.resetTokenFor(u.email);
  const wrongEmail = await ctx.request.post(`${A}/reset-password`).send({ email: 'x@example.com', token: t2, newPassword: 'Whatever-pass1' });
  assert.equal(wrongEmail.status, 400);
  const wrongTok = await ctx.request.post(`${A}/reset-password`).send({ email: u.email, token: 'a'.repeat(64), newPassword: 'Whatever-pass1' });
  assert.equal(wrongTok.status, 400);

  await ctx.models.User.updateOne({ email: u.email }, { passwordResetExpires: new Date(Date.now() - 1000) });
  const expired = await ctx.request.post(`${A}/reset-password`).send({ email: u.email, token: t2, newPassword: 'Whatever-pass1' });
  assert.equal(expired.status, 400);
  assert.match(expired.body.message, /expired/i);
});

test('change-password requires auth and the current password', async () => {
  const u = await ctx.makeUser();
  const bad = await ctx.request.post(`${A}/change-password`).set(auth(u.token)).send({ currentPassword: 'nope-nope-1', newPassword: 'Newer-pass-12' });
  assert.equal(bad.status, 400);
  const noAuth = await ctx.request.post(`${A}/change-password`).send({ currentPassword: u.password, newPassword: 'Newer-pass-12' });
  assert.equal(noAuth.status, 401);
  const ok = await ctx.request.post(`${A}/change-password`).set(auth(u.token)).send({ currentPassword: u.password, newPassword: 'Newer-pass-12' });
  assert.equal(ok.status, 200);
  assert.equal((await ctx.request.post(`${A}/login`).send({ email: u.email, password: 'Newer-pass-12' })).status, 200);
  assertNoLeak(ok.body);
});

test('check-username + logout', async () => {
  await ctx.makeUser();
  const taken = await ctx.request.get(`${A}/check-username`).query({ username: 'TestUser' });
  assert.equal(taken.body.data.available, false);
  const free = await ctx.request.get(`${A}/check-username`).query({ username: 'freename' });
  assert.equal(free.body.data.available, true);
  assert.equal((await ctx.request.get(`${A}/check-username`)).status, 400);
  assert.equal((await ctx.request.post(`${A}/logout`)).status, 200);
});

test('login timing: existing vs non-existing email within 3x', async () => {
  const u = await ctx.makeUser();
  const time = async (email) => {
    const xs = [];
    for (let i = 0; i < 7; i++) {
      const t = process.hrtime.bigint();
      await ctx.request.post(`${A}/login`).send({ email, password: 'Wrong-pass99' });
      xs.push(Number(process.hrtime.bigint() - t) / 1e6);
    }
    return xs.sort((a, b) => a - b)[3];
  };
  await time(u.email); // warm-up
  const existing = await time(u.email);
  const missing = await time('ghost@example.com');
  const ratio = Math.max(existing, missing) / Math.min(existing, missing);
  console.log(`  login timing median existing=${existing.toFixed(1)}ms missing=${missing.toFixed(1)}ms ratio=${ratio.toFixed(2)}`);
  assert.ok(ratio < 3, `ratio ${ratio}`);
});
