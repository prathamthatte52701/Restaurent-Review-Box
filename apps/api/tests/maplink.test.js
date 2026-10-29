const { test, before, after } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const http = await import('node:http');
const { boot, auth } = await import('./helpers.js');

let ctx;
let admin;
let user;
let server;
let hits = [];
const URL_PATH = '/api/v1/utils/resolve-map-link';

before(async () => {
  // local server standing in for Google; the only injected parts are the transport and DNS lookup.
  server = http.createServer((req, res) => {
    hits.push(req.url);
    const m = req.url.match(/^\/chain\/(\d+)$/);
    if (m) { res.writeHead(302, { location: `https://maps.app.goo.gl/chain/${+m[1] + 1}` }); return res.end(); }
    if (req.url === '/short') { res.writeHead(302, { location: 'https://www.google.com/maps/place/Shree+Maya/@22.7196,75.8577,17z/data=!3m1!4b1' }); return res.end(); }
    if (req.url === '/short3d') { res.writeHead(302, { location: 'https://www.google.com/maps/place/A/@22.1,75.1,15z/data=!3d22.7203!4d75.8851' }); return res.end(); }
    if (req.url === '/five') { res.writeHead(302, { location: 'https://maps.app.goo.gl/four' }); return res.end(); }
    if (req.url === '/four') { res.writeHead(302, { location: 'https://maps.app.goo.gl/short' }); return res.end(); }
    if (req.url === '/evil') { res.writeHead(302, { location: 'https://evil.com/maps' }); return res.end(); }
    if (req.url === '/meta') { res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' }); return res.end(); }
    if (req.url === '/body') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<html>blah "center=22.75%2C75.85" @22.7501,75.8502,15z</html>'); }
    if (req.url === '/big') {
      res.writeHead(200);
      const t = setInterval(() => { if (res.destroyed) return clearInterval(t); res.write('x'.repeat(65536)); }, 1);
      res.on('close', () => clearInterval(t));
      return undefined;
    }
    if (req.url === '/hang') return undefined;
    res.writeHead(404);
    return res.end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  ctx = await boot((app) => {
    app.locals.mapLinkDeps = {
      lookup: (h, o, cb) => (o?.all ? cb(null, [{ address: '93.184.216.34', family: 4 }]) : cb(null, '93.184.216.34', 4)),
      requestFn: (url, opts, cb) => http.request({ host: '127.0.0.1', port, path: url.pathname + url.search, method: opts.method, headers: opts.headers }, cb),
    };
  });
  admin = await ctx.makeAdmin();
  user = (await ctx.makeUser()).token;
});
after(async () => { server.closeAllConnections(); server.close(); await ctx.close(); });

const post = (url, token = admin) => ctx.request.post(URL_PATH).set(auth(token)).send({ url });

test('auth: no token 401, non-admin 403', async () => {
  assert.equal((await ctx.request.post(URL_PATH).send({ url: 'https://maps.app.goo.gl/x' })).status, 401);
  assert.equal((await post('https://maps.app.goo.gl/x', user)).status, 403);
});

test('long URLs are parsed without any network call', async () => {
  hits = [];
  let r = await post('https://www.google.com/maps/place/Bapu+Ki+Kutia/@22.7196,75.8577,15z');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data, { lat: 22.7196, lng: 75.8577, placeName: 'Bapu Ki Kutia' });
  assert.equal(r.body.success, true);
  r = await post('https://www.google.com/maps?q=22.7%2C75.8');
  assert.deepEqual(r.body.data, { lat: 22.7, lng: 75.8 });
  r = await post('https://www.google.com/maps/place/X/@1,2,3z/data=!3d22.7203!4d75.8851');
  assert.equal(r.body.data.lat, 22.7203);
  assert.equal(hits.length, 0);
});

test('short link follows redirect and parses; !3d!4d wins', async () => {
  let r = await post('https://maps.app.goo.gl/short');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data, { lat: 22.7196, lng: 75.8577, placeName: 'Shree Maya' });
  r = await post('https://maps.app.goo.gl/short3d');
  assert.equal(r.body.data.lat, 22.7203);
  r = await post('https://maps.app.goo.gl/five'); // 3 hops
  assert.equal(r.status, 200);
});

test('coords can come from the final page body (capped read)', async () => {
  const r = await post('https://maps.app.goo.gl/body');
  assert.equal(r.status, 200);
  assert.equal(r.body.data.lat, 22.7501);
});

test('endless response is cut off at the read cap, cleanly', async () => {
  const r = await post('https://maps.app.goo.gl/big');
  assert.equal(r.status, 400);
  assert.match(r.body.message, /No coordinates/);
});

test('10-redirect chain fails cleanly after 5 redirects', async () => {
  hits = [];
  const r = await post('https://maps.app.goo.gl/chain/0');
  assert.equal(r.status, 400);
  assert.equal(r.body.success, false);
  assert.match(r.body.message, /too many times/);
  assert.equal(hits.length, 6); // initial + 5 redirects followed, the 6th redirect refused
});

test('redirects to non-allowlisted or metadata hosts are refused', async () => {
  for (const p of ['evil', 'meta']) {
    const r = await post(`https://maps.app.goo.gl/${p}`);
    assert.equal(r.status, 400, p);
    assert.match(r.body.message, /Only Google Maps links/);
  }
});

test('upstream that never answers times out cleanly (5s)', { timeout: 15000 }, async () => {
  const t = Date.now();
  const r = await post('https://maps.app.goo.gl/hang');
  assert.equal(r.status, 400);
  assert.match(r.body.message, /too long/);
  assert.ok(Date.now() - t < 8000);
});

const REJECT = [
  'http://127.0.0.1:27017', 'https://127.0.0.1:27017/maps', 'http://169.254.169.254/latest/meta-data/', 'https://[::1]/maps', 'http://[::ffff:7f00:1]/maps',
  'http://2130706433/', 'http://0x7f000001/maps', 'http://0177.0.0.1/', 'http://localhost:3000/maps', 'https://localhost/maps',
  'https://maps.google.com@evil.com/', 'https://maps.google.com:pw@evil.com/maps', 'https://evil.com/?u=https://maps.google.com', 'https://maps.google.com.evil.com/maps',
  'https://evilgoogle.com/maps', 'https://google.com.evil.com/maps', 'https://www.google.com/search?q=1', 'https://goo.gl/abc', 'http://maps.app.goo.gl/abc',
  'https://maps.app.goo.gl:8443/abc', 'ftp://maps.google.com/', 'file:///etc/passwd', 'javascript:alert(1)', 'https://example.com', 'not a url', 'https://metadata.google.internal/',
];
test('SSRF / allowlist rejections are all 400 and never touch the network', async () => {
  hits = [];
  for (const u of REJECT) {
    const r = await post(u);
    assert.equal(r.status, 400, u);
    assert.equal(r.body.success, false, u);
  }
  assert.equal(hits.length, 0);
});

test('isBlockedIp covers private, loopback, link-local, metadata, mapped and junk', async () => {
  const { isBlockedIp, safeLookup } = await import('../src/services/mapLink.js');
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1', '::1', '::', 'fe80::1', 'fc00::1', 'fd12::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '64:ff9b::7f00:1', '64:ff9b::a9fe:a9fe', '64:ff9b::1', 'garbage', '']) {
    assert.equal(isBlockedIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '142.250.77.14', '2607:f8b0:4004:c07::71', '64:ff9b::c0b2:c171']) assert.equal(isBlockedIp(ip), false, ip);
  const err = await new Promise((resolve) => safeLookup('localhost', {}, (e) => resolve(e)));
  assert.equal(err?.message, 'BLOCKED_IP');
});

test('validation: empty, non-string, oversize (5000 chars) -> 400; 2MB string -> clean 413 JSON', async () => {
  for (const body of [{}, { url: '' }, { url: 5 }, { url: ['a'] }, { url: 'x'.repeat(5000) }]) {
    const r = await ctx.request.post(URL_PATH).set(auth(admin)).send(body);
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 40));
    assert.equal(r.body.success, false);
  }
  const big = await ctx.request.post(URL_PATH).set(auth(admin)).send({ url: 'x'.repeat(2 * 1024 * 1024) });
  assert.equal(big.status, 413);
  assert.equal(big.body.success, false);
  assert.ok(big.body.message);
  assert.ok(!big.body.stack);
});
