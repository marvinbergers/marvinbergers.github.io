// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, html, flush, click, byText } from './helpers.js';
import { FloorPlan } from '../../bautagebuch/js/ui/FloorPlan.js';
import { StellePanel } from '../../bautagebuch/js/ui/StellePanel.js';
import { filterStellen, pickEtage } from '../../bautagebuch/js/lib/filter.js';

const etage = { id: 'e1', name: 'EG', plan_key: 'plaene/eg.png', plan_breite: 1000, plan_hoehe: 1000, nord_grad: 0 };
const P = (id, x, y) => ({ id, x, y });
const bad = { id: 'bad', name: 'Bad', ecken: [P('a', 0, 0), P('b', 20, 0), P('c', 20, 30), P('d', 0, 30)] };
const kueche = { id: 'ku', name: 'Küche', ecken: [P('a', 50, 0), P('b', 100, 0), P('c', 100, 40), P('d', 50, 40)] };

async function setup(props = {}) {
  const cb = { onRoom: vi.fn(), onWand: vi.fn(), onQuickPhoto: vi.fn() };
  const el = mount(html`<${FloorPlan} etage=${etage} planUrl="x.png" raeume=${[bad, kueche]} raumZahlen=${{ bad: 3 }} ...${cb} ...${props} />`);
  await flush();
  const flaeche = el.querySelector('.plan-inhalt');
  flaeche.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000, right: 1000, bottom: 1000 });
  return { el, cb, flaeche };
}
const tippe = async (el, x, y) => { el.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true })); await flush(); };

beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

describe('Etagenwahl', () => {
  it('öffnet die zuletzt benutzte Etage, sonst die erste', () => {
    const etagen = [{ id: 'a', sortierung: 1 }, { id: 'b', sortierung: 2 }];
    expect(pickEtage(etagen, null).id).toBe('a');
    expect(pickEtage(etagen, 'b').id).toBe('b');
    expect(pickEtage(etagen, 'weg').id).toBe('a');
  });
});

