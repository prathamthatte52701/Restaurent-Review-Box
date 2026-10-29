import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env, fatal } from './env.js';
import '../models/index.js';

const opts = { serverSelectionTimeoutMS: 2500 };
const uriFile = path.join(env.memoryDbDir, 'uri.txt');
let memoryServer = null;

const firstLine = (e) => String(e?.message || e).split('\n')[0];

async function tryConnect(uri) {
  try {
    await mongoose.connect(uri, opts);
    return true;
  } catch {
    await mongoose.disconnect().catch(() => {});
    return false;
  }
}

async function startMemoryServer() {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const dbPath = path.join(env.memoryDbDir, 'data');
  fs.mkdirSync(dbPath, { recursive: true });
  memoryServer = await MongoMemoryServer.create({ instance: { dbPath, storageEngine: 'wiredTiger' } });
  const uri = memoryServer.getUri('rrb_dev');
  fs.writeFileSync(uriFile, uri);
  await mongoose.connect(uri, opts);
  console.warn(`[db] MONGO_URI unreachable -> started IN-MEMORY MongoDB (persisted in ${env.memoryDbDir}). Dev only.`);
}

/**
 * Connect to MongoDB.
 * production: MONGO_URI required, failure -> one-line error + exit(1).
 * otherwise : MONGO_URI -> shared memory-db from another local process -> start own memory-db.
 */
export async function connectDB() {
  mongoose.set('strictQuery', true);
  if (env.isProd) {
    if (!env.mongoUri) fatal('MONGO_URI is not set (required in production).');
    if (!(await tryConnect(env.mongoUri))) fatal('Cannot connect to MongoDB using MONGO_URI (server unreachable).');
  } else {
    let ok = env.mongoUri ? await tryConnect(env.mongoUri) : false;
    if (ok) console.log('[db] connected to MONGO_URI');
    if (!ok && env.isTest) fatal('Test MongoDB is unreachable.');
    if (!ok && fs.existsSync(uriFile)) {
      ok = await tryConnect(fs.readFileSync(uriFile, 'utf8').trim());
      if (ok) console.log('[db] connected to the running in-memory MongoDB of another local process');
    }
    if (!ok) {
      try {
        await startMemoryServer();
      } catch (err) {
        fatal(`No MongoDB available and in-memory fallback failed: ${firstLine(err)}`);
      }
    }
  }
  await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // make sure unique indexes exist
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect().catch(() => {});
  if (memoryServer) {
    await memoryServer.stop({ doCleanup: false }).catch(() => {});
    fs.rmSync(uriFile, { force: true });
    memoryServer = null;
  }
}
