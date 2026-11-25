import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { openQueue } from '../../bautagebuch/js/lib/queue.js';
import { syncOnce } from '../../bautagebuch/js/data/sync.js';

let n = 0;
const item = (id) => ({ typ: 'foto', fotoId: id, bild: new Blob(['b']), vorschau: new Blob(['v']),
  datensatz: { id, sha256: id, key_bild: `fotos/2027/03/${id}.jpg`, key_vorschau: `fotos/2027/03/${id}_v.jpg` } });

async function setup() {
  const queue = await openQueue(`sync-${++n}`);
  await queue.add(item('a'));
  const calls = [];
  const deps = {
    queue,
    sign: vi.fn(async (ops) => ops.map((o) => `https://r2/${o.key}`)),
    upload: vi.fn(async (url) => { calls.push(`upload ${url}`); }),
    insertFoto: vi.fn(async (d) => { calls.push(`insert ${d.id}`); }),
  };
  return { queue, deps, calls };
}

describe('syncOnce', () => {
  it('Fehler beim Upload behält Eintrag', async () => {
    const { queue, deps } = await setup();
    deps.upload.mockRejectedValueOnce(new Error('offline'));
    expect(await syncOnce(deps)).toEqual({ erledigt: 0, fehler: 1 });
    expect(await queue.count()).toBe(1);
  });

  it('Erfolg: erst Bild, dann Vorschau, dann Datensatz; danach leer', async () => {
    const { queue, deps, calls } = await setup();
    expect(await syncOnce(deps)).toEqual({ erledigt: 1, fehler: 0 });
    expect(calls).toEqual([
      'upload https://r2/fotos/2027/03/a.jpg',
      'upload https://r2/fotos/2027/03/a_v.jpg',
      'insert a',
    ]);
    expect(await queue.count()).toBe(0);
  });

  it('Duplikat (23505) wird still entfernt', async () => {
    const { queue, deps } = await setup();
    deps.insertFoto.mockRejectedValueOnce({ code: '23505' });
    expect(await syncOnce(deps)).toEqual({ erledigt: 1, fehler: 0 });
    expect(await queue.count()).toBe(0);
  });

  it('anderer DB-Fehler behält Eintrag', async () => {
    const { queue, deps } = await setup();
    deps.insertFoto.mockRejectedValueOnce({ code: '42501' });
    expect(await syncOnce(deps)).toEqual({ erledigt: 0, fehler: 1 });
    expect(await queue.count()).toBe(1);
  });
});
