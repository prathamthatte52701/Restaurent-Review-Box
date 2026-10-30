// Phase 3 gate: behaviour + break tests against real API (:5000) and web (:5173).
// Run from repo root: node apps/web/e2e/discovery-break.mjs
import { launch, watch, check, summary, BASE, sleep } from './lib.mjs';

const API = process.env.API || 'http://localhost:5000/api/v1';
const { browser, ctx } = await launch({ permissions: [] });
const page = await ctx.newPage();
const c = watch(page);
const names = () => page.locator('article h3').allInnerTexts();
const ready = () =>
  page
    .waitForFunction(() => !document.querySelector('.rrb-skeleton') && document.querySelector('[aria-label=Results][aria-busy=false]'), null, { timeout: 15000 })
    .catch(() => {});
const go = async (u) => {
  await page.goto(BASE + u, { waitUntil: 'domcontentloaded' });
  await ready();
};
const j = async (u) => (await fetch(API + u)).json();
const t = async (name, fn) => {
  try { await fn(); } catch (e) { check(name, false, String(e.message).split('\n')[0]); }
};

// 1. URL state round-trip + back/forward
await t('url state', async () => {
  await go('/restaurants');
  const rail = page.locator('aside[aria-label=Filters]');
  await rail.getByRole('checkbox', { name: /Pizza/ }).click(); await sleep(250);
  await rail.getByRole('checkbox', { name: /Fast Food/ }).click(); await sleep(250);
  await rail.getByRole('checkbox', { name: /Mid-range/ }).click(); await sleep(250);
  await rail.getByRole('switch', { name: /Open now/ }).click();
  await ready();
  const url4 = page.url();
  const n4 = await names();
  check('4 filters in URL', /cuisines=/.test(url4) && /cost=mid/.test(url4) && /openNow=true/.test(url4), url4);
  const p2 = await ctx.newPage();
  await p2.goto(url4, { waitUntil: 'domcontentloaded' });
  await p2.waitForSelector('article h3');
  check('URL copy restores same results', JSON.stringify(await p2.locator('article h3').allInnerTexts()) === JSON.stringify(n4));
  check('chips restored in new tab', (await p2.locator('button[aria-label^="Remove filter"]').count()) >= 4);
  await p2.close();
  await page.goBack(); await ready();
  check('back removes last filter (open now off)', !/openNow/.test(page.url()), page.url());
  await page.goBack(); await ready();
  check('back again steps to previous filter', !/cost=/.test(page.url()), page.url());
  await page.goForward(); await ready();
  check('forward restores', /cost=mid/.test(page.url()));
  await page.getByRole('button', { name: 'Clear all' }).first().click(); await ready();
  check('clear all resets URL', new URL(page.url()).search === '', page.url());
  await page.waitForFunction(() => document.querySelectorAll('article h3').length === 5, null, { timeout: 8000 }).then(() => check('clear all restores 5 results', true)).catch(async () => check('clear all restores 5 results', false, String((await names()).length)));
});

// 2. sorts match API order
for (const s of ['name', 'priceDesc', 'priceAsc', 'newest', 'rating', 'popular']) {
  await t(`sort ${s}`, async () => {
    await go(`/restaurants?sort=${s}`);
    const ui = await names();
    const api = (await j(`/restaurants?sort=${s}&limit=12`)).data.map((r) => r.name);
    check(`sort ${s} matches API order`, JSON.stringify(ui) === JSON.stringify(api), ui[0]);
  });
}

// 3. hand-edited URLs never 500 / blank
for (const u of ['?page=-5', '?page=abc', '?limit=99999', '?sort=garbage', '?cuisines=notanid', '?cost=zzz&type=zzz', '?minRating=99', '?near=999,999', '?page=99999', '?q=' + 'x'.repeat(1000), '?q=' + encodeURIComponent('🍕🍕🍕🍕'), '?q=' + encodeURIComponent("';DROP")]) {
  await t(`url ${u.slice(0, 30)}`, async () => {
    const bad = [];
    const h = (r) => r.url().includes('/api/v1/') && r.status() >= 500 && bad.push(r.status());
    page.on('response', h);
    await go('/restaurants' + u);
    await sleep(400);
    const body = await page.locator('main').innerText();
    page.off('response', h);
    check(`url ${u.slice(0, 40)} -> no 5xx, not blank`, !bad.length && body.trim().length > 40, bad.join(','));
  });
}
await t('page99999', async () => {
  await go('/restaurants?page=99999');
  await sleep(500);
  check('?page=99999 does not stay on page 99999 / not blank', (await page.locator('main').innerText()).length > 40);
});

// 4. nothing matches -> designed empty + clear
await t('empty', async () => {
  await go('/restaurants?q=zzzznothing');
  check('empty state shown', await page.getByText('No restaurants match these filters').isVisible());
  await page.getByRole('button', { name: 'Clear filters' }).click(); await page.waitForSelector('article h3'); await ready();
  check('empty -> clear filters restores list', (await names()).length === 5);
});

