// Run with the API STOPPED (readable error, no white screen), or with default rate limits for the 429 test.
//   MODE=down node apps/web/e2e/failure.mjs     MODE=ratelimit node apps/web/e2e/failure.mjs
import { launch, watch, check, summary, BASE, OUT } from './lib.mjs';

const { browser, ctx } = await launch();
const page = await ctx.newPage();
const c = watch(page);
const mode = process.env.MODE;

if (mode === 'down') {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Email or username').fill('someone@example.com');
  await page.getByLabel('Password', { exact: false }).first().fill('whatever123');
  await page.getByRole('button', { name: 'Log in' }).last().click();
  await page.getByRole('dialog').getByText("Can't reach the server. Check your connection and try again.").waitFor({ timeout: 8000 })
    .then(() => check('API down: login shows readable modal', true)).catch(() => check('API down: login modal', false));
  await page.screenshot({ path: `${OUT}/api-down-login.png` });
  await page.getByRole('dialog').getByRole('button').click();
  // with a valid-looking token and API down: hydration error state, not white screen
  await page.evaluate(() => localStorage.setItem('rrb-token', 'abc.def.ghi'));
  await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
  await page.getByText("We couldn't check your session").waitFor({ timeout: 8000 })
    .then(() => check('API down + token: readable error state with retry', true)).catch(() => check('API down + token error state', false));
  check('body not blank', (await page.locator('body').innerText()).length > 20);
  await page.screenshot({ path: `${OUT}/api-down-session.png` });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  check('public home still renders with API down', await page.getByRole('heading', { level: 1 }).isVisible());
  check('token kept when server merely unreachable', !!(await page.evaluate(() => localStorage.getItem('rrb-token'))));
  console.log('expected network console lines:', c.network.length);
  check('no JS console errors (excluding network)', c.errors.length === 0, c.errors.join(' | '));
}

if (mode === 'ratelimit') {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Email or username').fill('ratelimit@example.com');
  const pw = page.getByLabel('Password', { exact: false }).first();
  await pw.fill('whatever123');
  let got429 = false;
  let tries = 0;
  page.on('response', (r) => { if (r.url().endsWith('/auth/login') && r.status() === 429) got429 = true; });
  for (; tries < 30 && !got429; tries++) {
    await page.getByRole('button', { name: 'Log in' }).last().click();
    await page.waitForResponse((r) => r.url().endsWith('/auth/login')).catch(() => {});
    await page.waitForTimeout(120);
  }
  const dlg = page.getByRole('dialog');
  await dlg.waitFor({ timeout: 5000 }).then(() => check(`rate limiter fired after ${tries} attempts -> modal shown`, true)).catch(() => check('429 modal', false));
  const txt = await dlg.innerText().catch(() => '');
  check('429 modal text readable', /slow down/i.test(txt) && /15 minutes|try again/i.test(txt), txt.replace(/\n/g, ' / '));
  await page.screenshot({ path: `${OUT}/rate-limit-modal.png` });
  check('no JS console errors (excluding network)', c.errors.length === 0, c.errors.join(' | '));
}
await browser.close();
summary();
