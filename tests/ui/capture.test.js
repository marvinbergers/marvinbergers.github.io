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
  it('Speichern ohne Auswahl ist möglich', async () => {
    const onComplete = vi.fn();
    const el = mount(html`<${CategoryPicker} gewerke=${gewerke} phasen=${phasen} onComplete=${onComplete} />`);
    await flush();
    await click(byText(el, 'button', 'Speichern'));
    expect(onComplete).toHaveBeenCalledWith({ gewerk_id: null, phase_id: null, notiz: '' });
  });
  it('Auswahl wird erst mit Speichern übernommen; nochmal tippen wählt ab', async () => {
    const onComplete = vi.fn();
    const el = mount(html`<${CategoryPicker} gewerke=${gewerke} phasen=${phasen} onComplete=${onComplete} />`);
    await flush();
    await click(byText(el, '.gewerke button', 'Elektro'));
    await click(byText(el, '.phasen button', 'Installation'));
    expect(onComplete).not.toHaveBeenCalled();
    await click(byText(el, '.phasen button', 'Installation')); // abgewählt
    await click(byText(el, 'button', 'Speichern'));
    expect(onComplete).toHaveBeenCalledWith({ gewerk_id: 'g1', phase_id: null, notiz: '' });
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
      etagen: [{ id: 'e1', name: 'EG', sortierung: 1, nord_grad: 0 }],
      raeume: [{ id: 'bad', etage_id: 'e1', name: 'Bad', ecken: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 20, y: 0 }, { id: 'c', x: 20, y: 30 }, { id: 'd', x: 0, y: 30 }] }],
      gewerke,
    } });
    api.processImage = async (file) => ({ bild: new Blob(['b']), vorschau: new Blob(['v']), breite: 10, hoehe: 10,
      sha256: `${Math.random()}`, aufgenommenAm: new Date(file.lastModified), datumGeschaetzt: false });
    api.syncNow = vi.fn();
    const add = vi.spyOn(queue, 'add');
    const el = mount(html`<${ApiContext.Provider} value=${api}><${GrundrissView} /><//>`);
    for (let i = 0; i < 5; i++) await flush();
    const f = el.querySelector('.plan-inhalt');
    if (f) f.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000 });
    const tipp = async (node) => { interaktionen++; await click(node); for (let i = 0; i < 3; i++) await flush(); };
    return { el, add, tipp, api };
  }

  it('Raum → Wand → 📷 → Auslösen → Speichern = 5 Interaktionen; Foto hängt an der Wand', async () => {
    const { el, add, tipp, api } = await setup();
    interaktionen++; el.querySelector('.plan-inhalt').dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100, bubbles: true }));
    for (let i = 0; i < 4; i++) await flush();
    await tipp(el.querySelector('[data-wand="wand:a"]'));
    await tipp(byText(el, 'button', '📷 Foto'));
    expect(add).toHaveBeenCalledTimes(1); // schon vor dem Speichern gesichert
    expect(el.querySelectorAll('.picker button[aria-pressed="true"]')).toHaveLength(0);
    await tipp(byText(el, '.picker button', 'Speichern'));
    expect(interaktionen).toBe(5);
    const [item] = await api.queue.pending();
    const wand = (await api.list('stellen'))[0];
    expect(wand).toMatchObject({ raum_id: 'bad', seite: 'wand', kante: 'a', name: 'Bad – Nordwand' });
    expect(item.datensatz).toMatchObject({ stelle_id: wand.id, gewerk_id: null, phase_id: null, tag: '2027-03-17' });
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
