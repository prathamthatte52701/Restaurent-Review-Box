// Test bootstrap: env first, then in-memory Mongo, then dynamic import of the app (env.js reads process.env at import time).
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import supertest from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
process.env.RATE_LIMIT_DISABLED ??= 'true';
process.env.BCRYPT_ROUNDS = '4';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.ADMIN_URL = 'http://localhost:5174';
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rrb-uploads-'));
process.env.UPLOADS_DIR = uploadsDir;

export const VALID_USER = { fullName: 'Test User', username: 'testuser', email: 'test@example.com', password: 'Passw0rd!x' };
export const ADMIN = { email: 'admin@test.local', password: 'Admin@12345' };

export async function boot(extra) {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri('rrb_test');
  const { connectDB, disconnectDB } = await import('../src/config/db.js');
  await connectDB();
  const { createApp } = await import('../src/app.js');
  const app = createApp(extra);
  const models = await import('../src/models/index.js');
  const { outbox } = await import('../src/services/mail.js');
  const mongoose = (await import('mongoose')).default;
  const request = supertest(app);
  const ctx = {
    app, request, outbox, models, mongoose, uploadsDir,
    async close() {
      await disconnectDB();
      await mongod.stop();
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    },
    async reset() {
      await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
      outbox.length = 0;
    },
    otpFor(email) {
      const m = [...outbox].reverse().find((x) => x.to === email && /verification code/i.test(x.subject));
      return m?.text.match(/code is (\d{6})/)?.[1];
    },
    resetTokenFor(email) {
      const m = [...outbox].reverse().find((x) => x.to === email && /reset/i.test(x.subject));
      return m?.text.match(/token=([a-f0-9]{64})/)?.[1];
    },
    /** register + verify via real endpoints -> {token,user,...creds} */
    async makeUser(over = {}) {
      const body = { ...VALID_USER, ...over };
      const reg = await request.post('/api/v1/auth/register').send(body);
      if (reg.status !== 201) throw new Error(`register failed ${reg.status} ${JSON.stringify(reg.body)}`);
      const ver = await request.post('/api/v1/auth/verify-otp').send({ email: body.email, otp: ctx.otpFor(body.email) });
      if (ver.status !== 200) throw new Error(`verify failed ${JSON.stringify(ver.body)}`);
      return { ...body, token: ver.body.data.token, id: ver.body.data.user._id };
    },
    async makeAdmin() {
      const { User } = models;
      await User.deleteOne({ email: ADMIN.email });
      await User.create({ fullName: 'Admin', username: 'adminuser', email: ADMIN.email, password: ADMIN.password, role: 'admin', isEmailVerified: true });
      const res = await request.post('/api/v1/auth/login').send(ADMIN);
      return res.body.data.token;
    },
  };
  return ctx;
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });

/** Collect every key name in a JSON value. */
export function allKeys(v, out = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => allKeys(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); allKeys(x, out); }
  return out;
}
