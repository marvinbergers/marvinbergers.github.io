// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, html, flush, click, byText } from './helpers.js';
import { Inbox } from '../../bautagebuch/js/ui/Inbox.js';
import { importFiles, assignFotos } from '../../bautagebuch/js/data/inbox.js';
import { ApiContext } from '../../bautagebuch/js/data/api.js';
import { createMemoryApi } from '../../bautagebuch/js/data/memory.js';
import { openQueue } from '../../bautagebuch/js/lib/queue.js';

async function apiMit(fotos = []) {
  const queue = await openQueue(`inbox-${Math.random()}`);
  const api = createMemoryApi({ queue, seed: {
    etagen: [{ id: 'e1', name: 'EG', sortierung: 1 }],
    stellen: [{ id: 's1', etage_id: 'e1', name: 'Bad – Ostwand', x: 10, y: 10, richtung_grad: 90 }],
    gewerke: [{ id: 'g1', name: 'Elektro', sortierung: 1 }],
    fotos,
  } });
  api.processImage = async (file) => {
    const text = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsText(file); }); // jsdom-File hat kein text()
    if (text === 'kaputt') throw Object.assign(new Error('Foto konnte nicht gelesen werden'), { name: 'FotoFehler' });
    return { bild: new Blob(['b']), vorschau: new Blob(['v']), breite: 1, hoehe: 1, sha256: `h-${text}`, aufgenommenAm: new Date('2027-03-17T09:00:00Z'), datumGeschaetzt: false };
  };
  api.syncNow = vi.fn();
  return api;
}
const f = (inhalt) => new File([inhalt], `${inhalt}.jpg`, { type: 'image/jpeg' });

beforeEach(() => { document.body.innerHTML = ''; });

describe('importFiles', () => {
  it('erkennt Duplikate – im selben Import und gegenüber Vorhandenem', async () => {
    const api = await apiMit([{ id: 'alt', sha256: 'h-x', tag: '2027-03-01' }]);
    expect(await importFiles(api, [f('a'), f('a'), f('x')])).toEqual({ neu: 1, doppelt: 2, fehler: 0, meldungen: [] });
    expect(await api.queue.count()).toBe(1);
  });
  it('unlesbare Datei: Meldung, Rest wird importiert', async () => {
    const api = await apiMit();
    const r = await importFiles(api, [f('kaputt'), f('b')]);
    expect(r).toMatchObject({ neu: 1, doppelt: 0, fehler: 1 });
    expect(r.meldungen[0]).toContain('kaputt.jpg');
  });
});

describe('assignFotos', () => {
  it('setzt Stelle, Gewerk und Phase für alle', async () => {
    const api = await apiMit([{ id: 'f1', sha256: '1' }, { id: 'f2', sha256: '2' }]);
    await assignFotos(api, ['f1', 'f2'], { stelle_id: 's1', gewerk_id: 'g1', phase_id: 'p4' });
    const alle = await api.list('fotos');
    expect(alle.every((x) => x.stelle_id === 's1' && x.gewerk_id === 'g1' && x.phase_id === 'p4')).toBe(true);
  });
});

describe('Inbox', () => {
  it('zeigt nur nicht einsortierte Fotos und sortiert mehrere auf einmal ein', async () => {
    const api = await apiMit([
      { id: 'f1', sha256: '1', tag: '2027-03-17' },
      { id: 'f2', sha256: '2', tag: '2027-03-17', stelle_id: 's1' }, // Stelle ja, Gewerk/Phase fehlen → noch im Eingang
      { id: 'f3', sha256: '3', tag: '2027-03-17', stelle_id: 's1', gewerk_id: 'g1', phase_id: 'p1' },
    ]);
    const el = mount(html`<${ApiContext.Provider} value=${api}><${Inbox} /><//>`);
    for (let i = 0; i < 4; i++) await flush();
    expect(el.querySelectorAll('[data-foto]')).toHaveLength(2);
    await click(el.querySelector('[data-foto="f1"]'));
    await click(el.querySelector('[data-foto="f2"]'));
    await click(byText(el, 'button', 'Einsortieren (2)'));
    for (let i = 0; i < 3; i++) await flush();
    await click(el.querySelector('[data-stelle="s1"]'));
    await click(byText(el, '.picker button', 'Elektro'));
    await click(byText(el, '.picker button', 'Installation'));
    for (let i = 0; i < 4; i++) await flush();
    expect(el.querySelectorAll('[data-foto]')).toHaveLength(0);
  });

  it('übernimmt beim Öffnen geteilte Dateien', async () => {
    const api = await apiMit();
    await api.queue.addShared([f('geteilt')]);
    mount(html`<${ApiContext.Provider} value=${api}><${Inbox} /><//>`);
    for (let i = 0; i < 6; i++) await flush();
    expect(await api.queue.count()).toBe(1); // importiert und in der Warteschlange
    expect(api.syncNow).toHaveBeenCalled();
    expect(await api.queue.takeShared()).toHaveLength(0);
  });
});
