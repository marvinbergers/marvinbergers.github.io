// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, html, flush, click, byText } from './helpers.js';
import { CategoryPicker } from '../../bautagebuch/js/ui/CategoryPicker.js';
import { GrundrissView } from '../../bautagebuch/js/ui/GrundrissView.js';
import { ApiContext } from '../../bautagebuch/js/data/api.js';
import { createMemoryApi } from '../../bautagebuch/js/data/memory.js';
import { openQueue } from '../../bautagebuch/js/lib/queue.js';

const gewerke = [{ id: 'g1', name: 'Elektro', sortierung: 1 }, { id: 'g2', name: 'Sanitär', sortierung: 2 }];
const phasen = [{ id: 'p1', name: 'Rohbau', sortierung: 1 }, { id: 'p2', name: 'Installation', sortierung: 2 }];

describe('CategoryPicker', () => {
  it('nichts vorausgewählt', async () => {
    const el = mount(html`<${CategoryPicker} gewerke=${gewerke} phasen=${phasen} onComplete=${() => {}} />`);
    await flush();
    expect(el.querySelectorAll('button[aria-pressed="true"]')).toHaveLength(0);
  });
  it('speichert erst, wenn beides gewählt ist – genau einmal', async () => {
    const onComplete = vi.fn();
    const el = mount(html`<${CategoryPicker} gewerke=${gewerke} phasen=${phasen} onComplete=${onComplete} />`);
    await flush();
    await click(byText(el, 'button', 'Elektro'));
    expect(onComplete).not.toHaveBeenCalled();
    await click(byText(el, 'button', 'Installation'));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ gewerk_id: 'g1', phase_id: 'p2', notiz: '' });
  });
  it('zeigt 5 Gewerke, Rest hinter „mehr…“', async () => {
    const viele = Array.from({ length: 8 }, (_, i) => ({ id: `g${i}`, name: `Gewerk ${i}` }));
    const el = mount(html`<${CategoryPicker} gewerke=${viele} phasen=${phasen} onComplete=${() => {}} />`);
    await flush();
    expect(el.querySelectorAll('.gewerke button[data-id]')).toHaveLength(5);
    await click(byText(el, 'button', 'mehr…'));
    expect(el.querySelectorAll('.gewerke button[data-id]')).toHaveLength(8);
  });
});

describe('Aufnahme im Grundriss', () => {
  let interaktionen; let fileFuerNaechstenKlick; let origClick;
  beforeEach(() => {
    document.body.innerHTML = ''; localStorage.clear(); interaktionen = 0;
    fileFuerNaechstenKlick = () => new File(['foto'], 'a.jpg', { type: 'image/jpeg', lastModified: Date.UTC(2027, 2, 17, 9) });
    origClick = HTMLInputElement.prototype.click;
    // Systemkamera simulieren: Klick auf das versteckte Dateifeld liefert ein Foto (oder Abbruch).
    HTMLInputElement.prototype.click = function () {
      if (this.type !== 'file') return origClick.call(this);
      expect(this.getAttribute('capture')).toBe('environment');
      expect(this.accept).toBe('image/*');
      const f = fileFuerNaechstenKlick();
      Object.defineProperty(this, 'files', { value: f ? [f] : [], configurable: true });
      interaktionen++; // Auslösen in der Kamera
      setTimeout(() => this.dispatchEvent(new Event('change')), 0);
    };
  });
  afterEach(() => { HTMLInputElement.prototype.click = origClick; });

  async function setup() {
    const queue = await openQueue(`cap-${Math.random()}`);
    const api = createMemoryApi({ queue, seed: {
      etagen: [{ id: 'e1', name: 'EG', sortierung: 1 }],
      stellen: [{ id: 's1', etage_id: 'e1', name: 'Bad – Ostwand', x: 10, y: 10, richtung_grad: 90 }],
      gewerke,
    } });
    api.processImage = async (file) => ({ bild: new Blob(['b']), vorschau: new Blob(['v']), breite: 10, hoehe: 10,
      sha256: `${Math.random()}`, aufgenommenAm: new Date(file.lastModified), datumGeschaetzt: false });
    api.syncNow = vi.fn();
    const add = vi.spyOn(queue, 'add');
    const el = mount(html`<${ApiContext.Provider} value=${api}><${GrundrissView} /><//>`);
    for (let i = 0; i < 5; i++) await flush();
    const tipp = async (node) => { interaktionen++; await click(node); for (let i = 0; i < 3; i++) await flush(); };
    return { el, add, tipp, api };
  }

  it('Weg 1: Stelle → 📷 → Auslösen → Gewerk → Phase = 5 Interaktionen, danach „noch eins“ mit leerer Auswahl', async () => {
    const { el, add, tipp, api } = await setup();
    await tipp(el.querySelector('[data-stelle="s1"]'));
    await tipp(byText(el, 'button', '📷 Foto'));
    expect(add).toHaveBeenCalledTimes(1); // schon vor der Auswahl gesichert
    await tipp(byText(el, '.picker button', 'Elektro'));
    await tipp(byText(el, '.picker button', 'Installation'));
    expect(interaktionen).toBe(5);
    expect(add).toHaveBeenCalledTimes(1);
    const [item] = await api.queue.pending();
    const d = item.datensatz;
    expect(d).toMatchObject({ stelle_id: 's1', gewerk_id: 'g1', tag: '2027-03-17' });
    expect(d.phase_id).toBeTruthy();
    expect(el.textContent).toContain('Gespeichert');
    await tipp(byText(el, 'button', 'noch eins'));
    expect(el.querySelectorAll('.picker button[aria-pressed="true"]')).toHaveLength(0);
  });

  it('Schnellfoto: ohne Auswahl direkt in den Eingang', async () => {
    const { el, add, tipp } = await setup();
    await tipp(el.querySelector('button.schnellfoto'));
    expect(el.querySelector('.picker')).toBeNull();
    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0][0].datensatz).toMatchObject({ stelle_id: null, gewerk_id: null, phase_id: null });
    expect(el.textContent).toContain('Im Eingang');
  });

  it('Kamera abgebrochen: nichts wird angelegt', async () => {
    const { el, add, tipp } = await setup();
    fileFuerNaechstenKlick = () => null;
    await tipp(el.querySelector('button.schnellfoto'));
    expect(add).not.toHaveBeenCalled();
  });
});
