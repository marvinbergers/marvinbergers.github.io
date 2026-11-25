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

  it('neuer Raum: Ecken antippen, Fertig, Name, Speichern', async () => {
    await setup();
    await click(byText(el, 'button', 'Räume'));
    await click(byText(el, 'button', '+ Neuer Raum'));
    tippAuf(100, 50); await settle(); tippAuf(300, 50); await settle(); tippAuf(300, 200); await settle();
    tippAuf(100, 200); await settle();
    await click(byText(el, 'button', 'Fertig'));
    await type(el.querySelector('input[name=raumname]'), 'Bad');
    await click(byText(el, '.raum-editor button', 'Speichern'));
    const [r] = await api.list('raeume');
    expect(r.name).toBe('Bad');
    expect(r.ecken.map((p) => [p.x, p.y])).toEqual([[10, 10], [30, 10], [30, 40], [10, 40]]);
    expect(new Set(r.ecken.map((p) => p.id)).size).toBe(4);
  });

  it('Schließen durch Tipp auf den ersten Punkt; „Letzten Punkt zurück“', async () => {
    await setup();
    await click(byText(el, 'button', 'Räume'));
    await click(byText(el, 'button', '+ Neuer Raum'));
    tippAuf(100, 50); await settle(); tippAuf(300, 50); await settle(); tippAuf(900, 400); await settle();
    await click(byText(el, 'button', 'Letzten Punkt zurück'));
    tippAuf(300, 200); await settle();
    tippAuf(102, 51); await settle(); // nahe am ersten Punkt → schließt
    expect(el.querySelector('input[name=raumname]')).not.toBeNull();
    await type(el.querySelector('input[name=raumname]'), 'Dreieck');
    await click(byText(el, '.raum-editor button', 'Speichern'));
    expect((await api.list('raeume'))[0].ecken).toHaveLength(3);
  });

  it('Einrasten an der Ecke eines Nachbarraums', async () => {
    await setup({ etagen: [{ id: 'e1', name: 'EG', sortierung: 1, plan_key: 'plaene/e1.png', plan_breite: 1000, plan_hoehe: 500 }],
      raeume: [{ id: 'n', etage_id: 'e1', name: 'Nachbar', ecken: [{ id: 'a', x: 50, y: 50 }, { id: 'b', x: 60, y: 50 }, { id: 'c', x: 60, y: 60 }] }] });
    await click(byText(el, 'button', 'Räume'));
    await click(byText(el, 'button', '+ Neuer Raum'));
    tippAuf(505, 252); await settle(); // 50,5 % / 50,4 % → rastet auf 50/50 ein
    tippAuf(700, 250); await settle(); tippAuf(700, 400); await settle();
    await click(byText(el, 'button', 'Fertig'));
    await type(el.querySelector('input[name=raumname]'), 'Neu');
    await click(byText(el, '.raum-editor button', 'Speichern'));
    const r = (await api.list('raeume')).find((x) => x.name === 'Neu');
    expect(r.ecken.some((p) => p.x === 50 && p.y === 50)).toBe(true);
  });

  it('bearbeiten: Ecke einfügen, Ecke löschen, Ecke ziehen – erst Speichern übernimmt', async () => {
    const raum = { id: 'r', etage_id: 'e1', name: 'Bad', ecken: [{ id: 'a', x: 10, y: 10 }, { id: 'b', x: 30, y: 10 }, { id: 'c', x: 30, y: 40 }, { id: 'd', x: 10, y: 40 }] };
    await setup({ etagen: [{ id: 'e1', name: 'EG', sortierung: 1, plan_key: 'plaene/e1.png', plan_breite: 1000, plan_hoehe: 500 }], raeume: [raum] });
    await click(byText(el, 'button', 'Räume'));
    await click(el.querySelector('[data-bearbeiten="r"]'));
    await click(el.querySelector('[data-plus="a"]'));            // neue Ecke zwischen a und b
    expect(el.querySelectorAll('.ecke')).toHaveLength(5);
    await click(el.querySelector('.ecke[data-ecke="d"]'));
    await click(byText(el, 'button', 'Punkt löschen'));
    expect(el.querySelectorAll('.ecke')).toHaveLength(4);
    // Ecke c ziehen
    const ecke = el.querySelector('.ecke[data-ecke="c"]');
    ebene().getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500 });
    for (const [t, x, y] of [['pointerdown', 300, 200], ['pointermove', 350, 220], ['pointerup', 350, 220]]) {
      const e = new MouseEvent(t, { clientX: x, clientY: y, bubbles: true }); Object.defineProperty(e, 'pointerId', { value: 1 });
      (t === 'pointerdown' ? ecke : ebene()).dispatchEvent(e);
    }
    await settle();
    expect((await api.list('raeume'))[0].ecken).toHaveLength(4); // noch nicht gespeichert
    await click(byText(el, '.raum-editor button', 'Speichern'));
    const [r] = await api.list('raeume');
    expect(r.ecken.map((p) => p.id)).toHaveLength(4);
    expect(r.ecken.find((p) => p.id === 'c')).toMatchObject({ x: 35, y: 44 });
    expect(r.ecken.find((p) => p.id === 'd')).toBeUndefined();
  });

  it('„bitte prüfen“ und alte Räume ohne Ecken werden markiert', async () => {
    await setup({ etagen: [{ id: 'e1', name: 'EG', sortierung: 1, plan_key: 'plaene/e1.png', plan_breite: 1000, plan_hoehe: 500 }],
      raeume: [{ id: 'alt', etage_id: 'e1', name: 'Küche', x: 50, y: 50 },
               { id: 'p', etage_id: 'e1', name: 'Wohnen', pruefen: true, ecken: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 0 }, { id: 'c', x: 1, y: 1 }] }] });
    await click(byText(el, 'button', 'Räume'));
    expect(el.textContent).toContain('Küche – neu zeichnen');
    expect(el.textContent).toContain('Wohnen – bitte prüfen');
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
