// Screenshots + console + horizontal-scroll check for every page, light and dark, 3 widths.
import { launch, watch, check, summary, hasHScroll, OUT, BASE } from './lib.mjs';
const pages = [
  ['home', '/'], ['restaurants', '/restaurants'], ['ui-kit', '/ui-kit'], ['404', '/nope/nothing'],
  ['login', '/login'], ['signup', '/signup'], ['verify-otp', '/verify-otp?email=a@b.co&sent=1'], ['forgot', '/forgot-password'],
  ['reset', '/reset-password?email=a@b.co&token=' + 'a'.repeat(64)], ['reset-bad', '/reset-password'],
];
const { browser, ctx } = await launch();
for (const theme of ['light', 'dark']) {
  for (const w of [375, 768, 1440]) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: w, height: 900 });
    await page.addInitScript((t) => { try { localStorage.setItem('rrb-theme', t); } catch {} }, theme);
    const c = watch(page);
    for (const [name, url] of pages) {
      await page.goto(BASE + url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(150);
      const resolved = await page.evaluate(() => document.documentElement.dataset.theme);
      check(`${name} ${theme}@${w} theme applied`, resolved === theme, resolved);
      check(`${name} ${theme}@${w} no h-scroll`, !(await hasHScroll(page)));
      await page.screenshot({ path: `${OUT}/${name}-${theme}-${w}.png`, fullPage: name === 'ui-kit' ? w === 1440 : true });
    }
    check(`console errors ${theme}@${w}`, c.errors.length === 0, c.errors.join(' | '));
    check(`console warnings ${theme}@${w}`, c.warnings.length === 0, c.warnings.join(' | '));
    await page.close();
  }
}
await browser.close();
summary();
