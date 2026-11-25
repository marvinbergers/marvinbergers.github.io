// Datei- und Ordnernamen im Archiv: lesbar, für Windows gültig, Umlaute bleiben erhalten.
import { wandTitel } from '../../bautagebuch/js/lib/rooms.js';

export const sauber = (s) => `${s ?? ''}`.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+$/g, '').trim() || 'ohne Namen';

export function fotoDateiname(foto, gewerk, phase, laufnr) {
  const teile = [foto.tag, gewerk?.name, phase?.name].filter(Boolean).map(sauber);
  return `${teile.join('_')}_${String(laufnr).padStart(2, '0')}.jpg`;
}

/** Ordner einer Wand (Raum + Seite, Name nach aktuellem Nordpfeil) bzw. einer alten freien Stelle. */
export function stellenOrdner(etage, stelle, raum = null) {
  const name = raum && stelle.seite ? wandTitel(raum, stelle.seite, etage?.nord_grad ?? 0) : stelle.name;
  return `Stellen/${sauber(etage?.name ?? 'Etage')}/${sauber(name)}`;
}
