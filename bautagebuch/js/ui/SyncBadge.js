import { html } from '../vendor/htm.js';

export function SyncBadge({ count }) {
  if (!count) return null;
  return html`<div class="syncbadge" role="status">⇅ ${count} warten auf Upload</div>`;
}
