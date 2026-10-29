// Run: node apps/admin/src/lib/mapsUrl.check.js
import assert from 'node:assert/strict';
import { parseMapsUrl as p } from './mapsUrl.js';

assert.deepEqual(p('https://www.google.com/maps/place/S/@22.7196,75.8577,15z'), { lat: 22.7196, lng: 75.8577 });
assert.deepEqual(p('https://www.google.com/maps/place/X/data=!4m6!3d22.7188!4d75.8576'), { lat: 22.7188, lng: 75.8576 });
assert.deepEqual(p('https://www.google.com/maps?q=22.7,75.8'), { lat: 22.7, lng: 75.8 });
assert.deepEqual(p('https://maps.google.com/?ll=22.71,75.85'), { lat: 22.71, lng: 75.85 });
assert.deepEqual(p('22.7186, 75.8574'), { lat: 22.7186, lng: 75.8574 });
for (const bad of ['', 'nope', 'https://example.com', 'https://maps.app.goo.gl/x', 'https://www.google.com/maps/@999,200,1z', 'https://www.google.com/maps/place/Foo']) {
  assert.throws(() => p(bad), Error, bad);
}
console.log('mapsUrl ok');
