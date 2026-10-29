// Shared helpers for the Playwright scripts. Run from repo root: node apps/web/e2e/<script>.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

export const BASE = process.env.WEB_URL || 'http://localhost:5173';
export const OUT = process.env.SHOTS_DIR || path.resolve('apps/web/e2e/.shots');
export const API_LOG = process.env.API_LOG || '';
fs.mkdirSync(OUT, { recursive: true });

export const results = [];
export const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
};
export const summary = () => {
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed`);
  if (bad.length) console.log('FAILED:\n' + bad.map((b) => ' - ' + b.name + ' ' + b.detail).join('\n'));
  process.exitCode = bad.length ? 1 : 0;
};

export async function launch(opts = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  return { browser, ctx };
}

/** Attach console collectors. Returns {errors, warnings, network} arrays; network = failed requests / 4xx-5xx console lines. */
export function watch(page) {
  const w = { errors: [], warnings: [], network: [] };
  page.on('console', (m) => {
    const t = m.text();
    const net = /Failed to load resource|ERR_CONNECTION|net::ERR/.test(t);
    if (m.type() === 'error') (net ? w.network : w.errors).push(t);
    else if (m.type() === 'warning') w.warnings.push(t);
  });
  page.on('pageerror', (e) => w.errors.push('pageerror: ' + e.message));
  return w;
}

export const hasHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

const esc = (e) => e.replace(/[.+*?^${}()|[\]\\]/g, '\\$&');
const scan = (re) => {
  const log = fs.readFileSync(API_LOG, 'utf8');
  let m, last;
  while ((m = re.exec(log))) last = m[1];
  return last;
};
export const lastOtp = (email) => scan(new RegExp(`To: ${esc(email)}\\r?\\nSubject: Your Restaurant Review Box verification code[\\s\\S]*?code is (\\d{6})`, 'g'));
export const lastResetLink = (email) => scan(new RegExp(`To: ${esc(email)}\\r?\\nSubject: Reset[\\s\\S]*?(http\\S+reset-password\\S+)`, 'g'));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
