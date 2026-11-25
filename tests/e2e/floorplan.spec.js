import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, stopServer, openPage, BASE } from './server.js';

describe('Grundriss im Browser (Vorschau-Modus)', () => {
  beforeAll(startServer);
  afterAll(stopServer);

  it('Stelle per Ziehen anlegen; Zwei-Finger-Zoom vergrößert, Stelle bleibt am Planpunkt', async () => {
    const { browser, page } = await openPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    await page.goto(BASE + '?demo');
    const flaeche = page.locator('.plan-inhalt');
    await flaeche.waitFor();
    const box = await flaeche.boundingBox();
    const sx = box.x + box.width * 0.2; const sy = box.y + box.height * 0.3;
    await page.mouse.move(sx, sy); await page.mouse.down();
    await page.mouse.move(sx + 60, sy, { steps: 5 }); await page.mouse.up();
    await page.locator('input[name=stellenname]').waitFor();
    expect(await page.locator('input[name=stellenname]').inputValue()).toBe('Bad – Ostwand');
    await page.getByRole('button', { name: 'Anlegen' }).click();
    const stelle = page.locator('.stelle').first();
    await stelle.waitFor();
    const vorher = await stelle.boundingBox();

    const cdp = await page.context().newCDPSession(page);
    const mx = box.x + box.width / 2; const my = box.y + box.height / 2;
    const tp = (d) => [{ x: mx - d, y: my, id: 1 }, { x: mx + d, y: my, id: 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(40) });
    for (let d = 50; d <= 120; d += 10) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(d) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    const nachher = await flaeche.boundingBox();
    expect(nachher.width).toBeGreaterThan(box.width * 1.5);
    // Stelle liegt weiterhin auf demselben relativen Planpunkt (20 % / 30 %).
    const s2 = await stelle.boundingBox();
    const relX = (s2.x + s2.width / 2 - nachher.x) / nachher.width;
    expect(relX).toBeCloseTo(0.2, 1);
    expect(vorher).toBeTruthy();
    expect(fehler).toEqual([]);
    await browser.close();
  });
});
