// Creates/syncs every schema index (incl. new ones) on the connected DB (Atlas via MONGO_URI). `npm run indexes -w @rrb/api`
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';

await connectDB();
for (const m of Object.values(mongoose.models)) {
  const dropped = await m.syncIndexes();
  console.log(`${m.modelName}: ${(await m.collection.indexes()).length} indexes${dropped.length ? `, dropped stale: ${dropped.join(', ')}` : ''}`);
}
await disconnectDB();
