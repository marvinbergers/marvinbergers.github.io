// Einzelnes Foto groß, mit Angaben, Verlauf und Löschen (= Papierkorb).
import { html } from '../vendor/htm.js';
import { useState } from '../vendor/preact.js';
import { useApi } from '../data/api.js';
import { useUrls } from './hooks.js';
import { History } from './History.js';
import { CategoryPicker } from './CategoryPicker.js';
import { setzeKategorie } from './capture.js';

export function FotoAnsicht({ foto: fotoStart, gewerke = [], phasen = [], onClose, onChanged = () => {} }) {
  const api = useApi();
  const [foto, setFoto] = useState(fotoStart);
  const [aendern, setAendern] = useState(false);
  const urls = useUrls(api, [foto.key_bild]);
  const [frage, setFrage] = useState(false);
  const [verlauf, setVerlauf] = useState(false);
  const g = gewerke.find((x) => x.id === foto.gewerk_id)?.name; const p = phasen.find((x) => x.id === foto.phase_id)?.name;
  return html`<div class="dialog karte foto-ansicht" role="dialog" aria-label="Foto">
    <div class="zeile"><b>${foto.tag}${foto.datum_geschaetzt ? ' (Datum geschätzt)' : ''}</b><button aria-label="Schließen" onClick=${onClose}>✕</button></div>
    ${urls[foto.key_bild] && html`<img class="gross-bild" src=${urls[foto.key_bild]} alt="" />`}
    <p class="hinweis">${[g, p].filter(Boolean).join(' · ') || 'Noch nicht einsortiert'}${foto.checkpunkt ? ` · ${foto.checkpunkt}` : ''}</p>
    ${foto.notiz && html`<p>${foto.notiz}</p>`}
    ${aendern && html`<${CategoryPicker} gewerke=${gewerke} phasen=${phasen}
      start=${{ gewerk_id: foto.gewerk_id, phase_id: foto.phase_id, notiz: foto.notiz ?? '' }}
      onComplete=${async (felder) => {
        const neu = { gewerk_id: felder.gewerk_id, phase_id: felder.phase_id, notiz: felder.notiz || null };
        await setzeKategorie(api, foto.id, neu);
        setFoto({ ...foto, ...neu }); setAendern(false); onChanged();
      }} />`}
    <div class="knopfgitter klein">
      ${!aendern && html`<button onClick=${() => setAendern(true)}>Gewerk/Phase ändern</button>`}
      <button onClick=${() => setVerlauf(!verlauf)}>Verlauf</button>
      <button onClick=${() => setFrage(true)}>Löschen</button>
    </div>
    ${verlauf && html`<${History} id=${foto.id} />`}
    ${frage && html`<div><p>Foto in den Papierkorb legen? Es bleibt 90 Tage wiederherstellbar.</p>
      <div class="knopfgitter"><button onClick=${() => setFrage(false)}>Abbrechen</button>
      <button class="primaer" onClick=${async () => { await api.softDelete('fotos', foto.id); onChanged(); onClose(); }}>Ja, in den Papierkorb</button></div></div>`}
  </div>`;
}
