// Phase 3: screenshot + console + horizontal-scroll sweep of discovery pages, light/dark x 375/768/1440.
// Run from repo root with API on :5000 and web on :5173:  SHOTS_DIR=<dir> node apps/web/e2e/discovery-sweep.mjs
import { launch, watch, check, summary, hasHScroll, OUT, BASE } from './lib.mjs';

const SLUG = process.env.SLUG || 'dominos-pizza-sayaji-circle-vijay-nagar';
const pages = [
  ['home', '/'],
  ['list', '/restaurants'],
  ['list-filtered', '/restaurants?cuisines=pizza,fast-food&cost=mid&openNow=true&sort=rating'],
  ['list-empty', '/restaurants?q=zzzznothing'],
  ['list-map', '/restaurants?view=map'],
  ['detail', `/restaurants/${SLUG}`],
  ['detail-404', '/restaurants/does-not-exist'],
];
const { browser, ctx } = await launch();
for (const theme of ['light', 'dark']) {
  for (const w of [375, 768, 1440]) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: w, height: 900 });
    await page.addInitScript((t) => { try { localStorage.setItem('rrb-theme', t); } catch {} }, theme);
    const c = watch(page);
    for (const [name, url] of pages) {
      await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && !document.querySelector('.rrb-skeleton'), null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(name.includes('map') ? 1500 : 300);
      check(`${name} ${theme}@${w} no h-scroll`, !(await hasHScroll(page)));
      await page.screenshot({ path: `${OUT}/${name}-${theme}-${w}.png`, fullPage: true });
    }
    check(`console errors ${theme}@${w}`, c.errors.length === 0, c.errors.join(' | '));
    check(`console warnings ${theme}@${w}`, c.warnings.length === 0, c.warnings.join(' | '));
    check(`network noise ${theme}@${w} (only expected 404)`, c.network.every((n) => /404/.test(n)), c.network.join(' | '));
    await page.close();
  }
}
await browser.close();
summary();
