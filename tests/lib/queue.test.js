import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openQueue } from '../../bautagebuch/js/lib/queue.js';

let n = 0;
const name = () => `test-${++n}`;
const item = (id) => ({ typ: 'foto', fotoId: id, bild: new Blob(['b']), vorschau: new Blob(['v']), datensatz: { id, sha256: id } });

describe('Warteschlange', () => {
  let db;
  beforeEach(() => { db = name(); });

  it('Eintrag überlebt Neustart (App geschlossen vor Upload)', async () => {
    const q1 = await openQueue(db);
    await q1.add(item('a'));
    q1.close();
    const q2 = await openQueue(db);
    expect(await q2.count()).toBe(1);
    const [p] = await q2.pending();
    expect(p.fotoId).toBe('a');
    expect(await p.bild.text()).toBe('b');
    q2.close();
  });

  it('pending in Einfügereihenfolge, remove entfernt', async () => {
    const q = await openQueue(db);
    await q.add(item('a')); await q.add(item('b'));
    expect((await q.pending()).map((x) => x.fotoId)).toEqual(['a', 'b']);
    await q.remove('a');
    expect(await q.count()).toBe(1);
    q.close();
  });

  it('geteilte Dateien ablegen und abholen', async () => {
    const q = await openQueue(db);
    await q.addShared([new File(['x'], 'x.jpg', { type: 'image/jpeg' })]);
    const files = await q.takeShared();
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('x.jpg');
    expect(await q.takeShared()).toHaveLength(0);
    q.close();
  });
});
