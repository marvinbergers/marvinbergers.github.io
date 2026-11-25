// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, html, flush, click, byText, type } from './helpers.js';
import { DayEntry } from '../../bautagebuch/js/ui/DayEntry.js';
import { Diary } from '../../bautagebuch/js/ui/Diary.js';
import { ApiContext } from '../../bautagebuch/js/data/api.js';
import { createMemoryApi } from '../../bautagebuch/js/data/memory.js';

const settle = async () => { for (let i = 0; i < 6; i++) await flush(); };
function apiMit(seed = {}) {
  const api = createMemoryApi({ me: { id: 'u1', email: 'a@example.org' }, seed: {
    personen: [{ id: 'pa', name: 'Person A', email: 'a@example.org', nutzer_id: 'u1', ist_nutzer: true }, { id: 'pb', name: 'Person B', ist_nutzer: true }],
    firmen: [{ id: 'f1', name: 'Elektro Muster' }],
    einstellungen: [{ schluessel: 'haus_koordinaten', wert: { lat: 51.6, lon: 6.2 } }],
    ...seed,
  } });
  api.fetchWeather = vi.fn(async () => ({ daily: { weather_code: [3], temperature_2m_min: [4], temperature_2m_max: [9], precipitation_sum: [0] } }));
  return api;
}
const mountDay = (api, datum = '2027-03-17') => mount(html`<${ApiContext.Provider} value=${api}><${DayEntry} datum=${datum} /><//>`);

beforeEach(() => { document.body.innerHTML = ''; });

describe('DayEntry', () => {
  it('Abschnitt schreiben legt den Tag an, holt einmal das Wetter, zeigt den Verfasser', async () => {
    const api = apiMit();
    const el = mountDay(api); await settle();
    await type(el.querySelector('textarea[name=arbeiten]'), 'Schlitze im Bad gestemmt');
    await click(byText(el, 'button', 'Speichern'));
    await settle();
    const tage = await api.list('tage');
    expect(tage).toHaveLength(1);
    expect(tage[0].wetter.text).toBe('Bedeckt');
    expect(api.fetchWeather).toHaveBeenCalledTimes(1);
    expect(el.textContent).toContain('Schlitze im Bad gestemmt');
    expect(el.textContent).toContain('Person A');
  });

  it('keine Warnung, wenn Stunden fehlen; Anwesenheit nur abhaken genügt', async () => {
    const api = apiMit();
    const el = mountDay(api); await settle();
    await click(el.querySelector('[data-anwesend="person:pb"]'));
    await settle();
    const [a] = await api.list('anwesenheit');
    expect(a.person_id).toBe('pb');
    expect(a.stunden ?? null).toBeNull();
    expect(el.textContent).not.toMatch(/fehlt|unvollständig|bitte/i);
  });

  it('Stunden optional setzen: „ganzer Tag“ = 8 h', async () => {
    const api = apiMit();
    const el = mountDay(api); await settle();
    await click(el.querySelector('[data-anwesend="person:pa"]')); await settle();
    const sel = el.querySelector('select[name="stunden-pa"]');
    sel.value = '8'; sel.dispatchEvent(new Event('change', { bubbles: true })); await settle();
    expect((await api.list('anwesenheit'))[0].stunden).toBe(8);
  });

  it('manuelles Wetter wird nicht mehr überschrieben', async () => {
    const api = apiMit({ tage: [{ id: 't', datum: '2027-03-17', wetter: { text: 'Sonnig' }, wetter_manuell: false }] });
    const el = mountDay(api); await settle();
    await click(byText(el, 'button', 'Wetter ändern'));
    await type(el.querySelector('input[name=wetter]'), 'Nebel, kalt');
    await click(byText(el, 'button', 'Übernehmen')); await settle();
    const [t] = await api.list('tage');
    expect(t).toMatchObject({ wetter_manuell: true });
    expect(t.wetter.text).toBe('Nebel, kalt');
    expect(api.fetchWeather).not.toHaveBeenCalled();
  });

  it('zeigt die Fotos des Tages nach Stelle', async () => {
    const api = apiMit({ stellen: [{ id: 's1', name: 'Bad – Ostwand' }], fotos: [{ sha256: '1', tag: '2027-03-17', stelle_id: 's1' }, { sha256: '2', tag: '2027-03-17' }] });
    const el = mountDay(api); await settle();
    expect(el.textContent).toContain('2 Fotos');
    expect(el.textContent).toContain('Bad – Ostwand');
    expect(el.textContent).toContain('Eingang');
  });
});

describe('Diary', () => {
  it('listet nur Tage mit Inhalt oder Fotos, neueste zuerst', async () => {
    const api = apiMit({
      tage: [{ id: 't1', datum: '2027-03-17', wetter: { text: 'Regen' } }, { id: 't2', datum: '2027-03-19' }],
      tag_abschnitte: [{ tag_id: 't1', typ: 'arbeiten', text: 'Leitungen gelegt' }],
      fotos: [{ sha256: '1', tag: '2027-03-20' }],
    });
    const el = mount(html`<${ApiContext.Provider} value=${api}><${Diary} /><//>`); await settle();
    const tage = [...el.querySelectorAll('[data-tag]')].map((x) => x.dataset.tag);
    expect(tage).toEqual(['2027-03-20', '2027-03-17']);
  });
});
