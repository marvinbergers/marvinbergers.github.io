import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, stopServer, openPage, BASE } from './server.js';

const FOTO = 'tests/fixtures/mit-exif.jpg';

describe('Gesamtablauf im Browser (Vorschau-Modus, echte Bildverarbeitung)', () => {
  beforeAll(startServer);
  afterAll(stopServer);

  it('Raum → Wand → Foto → Speichern → erscheint im Tagebuch des Aufnahmetags', async () => {
    const { browser, page } = await openPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));
    await page.goto(BASE + '?demo');
    const flaeche = page.locator('.plan-inhalt'); await flaeche.waitFor();
    const b = await flaeche.boundingBox();
    await page.mouse.click(b.x + b.width * 0.2, b.y + b.height * 0.25); // Bad
    await page.locator('[data-seite="oben"]').click(); // Nordwand
    await page.locator('.stelle-panel').waitFor();

    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: '📷 Foto' }).click()]);
    await chooser.setFiles(FOTO);
    await page.locator('.picker').waitFor();
    expect(await page.locator('.picker button[aria-pressed="true"]').count()).toBe(0);
    await page.locator('.picker .gewerke button', { hasText: 'Elektro' }).click();
    await page.locator('.picker button', { hasText: 'Speichern' }).click();
    await page.getByText('Gespeichert').waitFor();

    // Schnellfoto landet im Eingang
    await page.getByRole('button', { name: 'Fertig' }).click();
    const [ch2] = await Promise.all([page.waitForEvent('filechooser'), page.locator('button.schnellfoto').click()]);
    await ch2.setFiles('tests/fixtures/ohne-exif.jpg');
    await page.getByText('Im Eingang').waitFor();

    // Vorschau-Modus hält alles im Speicher: per Hash navigieren statt neu laden.
    await page.evaluate(() => { location.hash = '#/tagebuch?datum=2027-03-17'; }); // EXIF-Datum des Fotos
    await page.getByText('1 Foto').waitFor();
    expect(await page.locator('.tag').textContent()).toContain('Bad – Nordwand');
    await page.evaluate(() => { location.hash = '#/eingang'; });
    await page.locator('[data-foto]').first().waitFor();
    expect(await page.locator('[data-foto]').count()).toBe(1);
    expect(await page.locator('a[data-route="eingang"] .badge').textContent()).toBe('1');
    expect(fehler).toEqual([]);
    await browser.close();
  });
});

describe.skipIf(!process.env.E2E_SUPABASE_URL)('Gegen echtes Supabase (nur mit E2E_SUPABASE_URL)', () => {
  it('Anmeldemaske erscheint und fordert einen Code an', async () => {
    const { browser, page } = await openPage();
    await page.goto(process.env.E2E_APP_URL ?? 'https://marvinbergers.github.io/bautagebuch/');
    await page.locator('input[type=email]').fill(process.env.E2E_EMAIL);
    await page.getByRole('button', { name: 'Code anfordern' }).click();
    await page.locator('input[name=code]').waitFor();
    await browser.close();
  });
});
