// Arbeitet die Warteschlange ab: Bild hochladen, Vorschau hochladen, Datensatz anlegen, Eintrag entfernen.
// Scheitert ein Schritt, bleibt der Eintrag für den nächsten Versuch liegen.

const KATEGORIE = ['stelle_id', 'gewerk_id', 'phase_id', 'notiz', 'checkpunkt'];

export async function syncOnce({ queue, sign, upload, insertFoto, updateFoto = async () => {}, ensureWand = null }) {
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
      let zeile = d;
      if (d.wand) { // offline aufgenommen: Wand jetzt anlegen bzw. finden
        if (!ensureWand) throw new Error('Wand kann nicht angelegt werden');
        const { wand, ...rest } = d;
        zeile = { ...rest, stelle_id: (await ensureWand(wand)).id };
      }
      try {
        await insertFoto(zeile);
      } catch (e) {
        if (e?.code !== '23505') throw e; // 23505 = Foto existiert schon (Duplikat) → gilt als erledigt
      }
      // Wurde während des Uploads Gewerk/Phase gewählt, die Änderung nachtragen.
      const jetzt = await queue.get?.(item.fotoId);
      if (jetzt && (jetzt.rev ?? 0) !== (item.rev ?? 0)) {
        await updateFoto(d.id, Object.fromEntries(KATEGORIE.map((k) => [k, jetzt.datensatz[k] ?? null])));
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
