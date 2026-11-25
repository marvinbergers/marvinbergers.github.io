// Arbeitet die Warteschlange ab: Bild hochladen, Vorschau hochladen, Datensatz anlegen, Eintrag entfernen.
// Scheitert ein Schritt, bleibt der Eintrag für den nächsten Versuch liegen.

export async function syncOnce({ queue, sign, upload, insertFoto }) {
  let erledigt = 0; let fehler = 0;
  for (const item of await queue.pending()) {
    try {
      const d = item.datensatz;
      const [urlBild, urlVorschau] = await sign([
        { method: 'PUT', key: d.key_bild, contentType: 'image/jpeg' },
        { method: 'PUT', key: d.key_vorschau, contentType: 'image/jpeg' },
      ]);
      await upload(urlBild, item.bild, 'image/jpeg');
      await upload(urlVorschau, item.vorschau, 'image/jpeg');
      try {
        await insertFoto(d);
      } catch (e) {
        if (e?.code !== '23505') throw e; // 23505 = Foto existiert schon (Duplikat) → gilt als erledigt
      }
      await queue.remove(item.fotoId);
      erledigt++;
    } catch {
      fehler++;
    }
  }
  return { erledigt, fehler };
}

let laeuft = false;
let timer = null;

/** Startet die Hintergrund-Synchronisierung: sofort, bei „online“ und alle 60 s, solange etwas wartet. */
export function startSync(deps, { intervallMs = 60_000, onChange = () => {} } = {}) {
  const run = async () => {
    if (laeuft) return;
    laeuft = true;
    try {
      await syncOnce(deps);
    } finally {
      laeuft = false;
      const rest = await deps.queue.count();
      onChange(rest);
      clearTimeout(timer);
      if (rest > 0) timer = setTimeout(run, intervallMs);
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('online', run);
    window.addEventListener('warteschlange', run);
  }
  run();
  return run;
}
