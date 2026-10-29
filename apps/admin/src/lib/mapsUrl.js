const inRange = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
const NUM = '(-?\d{1,3}(?:\.\d+)?)';
const PAIR = new RegExp(`^${NUM}\s*,\s*${NUM}$`);

/**
 * Extract coordinates from a Google Maps URL (or a plain "lat,lng" string).
 * Handles .../@lat,lng,15z  ...!3dLAT!4dLNG  ?q=lat,lng  ll=lat,lng  query=lat,lng  /place/lat,lng
 * @returns {{lat:number,lng:number}} ; throws Error with a readable message otherwise. Never crashes on junk.
 */
export function parseMapsUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) throw new Error('Paste a Google Maps link first.');
  const plain = raw.match(PAIR);
  if (plain) return check(+plain[1], +plain[2]);

  let u;
  try { u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { throw new Error('That does not look like a valid link.'); }
  const host = u.hostname.toLowerCase();
  if (!/(^|\.)google\.[a-z.]+$/.test(host) && !/(^|\.)goo\.gl$/.test(host) && host !== 'maps.app.goo.gl') {
    throw new Error('Only Google Maps links are supported.');
  }
  if (host === 'maps.app.goo.gl' || host.endsWith('goo.gl')) {
    throw new Error('Short links cannot be read. Open the link in your browser and paste the full address-bar URL instead.');
  }
  const full = decodeURIComponent(u.pathname + u.search + u.hash).replace(/\+/g, ' ');
  let m = full.match(new RegExp(`!3d${NUM}!4d${NUM}`)); // exact place pin
  if (m) return check(+m[1], +m[2]);
  m = full.match(new RegExp(`@${NUM},${NUM}`));
  if (m) return check(+m[1], +m[2]);
  for (const k of ['q', 'll', 'query', 'center', 'destination']) {
    const v = u.searchParams.get(k);
    const p = v && v.trim().match(PAIR);
    if (p) return check(+p[1], +p[2]);
  }
  m = u.pathname.match(new RegExp(`/place/${NUM},${NUM}`));
  if (m) return check(+m[1], +m[2]);
  throw new Error('No coordinates found in that link. Use a link containing "@lat,lng" or click the map instead.');
}

function check(lat, lng) {
  if (!inRange(lat, lng)) throw new Error('Those coordinates are out of range (latitude -90..90, longitude -180..180).');
  return { lat, lng };
}
