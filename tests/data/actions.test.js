import { describe, it, expect } from 'vitest';
import { ensureWand, speichereRaum, wandTitel } from '../../bautagebuch/js/data/actions.js';
import { createMemoryApi } from '../../bautagebuch/js/data/memory.js';

const P = (id, x, y) => ({ id, x, y });
const raum = { id: 'r1', etage_id: 'e1', name: 'Bad', ecken: [P('a', 10, 10), P('b', 30, 10), P('c', 30, 30), P('d', 10, 30)] };
const etage = { id: 'e1', nord_grad: 0, plan_breite: 100, plan_hoehe: 100 };

describe('wandTitel', () => {
  it('Raum + berechneter Wandname', () => {
    expect(wandTitel(raum, { seite: 'wand', kante: 'a' }, etage)).toBe('Bad – Nordwand');
    expect(wandTitel(raum, { seite: 'boden' }, etage)).toBe('Bad – Boden');
  });
});

describe('ensureWand', () => {
  it('legt die Wand beim ersten Mal an, danach wiederverwendet', async () => {
    const api = createMemoryApi();
    const a = await ensureWand(api, etage, raum, { seite: 'wand', kante: 'a' });
    expect(a).toMatchObject({ raum_id: 'r1', seite: 'wand', kante: 'a', etage_id: 'e1', name: 'Bad – Nordwand' });
    expect((await ensureWand(api, etage, raum, { seite: 'wand', kante: 'a' })).id).toBe(a.id);
    const boden = await ensureWand(api, etage, raum, { seite: 'boden' });
    expect(boden).toMatchObject({ seite: 'boden', kante: null });
  });
  it('zweimal gleichzeitig → nur eine Stelle', async () => {
    const api = createMemoryApi();
    const [a, b] = await Promise.all([ensureWand(api, etage, raum, { seite: 'wand', kante: 'd' }), ensureWand(api, etage, raum, { seite: 'wand', kante: 'd' })]);
    expect(a.id).toBe(b.id);
    expect((await api.list('stellen')).length).toBe(1);
  });
  it('Unique-Konflikt vom Server → vorhandene nehmen', async () => {
    const api = createMemoryApi();
    const fremd = await api.insert('stellen', { raum_id: 'r1', seite: 'wand', kante: 'c', etage_id: 'e1', name: 'x' });
    const orig = api.list; let erster = true;
    api.list = async (...a) => { if (erster) { erster = false; return []; } return orig(...a); };
    api.insert = async () => { throw Object.assign(new Error('dup'), { code: '23505' }); };
    expect((await ensureWand(api, etage, raum, { seite: 'wand', kante: 'c' })).id).toBe(fremd.id);
  });
});

