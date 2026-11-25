// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, html, flush, click, byText, type } from './helpers.js';
import { FloorPlan } from '../../bautagebuch/js/ui/FloorPlan.js';
import { StellePanel } from '../../bautagebuch/js/ui/StellePanel.js';
import { filterStellen, pickEtage } from '../../bautagebuch/js/lib/filter.js';
import { mergeStellen } from '../../bautagebuch/js/data/actions.js';
import { createMemoryApi } from '../../bautagebuch/js/data/memory.js';

const etage = { id: 'e1', name: 'EG', plan_key: 'plaene/eg.png', plan_breite: 1000, plan_hoehe: 1000, nord_grad: 0 };
const raeume = [{ name: 'Bad', x: 12, y: 12 }, { name: 'Küche', x: 80, y: 80 }];
const stellen = [{ id: 's1', name: 'Küche – Nordwand', x: 80, y: 80, richtung_grad: 0 }];

function ptr(el, type, x, y, id = 1) {
  const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(e, 'pointerId', { value: id });
  el.dispatchEvent(e);
}

async function setup(props = {}) {
  const cb = { onSelectStelle: vi.fn(), onCreateStelle: vi.fn(), onQuickPhoto: vi.fn() };
  const el = mount(html`<${FloorPlan} etage=${etage} planUrl="x.png" stellen=${stellen} raeume=${raeume} ...${cb} ...${props} />`);
  await flush();
  const flaeche = el.querySelector('.plan-inhalt');
  flaeche.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000, right: 1000, bottom: 1000 });
  return { el, cb, flaeche };
}

beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

describe('Etagenwahl', () => {
  it('öffnet die zuletzt benutzte Etage, sonst die erste', () => {
    const etagen = [{ id: 'a', sortierung: 1 }, { id: 'b', sortierung: 2 }];
    expect(pickEtage(etagen, null).id).toBe('a');
    expect(pickEtage(etagen, 'b').id).toBe('b');
    expect(pickEtage(etagen, 'weg').id).toBe('a');
  });
});

describe('FloorPlan', () => {
  it('Drücken und Ziehen schlägt eine neue Stelle mit Namen vor', async () => {
    const { el, cb, flaeche } = await setup();
    ptr(flaeche, 'pointerdown', 100, 100);
    ptr(flaeche, 'pointermove', 150, 100);
    ptr(flaeche, 'pointerup', 200, 100);
    await flush();
    const name = el.querySelector('input[name=stellenname]');
    expect(name.value).toBe('Bad – Ostwand');
    await click(byText(el, 'button', 'Anlegen'));
    expect(cb.onCreateStelle).toHaveBeenCalledWith({ x: 10, y: 10, richtung_grad: 90, name: 'Bad – Ostwand' });
  });

  it('kurzer Tipp auf leere Fläche setzt keine Stelle', async () => {
    const { el, cb, flaeche } = await setup();
    ptr(flaeche, 'pointerdown', 100, 100);
    ptr(flaeche, 'pointerup', 101, 100);
    await flush();
    expect(el.querySelector('input[name=stellenname]')).toBeNull();
    expect(cb.onCreateStelle).not.toHaveBeenCalled();
  });

  it('Tipp auf eine Stelle wählt sie', async () => {
    const { el, cb } = await setup();
    await click(el.querySelector('[data-stelle="s1"]'));
    expect(cb.onSelectStelle).toHaveBeenCalledWith(stellen[0]);
  });

  it('Stellen bleiben beim Zoomen gleich groß auf dem Bildschirm', async () => {
    const { el } = await setup();
    const vorher = el.querySelector('[data-stelle="s1"]').getAttribute('style');
    expect(vorher).toMatch(/scale\(1\)/);
    await click(el.querySelector('button[aria-label="Vergrößern"]'));
    await click(el.querySelector('button[aria-label="Vergrößern"]'));
    const nachher = el.querySelector('[data-stelle="s1"]').getAttribute('style');
    const f = Number(nachher.match(/scale\(([\d.]+)\)/)[1]);
    expect(f).toBeCloseTo(1 / 1.96, 3); // Gegenskalierung zum Zoom 1,4 × 1,4
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

  it('Verschieben-Modus: Ziehen ändert die Stelle statt neue anzulegen', async () => {
    const onMoveStelle = vi.fn();
    const { flaeche, cb } = await setup({ verschiebe: stellen[0], onMoveStelle });
    ptr(flaeche, 'pointerdown', 500, 500);
    ptr(flaeche, 'pointerup', 500, 400);
    await flush();
    expect(onMoveStelle).toHaveBeenCalledWith('s1', { x: 50, y: 50, richtung_grad: 0 });
    expect(cb.onCreateStelle).not.toHaveBeenCalled();
  });
});

describe('Filter', () => {
  it('blendet Stellen ohne passende Fotos aus', () => {
    const st = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const fotos = [{ stelle_id: 'a', gewerk_id: 'elektro', phase_id: 'p1' }, { stelle_id: 'b', gewerk_id: 'sanitaer', phase_id: 'p4' }];
    expect(filterStellen(st, fotos, { gewerk_id: 'elektro' }).map((s) => s.id)).toEqual(['a']);
    expect(filterStellen(st, fotos, { phase_id: 'p4' }).map((s) => s.id)).toEqual(['b']);
    expect(filterStellen(st, fotos, {}).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('StellePanel und Aktionen', () => {
  const phasen = [{ id: 'p1', name: 'Bestand vor Umbau', sortierung: 1 }, { id: 'p4', name: 'Installation', sortierung: 4 }];
  it('zeigt Name, Anzahl und Zeitleiste nach Phase', async () => {
    const fotos = [{ id: 'f1', phase_id: 'p4', tag: '2027-03-17' }, { id: 'f2', phase_id: 'p1', tag: '2027-01-02' }];
    const el = mount(html`<${StellePanel} stelle=${stellen[0]} fotos=${fotos} phasen=${phasen} stellen=${stellen} thumb=${() => ''} />`);
    await flush();
    expect(el.textContent).toContain('Küche – Nordwand');
    expect(el.textContent).toContain('2 Fotos');
    const kopf = [...el.querySelectorAll('.zeitleiste h4')].map((h) => h.textContent);
    expect(kopf[0]).toContain('Bestand vor Umbau');
    expect(kopf[1]).toContain('Installation');
  });

  it('Umbenennen speichert den Namen', async () => {
    const onRename = vi.fn();
    const el = mount(html`<${StellePanel} stelle=${stellen[0]} fotos=${[]} phasen=${phasen} stellen=${stellen} thumb=${() => ''} onRename=${onRename} />`);
    await flush();
    await click(byText(el, 'button', 'Umbenennen'));
    await type(el.querySelector('input[name=neuername]'), 'Küche – Spüle');
    await click(byText(el, 'button', 'Speichern'));
    expect(onRename).toHaveBeenCalledWith('Küche – Spüle');
  });

  it('Zusammenlegen hängt Fotos um und löscht die Quelle in den Papierkorb', async () => {
    const api = createMemoryApi({ seed: { stellen: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], fotos: [{ id: 'f', stelle_id: 'a', sha256: 'x' }] } });
    await mergeStellen(api, 'a', 'b');
    expect((await api.list('fotos'))[0].stelle_id).toBe('b');
    expect((await api.list('stellen')).map((s) => s.id)).toEqual(['b']);
    expect((await api.listDeleted('stellen')).map((s) => s.id)).toEqual(['a']);
  });
});
