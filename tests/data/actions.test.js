import { describe, it, expect } from 'vitest';
import { ensureWand } from '../../bautagebuch/js/data/actions.js';
import { createMemoryApi } from '../../bautagebuch/js/data/memory.js';

const raum = { id: 'r1', etage_id: 'e1', name: 'Bad' };
const etage = { id: 'e1', nord_grad: 0 };

describe('ensureWand', () => {
  it('legt die Wand beim ersten Mal an, danach wiederverwendet', async () => {
    const api = createMemoryApi();
    const a = await ensureWand(api, etage, raum, 'oben');
    expect(a).toMatchObject({ raum_id: 'r1', seite: 'oben', etage_id: 'e1', name: 'Bad – Nordwand' });
    const b = await ensureWand(api, etage, raum, 'oben');
    expect(b.id).toBe(a.id);
  });
  it('zweimal gleichzeitig → nur eine Stelle', async () => {
    const api = createMemoryApi();
    const [a, b] = await Promise.all([ensureWand(api, etage, raum, 'links'), ensureWand(api, etage, raum, 'links')]);
    expect(a.id).toBe(b.id);
    expect((await api.list('stellen')).length).toBe(1);
  });
  it('Unique-Konflikt vom Server (anderes Gerät war schneller) → vorhandene nehmen', async () => {
    const api = createMemoryApi();
    const fremd = await api.insert('stellen', { raum_id: 'r1', seite: 'unten', etage_id: 'e1', name: 'Bad – Südwand' });
    const orig = api.list; let erster = true;
    api.list = async (...a) => { if (erster) { erster = false; return []; } return orig(...a); }; // veraltete Liste
    const insert = api.insert; api.insert = async () => { throw Object.assign(new Error('dup'), { code: '23505' }); };
    expect((await ensureWand(api, etage, raum, 'unten')).id).toBe(fremd.id);
    api.insert = insert;
  });
});
