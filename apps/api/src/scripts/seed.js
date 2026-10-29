// Usage: npm run seed -- --file=./data/restaurants.sample.json [--dry-run] [--no-auto-create]
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, fatal } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { importRestaurants } from '../services/restaurantImport.js';
import { User } from '../models/index.js';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);

const fileArg = opt('file');
if (!fileArg) fatal('Missing --file=<path>. Example: npm run seed -- --file=./data/restaurants.sample.json [--dry-run]');

// npm workspaces run with cwd = apps/api, so try the invoking dir, cwd and the repo root.
const candidates = [...new Set([process.env.INIT_CWD, process.cwd(), REPO_ROOT].filter(Boolean).map((b) => path.resolve(b, fileArg)))];
const file = candidates.find((p) => fs.existsSync(p));
if (!file) fatal(`File not found. Tried:\n  ${candidates.join('\n  ')}`);

let rows;
try {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  rows = Array.isArray(json) ? json : json.rows;
  if (!Array.isArray(rows)) throw new Error('expected a JSON array (or {"rows":[...]})');
} catch (e) {
  fatal(`Cannot read ${file}: ${e.message}`);
}

const dryRun = flag('dry-run');
await connectDB();
const admin = await User.findOne({ role: 'admin' }, '_id').lean();
console.log(`Importing ${rows.length} row(s) from ${file}${dryRun ? ' [DRY RUN - nothing will be written]' : ''}`);

const t0 = Date.now();
const { totals, results } = await importRestaurants(rows, { dryRun, autoCreate: !flag('no-auto-create'), createdBy: admin?._id });
for (const r of results) console.log(`  #${r.index} ${String(r.name).padEnd(34)} ${r.status.toUpperCase().padEnd(8)} ${r.reason || ''}${r.id ? ` (${r.id})` : ''}`);
console.log(`\nTotals: ${totals.total} rows -> ${totals.created} created, ${totals.updated} updated, ${totals.skipped} skipped in ${Date.now() - t0}ms${dryRun ? ' (dry run)' : ''}`);

await disconnectDB();
process.exit(0);
