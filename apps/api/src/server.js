import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { ensureDevAdmin } from './services/adminSeed.js';
import { storage } from './services/storage/index.js';
import app from './app.js';

await connectDB();
await ensureDevAdmin();
console.log(`[storage] driver: ${storage.name}`);

const server = app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
server.on('error', (err) => {
  console.error(`FATAL: cannot listen on port ${env.port}: ${err.message}`);
  disconnectDB().finally(() => process.exit(1));
});

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`[api] ${signal} received, shutting down...`);
  setTimeout(() => process.exit(1), 10000).unref();
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
  server.closeIdleConnections?.();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
