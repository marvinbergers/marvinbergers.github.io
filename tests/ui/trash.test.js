// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, html, flush, click, byText } from './helpers.js';
import { Trash } from '../../bautagebuch/js/ui/Trash.js';
import { History } from '../../bautagebuch/js/ui/History.js';
import { FotoAnsicht } from '../../bautagebuch/js/ui/FotoAnsicht.js';
import { ApiContext } from '../../bautagebuch/js/data/api.js';
import { createMemoryApi } from '../../bautagebuch/js/data/memory.js';

const settle = async () => { for (let i = 0; i < 6; i++) await flush(); };
const TAG = 86_400_000;
beforeEach(() => { document.body.innerHTML = ''; });

describe('Löschen', () => {
  it('Foto löschen = in den Papierkorb (kein endgültiges Löschen)', async () => {
    const api = createMemoryApi({ seed: { fotos: [{ id: 'f1', sha256: '1', tag: '2027-03-17' }] } });
    const upd = vi.spyOn(api, 'update');
    const onClose = vi.fn();
    const el = mount(html`<${ApiContext.Provider} value=${api}><${FotoAnsicht} foto=${{ id: 'f1', tag: '2027-03-17' }} onClose=${onClose} /><//>`);
    await settle();
    await click(byText(el, 'button', 'Löschen'));
    await click(byText(el, 'button', 'Ja, in den Papierkorb'));
    expect(upd).toHaveBeenCalledWith('fotos', 'f1', expect.objectContaining({ geloescht_am: expect.any(String) }));
    expect(await api.list('fotos')).toHaveLength(0);
    expect(await api.listDeleted('fotos')).toHaveLength(1);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Papierkorb', () => {
  it('zeigt Gelöschtes der letzten 90 Tage und stellt wieder her', async () => {
    const jetzt = new Date('2027-06-01T10:00:00Z');
    const api = createMemoryApi({ now: () => jetzt, seed: {
      stellen: [{ id: 's1', name: 'Bad – Ostwand', geloescht_am: new Date(jetzt - 5 * TAG).toISOString() },
                { id: 's2', name: 'Uralt', geloescht_am: new Date(jetzt - 91 * TAG).toISOString() }],
      tag_abschnitte: [{ id: 'a1', text: 'Estrich geliefert', geloescht_am: new Date(jetzt - 1 * TAG).toISOString() }],
    } });
    const el = mount(html`<${ApiContext.Provider} value=${api}><${Trash} /><//>`);
    await settle();
    expect(el.textContent).toContain('Bad – Ostwand');
    expect(el.textContent).toContain('Estrich geliefert');
    expect(el.textContent).not.toContain('Uralt');
    await click(el.querySelector('[data-restore="stellen:s1"]'));
    await settle();
    expect((await api.list('stellen')).map((s) => s.id)).toEqual(['s1']);
    expect(el.textContent).not.toContain('Bad – Ostwand');
  });
});

describe('Verlauf', () => {
  it('zeigt Fassungen neueste zuerst mit Namen', async () => {
    const api = createMemoryApi({ me: { id: 'u1' }, seed: { personen: [{ name: 'Person A', nutzer_id: 'u1' }] } });
    const a = await api.insert('tag_abschnitte', { text: 'erste Fassung' });
    await api.update('tag_abschnitte', a.id, { text: 'zweite Fassung' });
    const el = mount(html`<${ApiContext.Provider} value=${api}><${History} id=${a.id} feld="text" /><//>`);
    await settle();
    const eintraege = [...el.querySelectorAll('.verlauf li')].map((li) => li.textContent);
    expect(eintraege[0]).toContain('zweite Fassung');
    expect(eintraege[1]).toContain('erste Fassung');
    expect(eintraege[0]).toContain('Person A');
  });
});
