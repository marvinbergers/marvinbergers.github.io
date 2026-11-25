// Datei- und Ordnernamen im Archiv: lesbar, für Windows gültig, Umlaute bleiben erhalten.
export const sauber = (s) => `${s ?? ''}`.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+$/g, '').trim() || 'ohne Namen';

export function fotoDateiname(foto, gewerk, phase, laufnr) {
  const teile = [foto.tag, gewerk?.name, phase?.name].filter(Boolean).map(sauber);
  return `${teile.join('_')}_${String(laufnr).padStart(2, '0')}.jpg`;
}

export function stellenOrdner(etage, stelle) {
  return `Stellen/${sauber(etage?.name ?? 'Etage')}/${sauber(stelle.name)}`;
}
