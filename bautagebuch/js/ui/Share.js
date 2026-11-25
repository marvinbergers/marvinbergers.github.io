// Fotos weitergeben (z. B. per Mail an den Statiker): Teilen-Menü des Handys, sonst ZIP-Download.
import { html } from '../vendor/htm.js';
import { useState } from '../vendor/preact.js';
import { zipSync } from '../vendor/fflate.js';
import { berlinDate } from '../lib/days.js';

export const dateiname = (f) => `${f.tag}_${f.id}.jpg`;

function browserDownload(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export async function shareFotos(fotos, { getBlob, nav = globalThis.navigator, download = browserDownload }) {
  const files = await Promise.all(fotos.map(async (f) => new File([await getBlob(f.key_bild)], dateiname(f), { type: 'image/jpeg' })));
  if (nav?.canShare?.({ files }) && nav.share) {
    try { await nav.share({ files, title: 'Baufotos' }); return 'geteilt'; } catch (e) { if (e?.name === 'AbortError') return 'abgebrochen'; throw e; }
  }
  const inhalt = {};
  for (const f of files) inhalt[f.name] = new Uint8Array(await new Response(f).arrayBuffer().catch(() => f.arrayBuffer()));
  download(new Blob([zipSync(inhalt, { level: 0 })], { type: 'application/zip' }), `Baufotos-${berlinDate(new Date())}.zip`);
  return 'nicht_unterstuetzt';
}

/** Lädt das große Bild über die API (signierte URL). */
export const blobLoader = (api) => async (key) => (await fetch(await api.url(key))).blob();

export function ShareDialog({ fotos, thumb, onShare, onClose }) {
  const [gewaehlt, setGewaehlt] = useState(new Set());
  const [status, setStatus] = useState('');
  const toggle = (id) => { const n = new Set(gewaehlt); n.has(id) ? n.delete(id) : n.add(id); setGewaehlt(n); };
  return html`<div class="dialog karte" role="dialog" aria-label="Fotos teilen">
    <div class="zeile"><b>Fotos zum Teilen auswählen</b><button aria-label="Schließen" onClick=${onClose}>✕</button></div>
    <div class="thumbs auswahl">${fotos.map((f) => html`<button class="thumb" data-foto=${f.id} aria-pressed=${gewaehlt.has(f.id) ? 'true' : 'false'}
      onClick=${() => toggle(f.id)}><img src=${thumb(f)} alt="" /></button>`)}</div>
    <div class="knopfgitter">
      <button onClick=${() => setGewaehlt(new Set(fotos.map((f) => f.id)))}>Alle</button>
      <button class="primaer" disabled=${!gewaehlt.size} onClick=${async () => {
        setStatus('Wird vorbereitet …');
        const r = await onShare(fotos.filter((f) => gewaehlt.has(f.id)));
        setStatus(r === 'nicht_unterstuetzt' ? 'Als ZIP heruntergeladen – im Mail-Programm anhängen.' : '');
      }}>Teilen (${gewaehlt.size})</button>
    </div>
    ${status && html`<p class="hinweis" role="status">${status}</p>`}
  </div>`;
}
