// UI behaviour: theme, modals, notifications queue. node apps/web/e2e/ui.mjs
import { launch, watch, check, summary, BASE } from './lib.mjs';

const { browser, ctx } = await launch({ colorScheme: 'light' });
const page = await ctx.newPage();
const c = watch(page);
const theme = () => page.evaluate(() => document.documentElement.dataset.theme);

// theme: no flash — the attribute must be set before first paint (check at DOMContentLoaded via init observer)
await page.addInitScript(() => {
  window.__themeAtFirstNode = null;
  const mo = new MutationObserver(() => {
    if (window.__themeAtFirstNode === null && document.body) window.__themeAtFirstNode = document.documentElement.dataset.theme || 'none';
  });
  mo.observe(document, { childList: true, subtree: true });
});
await page.goto(BASE + '/ui-kit', { waitUntil: 'networkidle' });
check('theme set before body exists (no flash, system->light)', (await page.evaluate(() => window.__themeAtFirstNode)) === 'light');
await page.getByRole('button', { name: /^Theme:/ }).first().click();
await page.getByRole('menuitem', { name: /Dark/ }).click();
check('toggle -> dark', (await theme()) === 'dark');
await page.reload({ waitUntil: 'networkidle' });
check('dark survives reload', (await theme()) === 'dark');
check('first-node theme is dark on reload (no flash)', (await page.evaluate(() => window.__themeAtFirstNode)) === 'dark');
await page.evaluate(() => localStorage.setItem('rrb-theme', 'banana'));
await page.reload({ waitUntil: 'networkidle' });
check("'banana' falls back to system (light)", (await theme()) === 'light');

// modal keyboard behaviour
const trigger = page.getByRole('button', { name: 'Open md' });
await trigger.focus();
await trigger.click();
const dlg = page.getByRole('dialog');
await dlg.waitFor();
check('modal opens', await dlg.isVisible());
let inside = true;
for (let i = 0; i < 8; i++) {
  await page.keyboard.press('Tab');
  inside = inside && (await page.evaluate(() => !!document.activeElement.closest('[role=dialog]')));
}
check('focus trapped in modal over 8 tabs', inside);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('esc closes modal', (await page.getByRole('dialog').count()) === 0);
check('focus returned to trigger', await page.evaluate(() => document.activeElement?.textContent?.trim() === 'Open md'));

// 3 stacked modals, esc x3, no scroll lock
await page.getByRole('button', { name: 'Stacked x3' }).click();
await page.getByRole('button', { name: 'Open another' }).click();
await page.getByRole('button', { name: 'Open another' }).click();
await page.waitForTimeout(300);
check('3 dialogs open', (await page.locator('[role=dialog]').count()) === 3);
for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(350); }
check('all closed after 3 esc', (await page.getByRole('dialog').count()) === 0);
const lock = await page.evaluate(() => ({ o: getComputedStyle(document.body).overflow, pe: getComputedStyle(document.body).pointerEvents, ds: document.body.hasAttribute('data-scroll-locked') }));
check('no body scroll lock / pointer-events block', lock.o !== 'hidden' && lock.pe !== 'none' && !lock.ds, JSON.stringify(lock));
const sy = await page.evaluate(() => { window.scrollTo(0, 400); return window.scrollY; });
check('page scrolls after modals', sy > 0, String(sy));

// notification queue
await page.getByRole('button', { name: 'Queue of 3' }).click();
const titles = [];
for (let i = 0; i < 3; i++) {
  await page.getByRole('dialog').waitFor();
  titles.push(await page.getByRole('dialog').locator('h2').first().innerText());
  await page.getByRole('dialog').getByRole('button').last().click();
  await page.waitForTimeout(250);
}
check('notification queue order', titles.join('|') === 'First in queue|Second in queue|Third in queue', titles.join('|'));

// 404
await page.goto(BASE + '/does/not/exist', { waitUntil: 'networkidle' });
check('404 page renders', await page.getByRole('heading', { name: /isn't on the menu/ }).isVisible());

// mobile menu
await page.setViewportSize({ width: 375, height: 800 });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Open menu' }).click();
check('mobile menu sheet opens with nav', await page.getByRole('dialog').getByRole('link', { name: 'Restaurants' }).isVisible());
await page.getByRole('dialog').getByRole('link', { name: 'Restaurants' }).click();
await page.waitForURL(/restaurants/);
await page.waitForTimeout(400);
check('mobile menu closes on navigate', (await page.getByRole('dialog').count()) === 0);

check('console errors', c.errors.length === 0, c.errors.join(' | '));
check('console warnings', c.warnings.length === 0, c.warnings.join(' | '));
await browser.close();
summary();