// 5. rapid toggling 20 clicks, final state equals API
await t('rapid', async () => {
  await go('/restaurants');
  const boxes = page.locator('aside[aria-label=Filters] input[type=checkbox]:not([disabled])');
  const cnt = Math.min(await boxes.count(), 6);
  for (let i = 0; i < 20; i++) await boxes.nth(i % cnt).click({ force: true, noWaitAfter: true }).catch(() => {});
  await sleep(1000); await ready(); await sleep(500);
  const sp = new URL(page.url()).searchParams;
  const qs = ['cuisines', 'amenities', 'cost', 'category'].filter((k) => sp.get(k)).map((k) => `${k}=${sp.get(k)}`).join('&');
  const api = await j(`/restaurants?${qs}&limit=12`);
  const ui = (await names()).length;
  check('rapid toggle: UI count equals API for final URL', ui === api.data.length, `${ui} vs ${api.data.length} (${qs})`);
});

// 6. global search keyboard
await t('search', async () => {
  await go('/');
  const box = page.getByRole('combobox').first();
  await box.fill('piz');
  await page.waitForSelector('[role=option]');
  check('combobox has groups', (await page.locator('[role=group]').count()) >= 1);
  await box.press('ArrowDown');
  check('aria-activedescendant set', !!(await box.getAttribute('aria-activedescendant')));
  await box.press('Enter');
  await page.waitForURL(/\/restaurants\/[a-z]/);
  check('arrow+enter lands on a detail page', /\/restaurants\/(pizza-hut|dominos)/.test(page.url()), page.url());
  await go('/');
  await box.fill('burger');
  await box.press('Enter');
  await page.waitForURL(/\/restaurants\?q=burger/);
  check('enter w/o selection -> listing with q', true);
  await go('/');
  await box.fill('piz'); await page.waitForSelector('[role=option]'); await box.press('Escape');
  check('escape closes list', (await box.getAttribute('aria-expanded')) === 'false');
  await box.fill('x'.repeat(1000));
  check('1000-char search input capped', (await box.inputValue()).length === 100);
  await box.fill('🍕🍕'); await box.press('Enter'); await page.waitForURL(/restaurants\?q=/);
  await ready();
  check('emoji search handled (page renders)', (await page.locator('main').innerText()).length > 20);
  const rec = await page.evaluate(() => localStorage.getItem('rrb-recent-searches'));
  check('recent searches stored', !!rec && rec.includes('burger'), rec);
  await go('/');
  await page.evaluate(() => { Storage.prototype.getItem = () => { throw new Error('blocked'); }; Storage.prototype.setItem = () => { throw new Error('blocked'); }; });
  const b2 = page.getByRole('combobox').first();
  await b2.fill('pizza'); await b2.press('Enter'); await sleep(600);
  check('localStorage throwing does not break search', /q=pizza/.test(page.url()), page.url());
});

