// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, html, flush, click, byText } from './helpers.js';
import { shareFotos, ShareDialog, dateiname } from '../../bautagebuch/js/ui/Share.js';
import { checklistStatus, STANDARD_CHECKLISTEN } from '../../bautagebuch/js/ui/Checkliste.js';

const fotos = [{ id: 'a', tag: '2027-03-17', key_bild: 'fotos/a.jpg', key_vorschau: 'fotos/a_v.jpg' }, { id: 'b', tag: '2027-03-18', key_bild: 'fotos/b.jpg', key_vorschau: 'fotos/b_v.jpg' }];
const getBlob = vi.fn(async (key) => new Blob([key], { type: 'image/jpeg' }));

beforeEach(() => { document.body.innerHTML = ''; getBlob.mockClear(); });

describe('shareFotos', () => {
  it('teilt genau die gewählten Fotos über das Teilen-Menü', async () => {
    const nav = { canShare: vi.fn(() => true), share: vi.fn(async () => {}) };
    expect(await shareFotos([fotos[1]], { getBlob, nav })).toBe('geteilt');
    const arg = nav.share.mock.calls[0][0];
    expect(arg.title).toBe('Baufotos');
    expect(arg.files.map((f) => f.name)).toEqual(['2027-03-18_b.jpg']);
    expect(getBlob).toHaveBeenCalledWith('fotos/b.jpg');
  });
  it('Abbruch im Teilen-Menü', async () => {
    const nav = { canShare: () => true, share: vi.fn(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); }) };
    expect(await shareFotos(fotos, { getBlob, nav })).toBe('abgebrochen');
  });
  it('ohne Teilen-Unterstützung: ZIP-Download', async () => {
    const download = vi.fn();
    expect(await shareFotos(fotos, { getBlob, nav: {}, download })).toBe('nicht_unterstuetzt');
    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][1]).toMatch(/^Baufotos-\d{4}-\d{2}-\d{2}\.zip$/);
  });
  it('Dateiname aus Datum und ID', () => {
    expect(dateiname({ id: 'xyz', tag: '2027-03-17' })).toBe('2027-03-17_xyz.jpg');
  });
});

describe('ShareDialog', () => {
  it('nur ausgewählte Fotos werden geteilt', async () => {
    const onShare = vi.fn(async () => 'geteilt');
    const el = mount(html`<${ShareDialog} fotos=${fotos} thumb=${() => ''} onShare=${onShare} onClose=${() => {}} />`);
    await flush();
    await click(el.querySelector('[data-foto="b"]'));
    await click(byText(el, 'button', 'Teilen (1)'));
    expect(onShare).toHaveBeenCalledWith([fotos[1]]);
  });
});

describe('Checkliste', () => {
  it('Standardvorlage Bodenplatte', () => {
    expect(STANDARD_CHECKLISTEN[0]).toEqual({ name: 'Bodenplatte', punkte: ['nach dem Aushub', 'vor dem Betonieren', 'vor dem Verdecken', 'nach der Herstellung'] });
  });
  it('Punkt mit Foto ist abgehakt', () => {
    const s = checklistStatus(STANDARD_CHECKLISTEN[0], [{ checkpunkt: 'Bodenplatte: vor dem Betonieren' }]);
    expect(s.map((p) => p.erledigt)).toEqual([false, true, false, false]);
    expect(s[1].schluessel).toBe('Bodenplatte: vor dem Betonieren');
  });
});
