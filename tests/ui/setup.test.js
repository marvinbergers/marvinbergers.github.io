// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, html, flush, click, byText, type } from './helpers.js';
import { Setup } from '../../bautagebuch/js/ui/Setup.js';
import { ApiContext } from '../../bautagebuch/js/data/api.js';
import { createMemoryApi } from '../../bautagebuch/js/data/memory.js';

const settle = async () => { for (let i = 0; i < 6; i++) await flush(); };
let api; let el;
async function setup(seed = { etagen: [{ id: 'e1', name: 'EG', sortierung: 1, plan_key: 'plaene/e1.png', plan_breite: 1000, plan_hoehe: 500, nord_grad: 0 }] }) {
  api = createMemoryApi({ seed });
  api.imageSize = vi.fn(async () => ({ width: 2000, height: 1400 }));
  vi.spyOn(api, 'put');
  el = mount(html`<${ApiContext.Provider} value=${api}><${Setup} /><//>`);
  await settle();
}
const ebene = () => el.querySelector('.setup-plan');
function tippAuf(x, y) {
  ebene().getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500 });
  ebene().dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }));
}
async function datei(input, file) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('Einrichtung', () => {
  it('Plan hochladen speichert Schlüssel und Maße', async () => {
    await setup();
    await datei(el.querySelector('input[name=plan-e1]'), new File(['x'], 'EG Plan.png', { type: 'image/png' }));
    const [e] = await api.list('etagen');
    expect(e).toMatchObject({ plan_key: 'plaene/e1-EG-Plan.png', plan_breite: 2000, plan_hoehe: 1400 });
    expect(api.put).toHaveBeenCalledWith('plaene/e1-EG-Plan.png', expect.anything(), 'image/png');
  });

  it('Nordpfeil drehen speichert nord_grad', async () => {
    await setup();
    const r = el.querySelector('input[name=nord-e1]');
    r.value = '135'; r.dispatchEvent(new Event('change', { bubbles: true })); await settle();
    expect((await api.list('etagen'))[0].nord_grad).toBe(135);
  });

  it('Raummodus: Tipp auf den Plan + Name legt einen Raum an', async () => {
    await setup();
    await click(byText(el, 'button', 'Räume'));
    tippAuf(250, 100); await settle();
    await type(el.querySelector('input[name=raumname]'), 'Bad');
    await click(byText(el, 'button', 'Hinzufügen'));
    const r = await api.list('raeume');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ etage_id: 'e1', name: 'Bad', x: 25, y: 20 });
  });

  it('Bestandsplan: Passpunkte erst nach 2 + 2 Punkten speichern', async () => {
    await setup({ etagen: [{ id: 'e1', name: 'EG', sortierung: 1, plan_key: 'plaene/e1.png', bestand_key: 'plaene/e1-alt.png' }] });
    await click(byText(el, 'button', 'Passpunkte'));
    tippAuf(100, 100); tippAuf(900, 100); tippAuf(120, 120); await settle();
    expect((await api.list('etagen'))[0].bestand_passpunkte ?? null).toBeNull();
    tippAuf(880, 130); await settle();
    const pp = (await api.list('etagen'))[0].bestand_passpunkte;
    expect(pp.plan).toEqual([{ x: 10, y: 20 }, { x: 90, y: 20 }]);
    expect(pp.bestand).toEqual([{ x: 12, y: 24 }, { x: 88, y: 26 }]);
  });

  it('Gewerk nur mit Bereich und Name', async () => {
    await setup();
    await type(el.querySelector('input[name=gewerk-name]'), 'Elektro');
    await click(byText(el, 'button', 'Gewerk anlegen'));
    expect(await api.list('gewerke')).toHaveLength(0);
    expect(el.textContent).toContain('Bereich und Name');
    await type(el.querySelector('input[name=gewerk-bereich]'), 'Technik');
    await type(el.querySelector('input[name=gewerk-din]'), '440');
    await click(byText(el, 'button', 'Gewerk anlegen'));
    expect((await api.list('gewerke'))[0]).toMatchObject({ bereich: 'Technik', name: 'Elektro', din276: '440', eigenleistung: false });
  });

  it('Haus-Koordinaten für das Wetter', async () => {
    await setup();
    await type(el.querySelector('input[name=lat]'), '51.6');
    await type(el.querySelector('input[name=lon]'), '6.2');
    await click(byText(el, 'button', 'Koordinaten speichern'));
    const e = (await api.list('einstellungen')).find((x) => x.schluessel === 'haus_koordinaten');
    expect(e.wert).toEqual({ lat: 51.6, lon: 6.2 });
  });
});

describe('Checklisten pflegen', () => {
  it('neue Checkliste mit Punkten (eine Zeile je Punkt) wird zur Standardvorlage ergänzt', async () => {
    await setup();
    await type(el.querySelector('input[name=checkliste-name]'), 'Dach');
    await type(el.querySelector('textarea[name=checkliste-punkte]'), 'vor dem Eindecken\n\nnach dem Eindecken');
    await click(byText(el, 'button', 'Checkliste anlegen'));
    const e = (await api.list('einstellungen')).find((x) => x.schluessel === 'checklisten');
    expect(e.wert.map((l) => l.name)).toEqual(['Bodenplatte', 'Dach']);
    expect(e.wert[1].punkte).toEqual(['vor dem Eindecken', 'nach dem Eindecken']);
  });
});

describe('Archiv herunterladen', () => {
  it('lädt den gewählten Monat als ZIP herunter', async () => {
    await setup();
    api.downloadZip = vi.fn();
    const m = el.querySelector('input[name=archiv-monat]');
    m.value = '2027-03'; m.dispatchEvent(new Event('input', { bubbles: true })); await settle();
    await click(byText(el, 'button', 'Archiv herunterladen')); await settle();
    expect(api.downloadZip).toHaveBeenCalledWith(expect.any(Uint8Array), 'Bautagebuch-2027-03.zip');
  });
});
