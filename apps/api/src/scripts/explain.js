// Seeds a throwaway IN-MEMORY MongoDB with synthetic data and prints explain('executionStats') for the discovery queries.
// Never touches Atlas. Usage: node src/scripts/explain.js [rows=5000]
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
const rows = Number(process.argv[2]) || 5000;
const mongod = await MongoMemoryServer.create();
await mongoose.connect(mongod.getUri('explain'));
const { City, Cuisine, Amenity, Restaurant } = await import('../models/index.js');
await Promise.all([City, Cuisine, Amenity, Restaurant].map((m) => m.init()));
const D = await import('../services/discovery.js');

const city = (await City.create([{ name: 'Indore', slug: 'indore' }, { name: 'Bhopal', slug: 'bhopal' }]));
const cuisines = await Cuisine.create(['North Indian', 'Chinese', 'Italian', 'Cafe', 'Street Food', 'Mughlai'].map((n) => ({ name: n, slug: n.toLowerCase().replace(/ /g, '-') })));
const amen = await Amenity.create(['Parking', 'WiFi', 'AC', 'Outdoor'].map((n) => ({ name: n, slug: n.toLowerCase() })));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const cats = ['restaurant', 'cafe', 'bakery', 'street-food', 'bar'];
const areas = ['Vijay Nagar', 'Sarafa', 'Palasia', 'Rajwada', 'Bhawarkuan', 'Annapurna', 'Saket', 'MG Road'];
const docs = Array.from({ length: rows }, (_, i) => {
  const price = 100 + Math.floor(Math.random() * 2500);
  return {
    name: `${pick(['Spice', 'Royal', 'Urban', 'Golden', 'Fresh', 'Pizza'])} ${pick(['Hub', 'Kitchen', 'Bistro', 'Dhaba', 'House'])} ${i}`, slug: `r-${i}`,
    description: 'tasty food place', address: { line1: 'x', area: pick(areas), city: pick(city)._id },
    location: { type: 'Point', coordinates: [75.78 + Math.random() * 0.15, 22.65 + Math.random() * 0.15] },
    type: pick(['veg', 'non-veg', 'both']), category: pick(cats), priceForTwo: price, costBracket: price < 300 ? 'budget' : price < 800 ? 'mid' : price < 2000 ? 'premium' : 'luxury',
    cuisines: [pick(cuisines)._id, pick(cuisines)._id], amenities: [pick(amen)._id], ratingAvg: Math.random() * 5, ratingCount: Math.floor(Math.random() * 200),
    isFeatured: Math.random() < 0.05, isActive: Math.random() < 0.95,
    timings: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => ({ day, openTime: '11:00', closeTime: '23:00' })),
  };
});
await Restaurant.insertMany(docs);

const captured = [];
const orig = Restaurant.aggregate;
Restaurant.aggregate = function (p) { captured.push(p); return orig.call(this, p); };
const origFind = Restaurant.find;
const finds = [];
Restaurant.find = function (...a) { const q = origFind.apply(this, a); finds.push(a[0]); return q; };

const lines = [];
const stages = (p, out = []) => {
  if (!p || typeof p !== 'object') return out;
  if (p.stage) out.push(`${p.stage}${p.indexName ? `(${p.indexName})` : ''}`);
  for (const v of Object.values(p)) if (v && typeof v === 'object') stages(v, out);
  return out;
};
async function run(label, fn) {
  captured.length = 0; finds.length = 0;
  await fn();
  for (const [i, p] of captured.entries()) {
    const ex = await orig.call(Restaurant, p).option({ allowDiskUse: true }).explain('executionStats');
    const first = ex.stages?.[0]?.$cursor ?? ex.stages?.[0]?.$geoNearCursor ?? ex;
    if (process.env.DEBUG_EXPLAIN) console.error(label, JSON.stringify(Object.keys(ex)), JSON.stringify(ex.stages?.map((x) => Object.keys(x))));
    const es = first.executionStats ?? ex.executionStats;
    const plan = first.queryPlanner?.winningPlan ?? ex.queryPlanner?.winningPlan;
    const st = stages(plan);
    lines.push(`| ${label}${captured.length > 1 ? ` #${i + 1}` : ''} | ${st.join(' > ')} | ${es?.totalKeysExamined} | ${es?.totalDocsExamined} | ${es?.nReturned} | ${st.includes('COLLSCAN') ? 'COLLSCAN' : 'indexed'} |`);
  }
  for (const f of finds.slice(0, 3)) {
    const ex = await Restaurant.collection.find(f).limit(5).explain('executionStats');
    const st = stages(ex.queryPlanner.winningPlan);
    lines.push(`| ${label} (find) | ${st.join(' > ')} | ${ex.executionStats.totalKeysExamined} | ${ex.executionStats.totalDocsExamined} | ${ex.executionStats.nReturned} | ${st.includes('COLLSCAN') ? 'COLLSCAN' : 'indexed'} |`);
  }
}
const cu = cuisines[1].slug;
await run('list: no filter (relevance)', () => D.publicList({}));
await run('list: city', () => D.publicList({ city: 'indore', sort: 'rating' }));
await run('list: city+cuisines+cost', () => D.publicList({ city: 'indore', cuisines: cu, cost: 'mid,premium', sort: 'priceAsc' }));
await run('list: search "pizza"', () => D.publicList({ search: 'pizza' }));
await run('list: search prefix "spi"', () => D.publicList({ search: 'spi' }));
await run('list: featured', () => D.publicList({ featured: 'true' }));
await run('list: openNow', () => D.publicList({ city: 'indore', openNow: 'true' }));
await run('nearby', () => D.nearby({ lat: 22.72, lng: 75.86, radius: '5', limit: 20 }));
await run('nearby + cuisine', () => D.nearby({ lat: 22.72, lng: 75.86, radius: '5', cuisines: cu }));
await run('suggest', () => D.suggest('spi'));
await run('suggest word', () => D.suggest('pizza'));
await run('detail similar', () => D.detailPayload({ _id: new mongoose.Types.ObjectId(), cuisines: [{ _id: cuisines[0]._id }], address: { city: { _id: city[0]._id } }, timings: [] }, { isAdmin: true }));

console.log(`rows: ${rows}\n| query | winning plan | keys examined | docs examined | returned | verdict |\n|---|---|---|---|---|---|\n${lines.join('\n')}`);
await mongoose.disconnect();
await mongod.stop();
