// Eingang: Fotos ohne vollständige Einordnung (Stelle, Gewerk und Phase).
import { preparePhoto } from '../ui/capture.js';

export const imEingang = (f) => !f.stelle_id || !f.gewerk_id || !f.phase_id;

async function bekannteHashes(api) {
  const vorhanden = (await api.list('fotos')).map((f) => f.sha256);
  const wartend = (await api.queue.pending()).map((i) => i.datensatz?.sha256);
  return new Set([...vorhanden, ...wartend].filter(Boolean));
}

/** Importiert Dateien in die Warteschlange; Duplikate (gleicher Fingerabdruck) werden übersprungen. */
export async function importFiles(api, files) {
  const bekannt = await bekannteHashes(api);
  const r = { neu: 0, doppelt: 0, fehler: 0, meldungen: [] };
  for (const file of files) {
    try {
      const item = await preparePhoto(api, file);
      if (bekannt.has(item.datensatz.sha256)) { r.doppelt++; continue; }
      bekannt.add(item.datensatz.sha256);
      await api.queue.add(item);
      r.neu++;
    } catch {
      r.fehler++;
      r.meldungen.push(`${file.name}: Foto konnte nicht gelesen werden`);
    }
  }
  if (r.neu) api.syncNow?.();
  return r;
}

export async function assignFotos(api, fotoIds, felder) {
  for (const id of fotoIds) await api.update('fotos', id, felder);
}
