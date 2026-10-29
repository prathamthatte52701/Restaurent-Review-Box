// Auth journeys against a real API. Needs API_LOG (API stdout file) and the API started with high rate limits.
import { launch, watch, check, summary, lastOtp, lastResetLink, sleep, BASE, OUT } from './lib.mjs';

const stamp = Date.now().toString(36);
const U = { fullName: 'Test Diner', username: `diner_${stamp}`, email: `diner_${stamp}@example.com`, password: 'Sup3rSecret!' };
const { browser, ctx } = await launch();
const page = await ctx.newPage();
const c = watch(page);
const fill = async (label, v) => page.getByLabel(label, { exact: false }).first().fill(v);
const url = () => new URL(page.url());
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });
const ok = (name) => check(name, true);
const no = (name, d) => check(name, false, d);
const pw = () => page.locator('input[autocomplete="new-password"], input[autocomplete="current-password"]').first();
const loginBtn = () => page.getByRole('button', { name: 'Log in' }).last();
const logout = async () => {
  await page.getByRole('button', { name: 'Account menu' }).first().click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await page.waitForFunction(() => !localStorage.getItem('rrb-token'));
};

// ---- empty / invalid submissions
await page.goto(BASE + '/signup');
await page.getByRole('button', { name: 'Create account' }).click();
await page.waitForTimeout(200);
let alerts = await page.locator('[role=alert]').allInnerTexts();
check('signup empty submit shows inline errors', alerts.length >= 4 && alerts.some((t) => /full name/i.test(t)), alerts.join(' | '));
await shot('signup-errors');
await fill('Full name', 'A');
await fill('Username', 'a!');
await fill('Email', 'nope');
await pw().fill('short');
await page.getByRole('button', { name: 'Create account' }).click();
await page.waitForTimeout(200);
alerts = await page.locator('[role=alert]').allInnerTexts();
check('signup invalid values -> readable errors', alerts.some((t) => /letters, numbers/i.test(t)) && alerts.some((t) => /email/i.test(t)) && alerts.some((t) => /8 characters/i.test(t)), alerts.join(' | '));
check('no raw error text', !alerts.some((t) => /\[object|undefined|ZodError|stack/i.test(t)));
await page.goto(BASE + '/login');
await loginBtn().click();
await page.waitForTimeout(200);
alerts = await page.locator('[role=alert]').allInnerTexts();
check('login empty submit errors', alerts.length >= 2, alerts.join(' | '));
await fill('Email or username', 'ghost@example.com');
await pw().fill('whatever123');
await loginBtn().click();
await page.getByText(/invalid email\/username or password/i).waitFor({ timeout: 5000 }).then(() => ok('wrong credentials inline banner')).catch(() => no('wrong credentials inline banner'));

// ---- signup with password strength + username availability + double submit
await page.goto(BASE + '/signup');
await fill('Full name', U.fullName);
await fill('Username', U.username);
await page.getByLabel('Email').fill(U.email);
await pw().fill('abc');
await page.getByText('Weak', { exact: true }).waitFor({ timeout: 3000 }).then(() => ok('strength weak')).catch(() => no('strength weak'));
await pw().fill(U.password);
check('strength strong/good', await page.getByText(/Strength: (Strong|Good)/).isVisible());
await page.getByLabel('Show password').click();
check('show password toggles type', (await pw().getAttribute('type')) === 'text');
await page.getByLabel('Username available').waitFor({ timeout: 5000 }).then(() => ok('username availability: available indicator')).catch(() => no('username availability: available indicator'));
let regCalls = 0;
page.on('request', (r) => { if (r.url().endsWith('/auth/register') && r.method() === 'POST') regCalls++; });
await page.getByRole('button', { name: 'Create account' }).dblclick();
await page.waitForURL(/verify-otp/, { timeout: 8000 });
check('double-click submit -> exactly 1 register request', regCalls === 1, `calls=${regCalls}`);
check('redirected to OTP with email', url().searchParams.get('email') === U.email);
await shot('verify-otp-live');

// ---- OTP: wrong code, backspace, paste right code
await sleep(500);
const boxes = page.getByRole('group', { name: /verification code/ }).locator('input');
check('6 otp boxes', (await boxes.count()) === 6);
await boxes.nth(0).click();
await page.keyboard.type('111111');
await page.getByText(/Incorrect code|Invalid or expired/).first().waitFor({ timeout: 5000 }).then(() => ok('wrong OTP -> readable error')).catch(() => no('wrong OTP error'));
await sleep(300);
check('boxes cleared after failure', (await boxes.nth(0).inputValue()) === '');
await boxes.nth(0).click();
await page.keyboard.type('12');
await page.keyboard.press('Backspace');
await page.keyboard.press('Backspace');
check('backspace moves back & clears', (await boxes.nth(0).inputValue()) === '' && (await boxes.nth(1).inputValue()) === '');
check('resend countdown visible', await page.getByText(/Resend code in/).isVisible());
const otp = lastOtp(U.email);
check('OTP read from API log', /^\d{6}$/.test(otp || ''), String(otp));
await boxes.nth(0).click();
await page.evaluate((code) => {
  const el = document.activeElement;
  const dt = new DataTransfer();
  dt.setData('text', code);
  el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}, otp);
await page.waitForURL((u) => u.pathname === '/', { timeout: 8000 }).then(() => ok('paste + auto-submit -> logged in, on home')).catch(() => no('paste + auto-submit', page.url()));
check('token stored', !!(await page.evaluate(() => localStorage.getItem('rrb-token'))));
await page.getByRole('button', { name: 'Account menu' }).first().waitFor({ timeout: 4000 }).then(() => ok('avatar menu visible')).catch(() => no('avatar menu visible'));
await shot('home-logged-in');

// ---- reload stays logged in, no login flash
await page.addInitScript(() => {
  window.__seen = 0;
  new MutationObserver(() => { if (document.querySelector('header') && /Log in/.test(document.querySelector('header').innerText)) window.__seen++; }).observe(document, { childList: true, subtree: true });
});
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Account menu' }).first().waitFor({ timeout: 4000 }).then(() => ok('reload: still logged in')).catch(() => no('reload: still logged in'));
const seen = await page.evaluate(() => window.__seen);
check('reload: no "Log in" button flash in header', seen === 0, `seen=${seen}`);
await page.goto(BASE + '/change-password', { waitUntil: 'networkidle' });
check('protected route loads directly when logged in', url().pathname === '/change-password');

// ---- change password -> old fails
await page.getByRole('button', { name: 'Update password' }).click();
await page.waitForTimeout(200);
alerts = await page.locator('[role=alert]').allInnerTexts();
check('change-password empty -> inline errors', alerts.length >= 3, alerts.join(' | '));
await page.getByLabel('Current password').fill('wrongwrong1');
await page.getByLabel(/^New password/i).fill('N3wPassw0rd!');
await page.getByLabel('Confirm new password').fill('mismatch1234');
await page.getByRole('button', { name: 'Update password' }).click();
check('mismatched confirm error', await page.getByText('Passwords do not match').isVisible());
await page.getByLabel('Confirm new password').fill('N3wPassw0rd!');
await page.getByRole('button', { name: 'Update password' }).click();
await page.getByText('Current password is incorrect').first().waitFor({ timeout: 5000 }).then(() => ok('wrong current password -> field error')).catch(() => no('wrong current password field error'));
await page.getByLabel('Current password').fill(U.password);
await page.getByRole('button', { name: 'Update password' }).click();
await page.getByRole('dialog').getByText('Password changed').waitFor({ timeout: 5000 }).then(() => ok('change password success modal')).catch(() => no('change password success modal'));
await shot('change-password-done');
await page.getByRole('dialog').getByRole('button').last().click().catch(() => {});
check('still logged in after change (token rotated)', !!(await page.evaluate(() => localStorage.getItem('rrb-token'))));
await page.reload({ waitUntil: 'networkidle' });
check('reload after change still authed', url().pathname === '/change-password');

// ---- logout
await page.getByRole('button', { name: 'Account menu' }).first().click();
await shot('user-menu');
await page.keyboard.press('Escape');
await logout();
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.getByRole('link', { name: 'Log in' }).first().waitFor({ timeout: 4000 }).then(() => ok('header shows Log in after logout')).catch(() => no('header shows Log in after logout'));
await page.goto(BASE + '/change-password', { waitUntil: 'networkidle' });
check('protected route -> /login?next=', url().pathname === '/login' && url().searchParams.get('next') === '/change-password', page.url());

// ---- old password fails, new works, returns to next
await fill('Email or username', U.username);
await pw().fill(U.password);
await loginBtn().click();
await page.getByText(/invalid email\/username or password/i).waitFor({ timeout: 5000 }).then(() => ok('old password rejected after change')).catch(() => no('old password rejected'));
await pw().fill('N3wPassw0rd!');
await loginBtn().click();
await page.waitForURL(/change-password/, { timeout: 8000 }).then(() => ok('login with new password returns to ?next page')).catch(() => no('next redirect', page.url()));
await logout();

// ---- forgot -> reset -> login
await page.goto(BASE + '/forgot-password');
await page.getByRole('button', { name: 'Send reset link' }).click();
await page.getByText('Enter your email address').waitFor({ timeout: 3000 }).then(() => ok('forgot empty -> inline error')).catch(() => no('forgot empty'));
await fill('Email', U.email);
await page.getByRole('button', { name: 'Send reset link' }).click();
await page.getByRole('heading', { name: 'Check your inbox' }).waitFor({ timeout: 5000 }).then(() => ok('forgot success state')).catch(() => no('forgot success state'));
await shot('forgot-sent');
await sleep(500);
const link = lastResetLink(U.email);
check('reset link found in API log', !!link, String(link));
const rp = new URL(link);
await page.goto(BASE + rp.pathname + rp.search);
await page.getByRole('button', { name: 'Update password' }).click();
check('reset empty errors', (await page.locator('[role=alert]').count()) >= 1);
await page.getByLabel(/^New password/i).fill('R3setPassw0rd!');
await page.getByLabel('Confirm new password').fill('R3setPassw0rd!');
await page.getByRole('button', { name: 'Update password' }).click();
await page.waitForURL(/\/login/, { timeout: 8000 });
await page.getByRole('dialog').getByText('Password updated').waitFor({ timeout: 5000 }).then(() => ok('reset success -> login + modal')).catch(() => no('reset success modal'));
await page.getByRole('dialog').getByRole('button').click();
await page.goto(BASE + rp.pathname + rp.search);
await page.getByLabel(/^New password/i).fill('An0therPass!');
await page.getByLabel('Confirm new password').fill('An0therPass!');
await page.getByRole('button', { name: 'Update password' }).click();
await page.getByText(/invalid or has already been used/).waitFor({ timeout: 5000 }).then(() => ok('reused reset link -> readable error')).catch(() => no('reused reset link error'));
await page.goto(BASE + '/login');
await fill('Email or username', U.email);
await pw().fill('R3setPassw0rd!');
await loginBtn().click();
await page.waitForURL((u) => u.pathname === '/', { timeout: 8000 }).then(() => ok('login with reset password (email)')).catch(() => no('login with reset password', page.url()));

// ---- garbage token -> clean logout
await page.evaluate(() => localStorage.setItem('rrb-token', 'garbage.token.value'));
await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
check('garbage token: cleaned + sent to /login?next=/profile', url().pathname === '/login' && url().searchParams.get('next') === '/profile' && !(await page.evaluate(() => localStorage.getItem('rrb-token'))), page.url());
check('garbage token: no error modal', (await page.getByRole('dialog').count()) === 0);
check('garbage token: page not blank', (await page.locator('body').innerText()).length > 50);

// ---- unverified login -> OTP page
const U2 = { ...U, username: `unv_${stamp}`, email: `unv_${stamp}@example.com` };
await page.goto(BASE + '/signup');
await fill('Full name', U2.fullName);
await fill('Username', U2.username);
await page.getByLabel('Email').fill(U2.email);
await pw().fill(U2.password);
await page.getByRole('button', { name: 'Create account' }).click();
await page.waitForURL(/verify-otp/);
await page.goto(BASE + '/login');
await fill('Email or username', U2.email);
await pw().fill(U2.password);
await loginBtn().click();
await page.waitForURL(/verify-otp/, { timeout: 8000 }).then(() => ok('unverified login -> routed to OTP page')).catch(() => no('unverified login -> OTP', page.url()));
await page.getByText(/fresh code/).waitFor({ timeout: 5000 }).then(() => ok('unverified login: new code auto-sent')).catch(() => no('auto-sent'));

// ---- duplicate signup -> field error
await page.goto(BASE + '/signup');
await fill('Full name', U.fullName);
await fill('Username', U.username);
await page.getByLabel('Email').fill(U.email);
await pw().fill(U.password);
await page.getByLabel('Username taken').waitFor({ timeout: 5000 }).then(() => ok('username availability: taken indicator')).catch(() => no('taken indicator'));
await page.getByRole('button', { name: 'Create account' }).click();
await page.getByText(/already registered|username is taken/i).first().waitFor({ timeout: 5000 }).then(() => ok('duplicate signup -> field errors')).catch(() => no('duplicate signup errors'));

check('console errors across journeys', c.errors.length === 0, c.errors.join(' | '));
check('console warnings across journeys', c.warnings.length === 0, c.warnings.join(' | '));
console.log('network console lines (expected 4xx):', c.network.length);
await browser.close();
summary();