describe('speichereRaum', () => {
  it('Punkt verschoben/eingefügt: Fotos bleiben an ihren Wänden', async () => {
    const api = createMemoryApi({ seed: { raeume: [raum], stellen: [{ id: 'sa', raum_id: 'r1', seite: 'wand', kante: 'a' }], fotos: [{ id: 'f', stelle_id: 'sa', sha256: '1' }] } });
    const neu = [P('a', 10, 10), P('n', 20, 5), P('b', 30, 10), P('c', 32, 30), P('d', 10, 30)];
    await speichereRaum(api, etage, raum, neu, []);
    expect((await api.list('raeume'))[0].ecken.map((p) => p.id)).toEqual(['a', 'n', 'b', 'c', 'd']);
    expect((await api.list('fotos'))[0].stelle_id).toBe('sa');
  });
  it('Punkt gelöscht: Fotos der wegfallenden Wand ziehen auf die zusammengelegte Wand um', async () => {
    const api = createMemoryApi({ seed: { raeume: [raum],
      stellen: [{ id: 'sa', raum_id: 'r1', seite: 'wand', kante: 'a' }, { id: 'sb', raum_id: 'r1', seite: 'wand', kante: 'b' }],
      fotos: [{ id: 'f1', stelle_id: 'sa', sha256: '1' }, { id: 'f2', stelle_id: 'sb', sha256: '2' }] } });
    await speichereRaum(api, etage, raum, [P('a', 10, 10), P('c', 30, 30), P('d', 10, 30)], [{ von: 'b', nach: 'a' }]);
    expect((await api.list('fotos')).map((f) => f.stelle_id)).toEqual(['sa', 'sa']);
    expect((await api.list('stellen')).map((s) => s.kante)).toEqual(['a']);
  });
  it('Umzug auf eine Wand, die es noch nicht gibt → wird angelegt', async () => {
    const api = createMemoryApi({ seed: { raeume: [raum], stellen: [{ id: 'sb', raum_id: 'r1', seite: 'wand', kante: 'b' }], fotos: [{ id: 'f2', stelle_id: 'sb', sha256: '2' }] } });
    await speichereRaum(api, etage, raum, [P('a', 10, 10), P('c', 30, 30), P('d', 10, 30)], [{ von: 'b', nach: 'a' }]);
    const [st] = await api.list('stellen');
    expect(st).toMatchObject({ kante: 'a' });
    expect((await api.list('fotos'))[0].stelle_id).toBe(st.id);
  });
  it('gegen den Uhrzeigersinn → normiert, „bitte prüfen“ entfernt', async () => {
    const api = createMemoryApi({ seed: { raeume: [{ ...raum, pruefen: true }] } });
    await speichereRaum(api, etage, raum, [P('a', 10, 10), P('d', 10, 30), P('c', 30, 30), P('b', 30, 10)], []);
    const [r] = await api.list('raeume');
    expect(r.ecken.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(r.pruefen).toBe(false);
  });
});

describe('Review Vieleck: keine Fotos an verschwundenen Wänden', () => {
  it('speichereRaum zieht Fotos um, bevor die Form gespeichert wird (Netzabbruch danach schadet nicht)', async () => {
    const api = createMemoryApi({ seed: { raeume: [raum], stellen: [{ id: 'sb', raum_id: 'r1', seite: 'wand', kante: 'b' }], fotos: [{ id: 'f', stelle_id: 'sb', sha256: '1' }] } });
    const upd = api.update;
    api.update = async (t, id, p) => { if (t === 'raeume' && p.ecken) throw new TypeError('Failed to fetch'); return upd(t, id, p); };
    await expect(speichereRaum(api, etage, raum, [P('a', 10, 10), P('c', 30, 30), P('d', 10, 30)], [{ von: 'b', nach: 'a' }])).rejects.toThrow();
    const wandA = (await api.list('stellen', { kante: 'a' }))[0];
    expect((await api.list('fotos'))[0].stelle_id).toBe(wandA.id); // schon an sichtbarer Wand
  });

  it('gelöschte Ecke wird gemerkt: spätere Fotos für die alte Wand landen auf der zusammengelegten', async () => {
    const api = createMemoryApi({ seed: { raeume: [raum] } });
    await speichereRaum(api, etage, raum, [P('a', 10, 10), P('c', 30, 30), P('d', 10, 30)], [{ von: 'b', nach: 'a' }]);
    const frisch = (await api.list('raeume'))[0];
    expect(frisch.kanten_alias).toEqual({ b: 'a' });
    // veraltetes Gerät kennt noch Ecke b:
    const st = await ensureWand(api, etage, raum, { seite: 'wand', kante: 'b' });
    expect(st.kante).toBe('a');
  });

  it('Ketten: b → a, danach a → d', async () => {
    const api = createMemoryApi({ seed: { raeume: [raum] } });
    await speichereRaum(api, etage, raum, [P('a', 10, 10), P('c', 30, 30), P('d', 10, 30)], [{ von: 'b', nach: 'a' }]);
    const r1 = (await api.list('raeume'))[0];
    await speichereRaum(api, etage, r1, [P('c', 30, 30), P('d', 10, 30), P('e', 5, 5)], [{ von: 'a', nach: 'd' }]);
    expect((await ensureWand(api, etage, raum, { seite: 'wand', kante: 'b' })).kante).toBe('d');
  });

  it('Raum inzwischen auf anderem Gerät geändert → Speichern wird abgelehnt', async () => {
    const api = createMemoryApi({ seed: { raeume: [raum] } });
    await api.update('raeume', 'r1', { ecken: [...raum.ecken, P('n', 5, 20)] }); // anderes Gerät
    await expect(speichereRaum(api, etage, raum, raum.ecken.slice(0, 3), [])).rejects.toThrow(/inzwischen.*geändert/);
  });
});
