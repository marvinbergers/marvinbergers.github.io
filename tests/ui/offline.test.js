// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, html, flush, click, byText } from './helpers.js';
import { AuthGate } from '../../bautagebuch/js/ui/Login.js';
import { onAuthChange } from '../../bautagebuch/js/data/supabase.js';
import { withOfflineCache } from '../../bautagebuch/js/data/offline.js';
import { GrundrissView } from '../../bautagebuch/js/ui/GrundrissView.js';
import { Inbox } from '../../bautagebuch/js/ui/Inbox.js';
import { importFiles } from '../../bautagebuch/js/data/inbox.js';
import { ApiContext } from '../../bautagebuch/js/data/api.js';
import { createMemoryApi } from '../../bautagebuch/js/data/memory.js';
import { openQueue } from '../../bautagebuch/js/lib/queue.js';
import { syncOnce } from '../../bautagebuch/js/data/sync.js';

const settle = async () => { for (let i = 0; i < 8; i++) await flush(); };
beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });
const fakeProcess = async (file) => {
  const text = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsText(file); });
  return { bild: new Blob(['b']), vorschau: new Blob(['v']), breite: 1, hoehe: 1, sha256: `h-${text}`, aufgenommenAm: new Date('2027-03-17T09:00:00Z'), datumGeschaetzt: false };
};
const offline = (api) => { for (const m of ['list', 'insert', 'update']) api[m] = vi.fn(async () => { throw new TypeError('Failed to fetch'); }); return api; };

describe('C1: Anmeldung ohne Netzabfrage', () => {
  it('AuthGate gibt die Sitzung an onSignedIn weiter', async () => {
    let cb;
    const onSignedIn = vi.fn();
    mount(html`<${AuthGate} auth=${{ onAuthChange: (f) => { cb = f; } }} onSignedIn=${onSignedIn}><p>App</p><//>`);
    await settle();
    const session = { user: { id: 'u1', email: 'a@example.org' } };
    cb('SIGNED_IN', session); await settle();
    expect(onSignedIn).toHaveBeenCalledWith(session);
  });
});

describe('C2a: gespeicherte Sitzung gilt offline als angemeldet', () => {
  it('Token abgelaufen und kein Netz → gespeicherte Sitzung wird genutzt', async () => {
    localStorage.setItem('bautagebuch-auth', JSON.stringify({ access_token: 'x', refresh_token: 'y', user: { id: 'u1', email: 'a@example.org' } }));
    const client = { auth: { getSession: async () => ({ data: { session: null }, error: { name: 'AuthRetryableFetchError' } }), onAuthStateChange: () => {} } };
    const cb = vi.fn();
    onAuthChange(client, cb); await settle();
    expect(cb).toHaveBeenCalledWith('SIGNED_IN', expect.objectContaining({ user: expect.objectContaining({ id: 'u1' }) }));
  });
  it('ohne gespeicherte Sitzung → abgemeldet', async () => {
    const client = { auth: { getSession: async () => ({ data: { session: null }, error: null }), onAuthStateChange: () => {} } };
    const cb = vi.fn();
    onAuthChange(client, cb); await settle();
    expect(cb).toHaveBeenCalledWith('SIGNED_OUT', null);
  });
});

describe('C2b: Offline-Zwischenspeicher', () => {
  it('liefert offline die zuletzt geladenen Listen und Pläne', async () => {
    const basis = createMemoryApi({ seed: { etagen: [{ id: 'e1', name: 'EG', plan_key: 'plaene/e1.png' }] }, seedBlobs: { 'plaene/e1.png': new Blob(['plan']) } });
    basis.fetchBlob = vi.fn(async () => new Blob(['plan']));
    const api = await withOfflineCache(basis, { name: `cache-${Math.random()}` });
    expect(await api.list('etagen')).toHaveLength(1);
    await api.url('plaene/e1.png');
    offline(basis);
    basis.fetchBlob = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    expect((await api.list('etagen'))[0].name).toBe('EG');
    expect(await api.url('plaene/e1.png')).toBeTruthy();
  });

  it('Schnellfoto-Knopf ist auch ohne Daten sichtbar', async () => {
    const api = offline(createMemoryApi());
    const el = mount(html`<${ApiContext.Provider} value=${api}><${GrundrissView} /><//>`);
    await settle();
    expect(el.querySelector('button.schnellfoto')).not.toBeNull();
  });
});

describe('I1: geteilte Fotos gehen nicht verloren', () => {
  it('Import funktioniert offline (Duplikatprüfung nur lokal)', async () => {
    const queue = await openQueue(`i1-${Math.random()}`);
    const api = offline(createMemoryApi({ queue }));
    api.processImage = fakeProcess; api.syncNow = vi.fn();
    expect(await importFiles(api, [new File(['a'], 'a.jpg')])).toMatchObject({ neu: 1, fehler: 0 });
  });
  it('geteilte Datei bleibt liegen, wenn das Einreihen scheitert', async () => {
    const queue = await openQueue(`i1b-${Math.random()}`);
    const api = createMemoryApi({ queue });
    api.processImage = fakeProcess; api.syncNow = vi.fn();
    await queue.addShared([new File(['a'], 'a.jpg')]);
    queue.add = vi.fn(async () => { throw new Error('Speicher voll'); });
    const el = mount(html`<${ApiContext.Provider} value=${api}><${Inbox} /><//>`);
    await settle();
    expect(await queue.sharedCount()).toBe(1);
    expect(el.textContent).toMatch(/nicht gespeichert|Fehler/);
  });
});