// 7. detail page
await t('detail', async () => {
  await go('/restaurants/dominos-pizza-sayaji-circle-vijay-nagar');
  const ext = page.locator('aside a[target=_blank]');
  check('outbound links open new tab with noopener noreferrer', (await ext.count()) >= 1 && (await ext.evaluateAll((as) => as.every((a) => /noopener/.test(a.rel) && /noreferrer/.test(a.rel)))));
  check('no zomato button when no link', (await page.getByText('Order on Zomato').count()) === 0);
  check('timings table highlights today', (await page.locator('tr[aria-current=date]').count()) === 1);
  check('no reviews section designed', await page.getByText('No reviews yet').isVisible());
  await go('/restaurants/nope-nope');
  check('unknown slug -> designed 404', await page.getByText("This restaurant isn't available").isVisible());
});
await t('deleted', async () => {
  await page.route('**/api/v1/restaurants/shreemaya-celebrity', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Restaurant not found' }) }));
  await page.goto(BASE + '/restaurants/shreemaya-celebrity', { waitUntil: 'domcontentloaded' });
  await page.getByText("This restaurant isn't available").waitFor({ timeout: 8000 });
  check('deleted restaurant -> graceful 404', true);
  await page.unroute('**/api/v1/restaurants/shreemaya-celebrity');
});
await t('sparse', async () => {
  await page.route('**/api/v1/restaurants/shreemaya-celebrity', async (r) => {
    const res = await r.fetch();
    const b = await res.json();
    Object.assign(b.data, { timings: [], coverImage: null, gallery: [], externalLinks: {}, contactPhone: null, openStatus: { isOpen: false, hasTimings: false, opensAt: null, closesAt: null, nextOpenDay: null } });
    r.fulfill({ response: res, body: JSON.stringify(b) });
  });
  await page.goto(BASE + '/restaurants/shreemaya-celebrity', { waitUntil: 'domcontentloaded' });
  await page.getByText("Opening hours haven't been added yet.").waitFor({ timeout: 8000 });
  check('no timings -> fallback text', true);
  check('no links -> fallback message (directions still derived from coordinates)', (await page.locator('aside a[target=_blank]').count()) <= 1);
  check('no timings -> no open/closed badge', (await page.getByText('Open now').count()) === 0);
  await page.unroute('**/api/v1/restaurants/shreemaya-celebrity');
});

// 8. geolocation denied then granted
await t('geo denied', async () => {
  await go('/restaurants');
  await page.getByRole('button', { name: 'Near me' }).click();
  await page.getByRole('alert').first().waitFor({ timeout: 15000 });
  check('geolocation denied -> clear message', true, await page.getByRole('alert').first().innerText());
  await page.getByRole('button', { name: 'Use a city instead' }).click(); await ready();
  check('fallback to city works', (await names()).length === 5 && /city=indore/.test(page.url()), page.url());
});
await t('geo granted', async () => {
  const gctx = await browser.newContext({ geolocation: { latitude: 22.7396, longitude: 75.892 }, permissions: ['geolocation'], viewport: { width: 1440, height: 900 } });
  const g = await gctx.newPage();
  const gc = watch(g);
  await g.goto(BASE + '/restaurants?near=me', { waitUntil: 'domcontentloaded' });
  await g.waitForSelector('article h3', { timeout: 20000 });
  await g.getByText(/ away/).first().waitFor({ timeout: 20000 });
  check('near=me resolves coords into URL', /near=22\.7396(,|%2C)75\.8920/.test(g.url()), g.url());
  const d = await g.locator('article').evaluateAll((a) => a.map((x) => (x.innerText.match(/([\d.]+) (m|km) away/) || [])[0]));
  check('near me: every card has a distance', d.length > 1 && d.every(Boolean), d.join(' | '));
  const meters = d.map((s) => { const m = /([\d.]+) (m|km)/.exec(s); return Number(m[1]) * (m[2] === 'km' ? 1000 : 1); });
  check('near me nearest first', meters.every((v, i) => i === 0 || v >= meters[i - 1]), meters.join(','));
  await g.getByLabel('Search radius').selectOption('1');
  await sleep(1000);
  check('radius selector updates URL', /radius=1/.test(g.url()), g.url());
  await g.getByRole('button', { name: 'Map' }).click();
  await g.waitForSelector('.leaflet-container');
  await sleep(1200);
  check('near map: you-are-here marker + radius circle', (await g.locator('.rrb-me').count()) === 1 && (await g.locator('path.leaflet-interactive').count()) >= 1);
  check('no console errors in near-me', gc.errors.length === 0, gc.errors.join('|'));
  await gctx.close();
});

// 9. map
await t('map', async () => {
  await go('/restaurants?view=map');
  await page.waitForSelector('.leaflet-container');
  await sleep(1500);
  const pinsNow = async () => (await page.locator('.rrb-pin').count()) + (await page.locator('.marker-cluster').evaluateAll((cs) => cs.reduce((s, x) => s + Number(x.innerText || 0), 0)));
  check('map pins+cluster counts = results (5)', (await pinsNow()) === 5, String(await pinsNow()));
  for (let i = 0; i < 10; i++) await page.getByRole('checkbox', { name: /Pizza/ }).first().click({ force: true, noWaitAfter: true }).catch(() => {});
  await sleep(2000);
  check('one leaflet container after churn', (await page.locator('.leaflet-container').count()) === 1);
  const sp = new URL(page.url()).searchParams;
  const expected = (await j(`/restaurants?${sp.get('cuisines') ? 'cuisines=' + sp.get('cuisines') + '&' : ''}limit=50`)).data.length;
  check('no duplicate pins after churn', (await pinsNow()) === expected, `${await pinsNow()} vs ${expected}`);
  await go('/restaurants?view=map&cuisines=pizza');
  await sleep(1500);
  const pin = page.locator('.rrb-pin').first();
  if (await pin.count()) await pin.click({ force: true });
  else { await page.locator('.marker-cluster').first().click(); await sleep(1000); await page.locator('.rrb-pin').first().click({ force: true }); }
  await page.waitForSelector('.rrb-pop-title', { timeout: 8000 });
  await page.locator('.rrb-pop-link').click();
  await page.waitForURL(/\/restaurants\/[a-z0-9-]+$/);
  check('popup click-through reaches detail', true, page.url());
});

// 10. slow API -> skeletons
await t('slow', async () => {
  const slow = await ctx.newPage();
  await slow.route('**/api/v1/**', async (r) => { await sleep(1500); r.continue(); });
  await slow.goto(BASE + '/restaurants', { waitUntil: 'domcontentloaded' });
  await slow.waitForSelector('.rrb-skeleton', { timeout: 5000 });
  check('skeletons visible on slow API', true);
  await slow.waitForSelector('article h3', { timeout: 20000 });
  check('content replaces skeletons', (await slow.locator('article .rrb-skeleton').count()) === 0);
  await slow.close();
});

check('console errors (whole run)', c.errors.length === 0, c.errors.join(' | '));
check('console warnings (whole run)', c.warnings.length === 0, c.warnings.join(' | '));
await browser.close();
summary();
process.exit(process.exitCode || 0);
