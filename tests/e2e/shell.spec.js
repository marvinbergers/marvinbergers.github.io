import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, stopServer, openPage, BASE } from './server.js';

describe('App-Hülle', () => {
  beforeAll(startServer);
  afterAll(stopServer);
  it('zeigt drei Reiter und registriert den Service Worker', async () => {
    const { browser, page } = await openPage();
    const fehler = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    await page.goto(BASE + '?demo'); // ohne ?demo würde die echte Anmeldung erscheinen
    await page.waitForSelector('nav.tabs a');
    expect(fehler).toEqual([]);
    expect(await page.locator('.demo').textContent()).toContain('Vorschau');
    const tabs = await page.locator('nav.tabs a').allTextContents();
    expect(tabs.map((t) => t.trim())).toEqual(['Grundriss', 'Tagebuch', 'Eingang']);
    const sw = await page.evaluate(async () => !!(await navigator.serviceWorker.ready).active);
    expect(sw).toBe(true);
    await page.click('a[data-route="tagebuch"]');
    await expect.poll(() => page.locator('nav a.aktiv').textContent()).toContain('Tagebuch');
    await browser.close();
  });
});
