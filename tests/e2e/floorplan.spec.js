import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, stopServer, openPage, BASE } from './server.js';

describe('Grundriss im Browser (Vorschau-Modus)', () => {
  beforeAll(startServer);
  afterAll(stopServer);

  it('Raum antippen zoomt auf den Raum und zeigt die Wände; zurück zum Grundriss', async () => {
    const { browser, page } = await openPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    await page.goto(BASE + '?demo');
    const flaeche = page.locator('.plan-inhalt'); await flaeche.waitFor();
    const rahmen = await page.locator('.plan-rahmen').boundingBox();
    const b = await flaeche.boundingBox();
    await page.mouse.click(b.x + b.width * 0.2, b.y + b.height * 0.25); // Bad
    await page.locator('[data-wand="wand:a"]').waitFor();
    expect(await page.locator('[data-wand="wand:a"]').textContent()).toContain('Nordwand');
    const z = await flaeche.boundingBox();
    expect(z.width).toBeGreaterThan(b.width * 1.8); // hineingezoomt
    const fokus = await page.locator('.raum-umriss').boundingBox();
    expect(Math.abs(fokus.x + fokus.width / 2 - (rahmen.x + rahmen.width / 2))).toBeLessThan(4); // Raum mittig
    await page.getByRole('button', { name: '‹ Grundriss' }).click();
    await expect.poll(async () => (await flaeche.boundingBox()).width).toBeCloseTo(b.width, 0);
    expect(fehler).toEqual([]);
    await browser.close();
  });
});
