import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

export const BASE = 'http://127.0.0.1:8099/bautagebuch/';
let srv;
export async function startServer() {
  srv = spawn('npx', ['http-server', '.', '-p', '8099', '-a', '127.0.0.1', '-c-1', '-s'], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(BASE); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server startet nicht');
}
export function stopServer() { srv?.kill(); }
export async function openPage(opts = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1, ...opts });
  const page = await ctx.newPage();
  return { browser, ctx, page };
}
