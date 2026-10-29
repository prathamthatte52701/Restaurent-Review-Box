import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { seedAdmin } from '../services/adminSeed.js';

await connectDB();
const res = await seedAdmin({ force: true });
const msg = {
  created: `Admin created: ${env.adminEmail}`,
  exists: 'An account with that email (or an admin) already exists - nothing changed.',
  skipped: 'Set ADMIN_EMAIL and ADMIN_PASSWORD in apps/api/.env first.',
};
console.log(msg[res]);
await disconnectDB();
process.exit(res === 'skipped' ? 1 : 0);