describe('I2: Foto ist sofort gesichert, Gewerk/Phase kommen nach', () => {
  it('Kategorie-Änderung während des Uploads geht nicht verloren', async () => {
    const queue = await openQueue(`i2-${Math.random()}`);
    await queue.add({ typ: 'foto', fotoId: 'f', bild: new Blob(['b']), vorschau: new Blob(['v']),
      datensatz: { id: 'f', sha256: 'x', key_bild: 'fotos/f.jpg', key_vorschau: 'fotos/f_v.jpg', gewerk_id: null, phase_id: null } });
    const updateFoto = vi.fn(async () => {});
    const deps = {
      queue, sign: async (ops) => ops.map((o) => o.key), upload: async () => {}, updateFoto,
      insertFoto: async () => { await queue.patch('f', { gewerk_id: 'g1', phase_id: 'p1' }); }, // Auswahl kommt mitten im Upload
    };
    await syncOnce(deps);
    expect(updateFoto).toHaveBeenCalledWith('f', expect.objectContaining({ gewerk_id: 'g1', phase_id: 'p1' }));
    expect(await queue.count()).toBe(0);
  });
});

describe('Wand-Foto offline (Review Räume C1)', () => {
  it('Wand kann offline nicht angelegt werden → Foto wird trotzdem gesichert und später zugeordnet', async () => {
    const { useCapture } = await import('../../bautagebuch/js/ui/capture.js');
    const queue = await openQueue(`wand-off-${Math.random()}`);
    const api = createMemoryApi({ queue });
    api.processImage = fakeProcess; api.syncNow = vi.fn();
    const echtesList = api.list; const echtesInsert = api.insert;
    offline(api);
    const orig = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      Object.defineProperty(this, 'files', { value: [new File(['w'], 'w.jpg')], configurable: true });
      setTimeout(() => this.dispatchEvent(new Event('change')), 0);
    };
    let cap;
    function Hülle() { cap = useCapture(api); return cap.overlay; }
    const el = mount(html`<${Hülle} />`); await settle();
    await cap.atWand({ id: 'e1', nord_grad: 0 }, { id: 'bad', name: 'Bad' }, 'oben', { gewerke: [], phasen: [], fotos: [] });
    await settle();
    HTMLInputElement.prototype.click = orig;
    const [item] = await queue.pending();
    expect(item).toBeTruthy(); // nicht verloren
    expect(item.datensatz.stelle_id).toBeNull();
    expect(item.datensatz.wand).toMatchObject({ raum_id: 'bad', seite: 'oben', etage_id: 'e1' });
    expect(el.textContent).not.toMatch(/Failed to fetch/);

    // Wieder online: beim Hochladen wird die Wand angelegt und das Foto ihr zugeordnet.
    api.list = echtesList; api.insert = echtesInsert;
    await api.syncNow.getMockImplementation?.();
    const { syncOnce } = await import('../../bautagebuch/js/data/sync.js');
    const { ensureWand } = await import('../../bautagebuch/js/data/actions.js');
    await syncOnce({ queue, sign: async (ops) => ops.map((o) => o.key), upload: async () => {},
      insertFoto: (d) => api.insert('fotos', d), updateFoto: () => {},
      ensureWand: (w) => ensureWand(api, { id: w.etage_id, nord_grad: w.nord_grad }, { id: w.raum_id, name: w.raum_name }, w.seite) });
    const wand = (await api.list('stellen'))[0];
    expect(wand).toMatchObject({ raum_id: 'bad', seite: 'oben' });
    const [foto] = await api.list('fotos');
    expect(foto.stelle_id).toBe(wand.id);
    expect(foto.wand).toBeUndefined();
  });
});

describe('Raum löschen (Review Räume I2)', () => {
  it('Fotos der Wände kommen in den Eingang, Wände in den Papierkorb', async () => {
    const { deleteRaum } = await import('../../bautagebuch/js/data/actions.js');
    const api = createMemoryApi({ seed: {
      raeume: [{ id: 'r', name: 'Bad', flaechen: [{ x1: 0, y1: 0, x2: 1, y2: 1 }] }],
      stellen: [{ id: 's', raum_id: 'r', seite: 'oben' }],
      fotos: [{ id: 'f', stelle_id: 's', sha256: '1' }],
    } });
    await deleteRaum(api, { id: 'r' });
    expect((await api.list('fotos'))[0].stelle_id).toBeNull();
    expect(await api.list('stellen')).toHaveLength(0);
    expect(await api.list('raeume')).toHaveLength(0);
  });
});

describe('Eingang: Wand wählen offline (Review Räume I3)', () => {
  it('zeigt eine Meldung statt nichts zu tun', async () => {
    const queue = await openQueue(`i3-${Math.random()}`);
    const api = createMemoryApi({ queue, seed: {
      etagen: [{ id: 'e1', name: 'EG', sortierung: 1 }],
      raeume: [{ id: 'bad', etage_id: 'e1', name: 'Bad', flaechen: [{ x1: 0, y1: 0, x2: 20, y2: 30 }] }],
      fotos: [{ id: 'f1', sha256: '1', tag: '2027-03-17' }],
    } });
    const el = mount(html`<${ApiContext.Provider} value=${api}><${Inbox} /><//>`);
    await settle();
    await click(el.querySelector('[data-foto="f1"]'));
    await click(byText(el, 'button', 'Einsortieren (1)')); await settle();
    const f = el.querySelector('.plan-inhalt');
    f.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000 });
    f.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100, bubbles: true })); await settle();
    api.insert = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    await click(el.querySelector('[data-seite="oben"]')); await settle();
    expect(el.textContent).toMatch(/Keine Verbindung/);
  });
});
