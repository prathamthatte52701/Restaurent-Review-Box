import dns from 'node:dns';
import net from 'node:net';
import https from 'node:https';
import { ApiError } from '../utils/ApiError.js';

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 5000;
const MAX_BODY = 256 * 1024;

// ---- IP policy: only globally routable unicast addresses are allowed ----
const blocked = new net.BlockList();
for (const [a, p] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) blocked.addSubnet(a, p, 'ipv4');
for (const [a, p] of [['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64], ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]]) blocked.addSubnet(a, p, 'ipv6');

/** true when `ip` is private/loopback/link-local/metadata/reserved or not a valid IP at all. */
export function isBlockedIp(ip) {
  const s = String(ip).replace(/^\[|\]$/g, '').split('%')[0];
  const v = net.isIP(s);
  if (!v) return true;
  if (v === 4) return blocked.check(s, 'ipv4');
  const mapped = s.toLowerCase().match(/^(?:0*:)+ffff:(.+)$/); // ::ffff:a.b.c.d or ::ffff:7f00:1
  if (mapped) {
    const m = mapped[1];
    if (net.isIPv4(m)) return isBlockedIp(m);
    const h = m.split(':').map((x) => parseInt(x, 16));
    if (h.length === 2 && h.every(Number.isFinite)) return isBlockedIp(`${h[0] >> 8}.${h[0] & 255}.${h[1] >> 8}.${h[1] & 255}`);
    return true;
  }
  // NAT64 (DNS64 networks): 64:ff9b::a.b.c.d is a translated IPv4 address, judge the embedded IPv4
  const nat = new URL(`http://[${s}]`).hostname.match(/^\[64:ff9b::([0-9a-f]{1,4}):([0-9a-f]{1,4})\]$/);
  if (nat) {
    const [h1, h2] = [parseInt(nat[1], 16), parseInt(nat[2], 16)];
    return isBlockedIp(`${h1 >> 8}.${h1 & 255}.${h2 >> 8}.${h2 & 255}`);
  }
  return blocked.check(s, 'ipv6');
}

/** dns.lookup replacement used at connect time: the validated address is the one connected to (no rebinding gap). */
export function safeLookup(hostname, opts, cb) {
  dns.lookup(hostname, { all: true }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs.length || addrs.some((a) => isBlockedIp(a.address))) return cb(new Error('BLOCKED_IP'));
    const a = addrs[0];
    return opts?.all ? cb(null, [a]) : cb(null, a.address, a.family);
  });
}

// ---- host allowlist ----
const TLD = '(com|co\\.[a-z]{2}|com\\.[a-z]{2}|[a-z]{2,3})';
const GOOGLE = new RegExp(`^(www\\.)?google\\.${TLD}$`);
const MAPS_GOOGLE = new RegExp(`^maps\\.google\\.${TLD}$`);
export function isAllowedMapsUrl(u) {
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return false;
  const h = u.hostname.toLowerCase();
  if (h === 'maps.app.goo.gl') return true;
  if (h === 'goo.gl') return /^\/maps(\/|$)/.test(u.pathname);
  if (MAPS_GOOGLE.test(h)) return true;
  return GOOGLE.test(h) && /^\/maps(\/|$)/.test(u.pathname);
}

// ---- coordinate extraction ----
const N = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
const PAIR = new RegExp(`^${N}\\s*,\\s*${N}$`);
const inRange = (a, b) => Math.abs(a) <= 90 && Math.abs(b) <= 180;
const found = (m, place) => (m && inRange(+m[1], +m[2]) ? { lat: +m[1], lng: +m[2], ...(place ? { placeName: place } : {}) } : null);

export function extractCoords(text, u) {
  let s = text;
  try { s = decodeURIComponent(text); } catch { /* keep raw */ }
  let place;
  const pm = u?.pathname.match(/\/place\/([^/@]+)/);
  if (pm) { try { place = decodeURIComponent(pm[1].replace(/\+/g, ' ')).slice(0, 200); } catch { /* ignore */ } }
  if (place && (PAIR.test(place) || /°/.test(place))) place = undefined;
  let r = found(s.match(new RegExp(`!3d${N}!4d${N}`)), place) || found(s.match(new RegExp(`@${N},${N}`)), place);
  if (r) return r;
  for (const k of ['q', 'll', 'query', 'center', 'destination']) {
    const v = (u?.searchParams.get(k) || '').trim().match(PAIR);
    if (v && (r = found(v, place))) return r;
  }
  return found(s.match(new RegExp(`/place/${N},${N}`)), place) || found(s.match(new RegExp(`center=${N},${N}`)), place);
}

// ---- one network hop (never follows redirects) ----
function hop(url, { requestFn, lookup }) {
  return new Promise((resolve, reject) => {
    const headers = { 'user-agent': 'Mozilla/5.0 (compatible; RRB-MapResolver/1.0)', accept: 'text/html,*/*', 'accept-language': 'en' };
    const req = requestFn(url, { method: 'GET', lookup, headers }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) { res.destroy(); return resolve({ redirect: res.headers.location }); }
      if (status !== 200) { res.destroy(); return reject(ApiError.badRequest(`Google Maps answered with status ${status} for that link.`)); }
      let size = 0;
      let done = false;
      const chunks = [];
      const finish = () => { if (!done) { done = true; resolve({ body: Buffer.concat(chunks).toString('utf8', 0, MAX_BODY) }); } };
      res.on('data', (c) => {
        size += c.length;
        chunks.push(c);
        if (size >= MAX_BODY) { finish(); res.destroy(); } // read cap reached
      });
      res.on('end', finish);
      res.on('error', finish);
      res.on('close', finish);
    });
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('TIMEOUT')));
    req.on('error', reject);
    req.end();
  });
}

const failMsg = (e) => {
  if (e?.message === 'BLOCKED_IP') return 'That link points to a disallowed address.';
  if (e?.message === 'TIMEOUT') return 'Google Maps took too long to answer. Try again or paste the full link.';
  return 'Could not reach Google Maps to resolve that link.';
};

/**
 * Resolve a Google Maps link to coordinates. SSRF-safe: host allowlist on every hop, IPs validated at connect time,
 * redirects followed manually (max 5), per-hop 5s timeout, response read capped.
 * `deps` is for tests only (request function / dns lookup injection); production uses https.request + safeLookup.
 */
export async function resolveMapLink(input, deps = {}) {
  const requestFn = deps.requestFn || https.request;
  const lookup = deps.lookup || safeLookup;
  let u;
  try { u = new URL(String(input).trim()); } catch { throw ApiError.badRequest('That does not look like a valid link.'); }

  for (let redirects = 0; ; redirects++) {
    if (!isAllowedMapsUrl(u)) throw ApiError.badRequest('Only Google Maps links are supported.');
    const direct = extractCoords(u.pathname + u.search + u.hash, u);
    if (direct) return direct;
    if (redirects > MAX_REDIRECTS) throw ApiError.badRequest('That link redirects too many times.');
    let r;
    try { r = await hop(u, { requestFn, lookup }); } catch (e) { throw e?.isApiError ? e : ApiError.badRequest(failMsg(e)); }
    if (r.redirect) {
      if (redirects === MAX_REDIRECTS) throw ApiError.badRequest('That link redirects too many times.');
      try { u = new URL(r.redirect, u); } catch { throw ApiError.badRequest('That link redirects to an invalid address.'); }
      continue;
    }
    const fromBody = extractCoords(r.body, u);
    if (fromBody) return fromBody;
    throw ApiError.badRequest('No coordinates found in that link.');
  }
}