describe('FloorPlan mit Räumen', () => {
  it('Tipp in eine Raumfläche wählt den Raum', async () => {
    const { cb, flaeche } = await setup();
    await tippe(flaeche, 100, 100);
    expect(cb.onRoom).toHaveBeenCalledWith(bad);
  });
  it('Tipp neben alle Räume tut nichts', async () => {
    const { cb, flaeche } = await setup();
    await tippe(flaeche, 300, 800);
    expect(cb.onRoom).not.toHaveBeenCalled();
  });
  it('Übersicht: je Raum nur ein schlichter Punkt – keine Flächen, keine Zahl, kein Symbol', async () => {
    const { el, cb } = await setup();
    expect(el.querySelectorAll('.raum-svg polygon')).toHaveLength(0);
    const punkt = el.querySelector('.raum-punkt[data-raum="bad"]');
    expect(punkt).not.toBeNull();
    expect(punkt.textContent.trim()).toBe('');
    expect([punkt.style.left, punkt.style.top]).toEqual(['10%', '15%']);
    await click(punkt);
    expect(cb.onRoom).toHaveBeenCalledWith(bad);
  });
  it('L-Raum: Punkt liegt sicher im Raum', async () => {
    const l = { id: 'l', name: 'Wohnen', ecken: [P('a', 0, 0), P('b', 40, 0), P('c', 40, 20), P('d', 20, 20), P('e', 20, 60), P('f', 0, 60)] };
    const { el, cb, flaeche } = await setup({ raeume: [l] });
    const p = el.querySelector('.raum-punkt[data-raum="l"]');
    expect(parseFloat(p.style.left)).toBeLessThan(20);
    await tippe(flaeche, 300, 100); // oberer Teil des L
    expect(cb.onRoom).toHaveBeenCalledWith(l);
  });
  it('kein Ziehen mehr: Drücken und Ziehen legt nichts an', async () => {
    const { el, cb, flaeche } = await setup();
    for (const [t, x] of [['pointerdown', 300], ['pointermove', 400], ['pointerup', 500]]) {
      const e = new MouseEvent(t, { clientX: x, clientY: 800, bubbles: true }); Object.defineProperty(e, 'pointerId', { value: 1 }); flaeche.dispatchEvent(e);
    }
    await flush();
    expect(el.querySelector('input[name=stellenname]')).toBeNull();
    expect(cb.onRoom).not.toHaveBeenCalled();
  });
  it('Raumansicht: ein Knopf je Wandlinie (mit Namen und Zahl) plus Boden und Decke', async () => {
    const { el, cb } = await setup({ aktiverRaum: bad, wandZahlen: { 'wand:a': 2, boden: 1 } });
    const knoepfe = [...el.querySelectorAll('[data-wand]')].map((k) => k.dataset.wand);
    expect(knoepfe.sort()).toEqual(['boden', 'decke', 'wand:a', 'wand:b', 'wand:c', 'wand:d']);
    expect(el.querySelector('[data-wand="wand:a"]').textContent).toContain('Nordwand');
    expect(el.querySelector('[data-wand="wand:a"]').textContent).toContain('2');
    expect(el.querySelector('[data-wand="wand:b"]').textContent).toContain('Ostwand');
    expect(el.querySelectorAll('.raum-svg polygon')).toHaveLength(1); // Umriss hervorgehoben
    await click(el.querySelector('[data-wand="wand:c"]'));
    expect(cb.onWand).toHaveBeenCalledWith({ seite: 'wand', kante: 'c' });
    await click(el.querySelector('[data-wand="boden"]'));
    expect(cb.onWand).toHaveBeenCalledWith({ seite: 'boden' });
  });
  it('Raumansicht: „‹ Grundriss“ führt zurück', async () => {
    const { el, cb } = await setup({ aktiverRaum: bad });
    await click(byText(el, 'button', 'Grundriss'));
    expect(cb.onRoom).toHaveBeenCalledWith(null);
  });
  it('Schnellfoto-Knopf ist immer da', async () => {
    const { el, cb } = await setup();
    await click(el.querySelector('button.schnellfoto'));
    expect(cb.onQuickPhoto).toHaveBeenCalled();
  });
  it('Bestandsplan-Schalter nur mit Bestandsplan', async () => {
    const ohne = await setup();
    expect(ohne.el.querySelector('.bestand-schalter')).toBeNull();
    document.body.innerHTML = '';
    const mit = await setup({ etage: { ...etage, bestand_key: 'plaene/alt.png', bestand_passpunkte: { plan: [{ x: 0, y: 0 }, { x: 100, y: 0 }], bestand: [{ x: 0, y: 0 }, { x: 100, y: 0 }] } }, bestandUrl: 'alt.png' });
    expect(mit.el.querySelector('.bestand-schalter')).not.toBeNull();
  });
  it('Räume ohne passende Fotos werden beim Filtern abgedunkelt', async () => {
    const { el } = await setup({ gedimmt: new Set(['ku']) });
    expect(el.querySelector('.raum-punkt[data-raum="ku"]').classList.contains('gedimmt')).toBe(true);
    expect(el.querySelector('.raum-punkt[data-raum="bad"]').classList.contains('gedimmt')).toBe(false);
  });
});

describe('Filter', () => {
  it('blendet Stellen ohne passende Fotos aus', () => {
    const st = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const fotos = [{ stelle_id: 'a', gewerk_id: 'elektro', phase_id: 'p1' }, { stelle_id: 'b', gewerk_id: 'sanitaer', phase_id: 'p4' }];
    expect(filterStellen(st, fotos, { gewerk_id: 'elektro' }).map((s) => s.id)).toEqual(['a']);
    expect(filterStellen(st, fotos, {}).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('Wand-Ansicht', () => {
  const phasen = [{ id: 'p1', name: 'Bestand vor Umbau', sortierung: 1 }, { id: 'p4', name: 'Installation', sortierung: 4 }];
  it('zeigt Titel, Anzahl und Zeitleiste nach Phase', async () => {
    const fotos = [{ id: 'f1', phase_id: 'p4', tag: '2027-03-17' }, { id: 'f2', phase_id: 'p1', tag: '2027-01-02' }, { id: 'f3', tag: '2027-01-03' }];
    const el = mount(html`<${StellePanel} titel="Bad – Nordwand" fotos=${fotos} phasen=${phasen} thumb=${() => ''} />`);
    await flush();
    expect(el.textContent).toContain('Bad – Nordwand');
    expect(el.textContent).toContain('3 Fotos');
    const kopf = [...el.querySelectorAll('.zeitleiste h4')].map((h) => h.textContent);
    expect(kopf[0]).toContain('Bestand vor Umbau');
    expect(kopf[1]).toContain('Installation');
    expect(kopf[2]).toContain('Ohne Phase');
  });
});
