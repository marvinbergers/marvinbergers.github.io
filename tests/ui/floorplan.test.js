// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, html, flush, click, byText } from './helpers.js';
import { FloorPlan } from '../../bautagebuch/js/ui/FloorPlan.js';
import { StellePanel } from '../../bautagebuch/js/ui/StellePanel.js';
import { filterStellen, pickEtage } from '../../bautagebuch/js/lib/filter.js';

const etage = { id: 'e1', name: 'EG', plan_key: 'plaene/eg.png', plan_breite: 1000, plan_hoehe: 1000, nord_grad: 0 };
const bad = { id: 'bad', name: 'Bad', flaechen: [{ x1: 0, y1: 0, x2: 20, y2: 30 }] };
const kueche = { id: 'ku', name: 'Küche', flaechen: [{ x1: 50, y1: 0, x2: 100, y2: 40 }] };

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
    expect(el.querySelectorAll('.raum-flaeche')).toHaveLength(0);
    const punkt = el.querySelector('.raum-punkt[data-raum="bad"]');
    expect(punkt).not.toBeNull();
    expect(punkt.textContent.trim()).toBe('');
    expect([punkt.style.left, punkt.style.top]).toEqual(['10%', '15%']);
    await click(punkt);
    expect(cb.onRoom).toHaveBeenCalledWith(bad);
  });
  it('L-Raum: Punkt liegt in der Mitte des größten Rechtecks', async () => {
    const l = { id: 'l', name: 'Wohnen', flaechen: [{ x1: 30, y1: 50, x2: 40, y2: 60 }, { x1: 30, y1: 0, x2: 60, y2: 50 }] };
    const { el } = await setup({ raeume: [l] });
    const p = el.querySelector('.raum-punkt[data-raum="l"]');
    expect([p.style.left, p.style.top]).toEqual(['45%', '25%']);
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
  it('Raumansicht: sechs Wandknöpfe mit Namen aus dem Nordpfeil und Zahlen', async () => {
    const { el, cb } = await setup({ aktiverRaum: bad, wandZahlen: { oben: 2, boden: 1 } });
    const knoepfe = [...el.querySelectorAll('[data-seite]')];
    expect(knoepfe.map((k) => k.dataset.seite).sort()).toEqual(['boden', 'decke', 'links', 'oben', 'rechts', 'unten']);
    expect(el.querySelector('[data-seite="oben"]').textContent).toContain('Nordwand');
    expect(el.querySelector('[data-seite="oben"]').textContent).toContain('2');
    expect(el.querySelector('[data-seite="rechts"]').textContent).toContain('Ostwand');
    await click(el.querySelector('[data-seite="boden"]'));
    expect(cb.onWand).toHaveBeenCalledWith('boden');
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
