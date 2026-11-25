// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '../../bautagebuch/js/vendor/preact.js';
import { html } from '../../bautagebuch/js/vendor/htm.js';
import { SyncBadge } from '../../bautagebuch/js/ui/SyncBadge.js';

describe('SyncBadge', () => {
  it('zeigt wartende Uploads', () => {
    const el = document.createElement('div');
    render(html`<${SyncBadge} count=${3} />`, el);
    expect(el.textContent).toContain('3 warten auf Upload');
  });
  it('zeigt nichts bei 0', () => {
    const el = document.createElement('div');
    render(html`<${SyncBadge} count=${0} />`, el);
    expect(el.textContent).toBe('');
  });
});
