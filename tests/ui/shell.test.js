// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { mount, html, flush } from './helpers.js';
import { ApiContext } from '../../bautagebuch/js/data/api.js';
import { createMemoryApi } from '../../bautagebuch/js/data/memory.js';

globalThis.__BT_TEST__ = true;
const { Shell } = await import('../../bautagebuch/js/main.js');

describe('Menü', () => {
  it('zeigt die Zahl der Fotos im Eingang', async () => {
    const api = createMemoryApi({ seed: { fotos: [{ sha256: '1' }, { sha256: '2', stelle_id: 's', gewerk_id: 'g', phase_id: 'p' }] } });
    const el = mount(html`<${ApiContext.Provider} value=${api}><${Shell} /><//>`);
    for (let i = 0; i < 4; i++) await flush();
    expect(el.querySelector('a[data-route="eingang"] .badge').textContent).toBe('1');
  });
});
