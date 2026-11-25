// Fotoaufnahme über die eingebaute Kamera des Handys (kein getUserMedia).
import { html } from '../vendor/htm.js';
import { useState } from '../vendor/preact.js';
import { processImage as defaultProcess } from '../lib/photo.js';
import { fotoKeys } from '../lib/keys.js';
import { berlinDate } from '../lib/days.js';
import { sortByFrequency, countUsage } from '../lib/frequency.js';
import { CategoryPicker } from './CategoryPicker.js';
import { ensureWand } from '../data/actions.js';
import { wandTitel } from '../lib/rooms.js';

const uuid = () => crypto.randomUUID();

/** Öffnet die Systemkamera. Muss direkt im Klick-Handler aufgerufen werden (iOS). Ergebnis: File oder null. */
export function pickFile({ kamera = true, mehrere = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (kamera) input.setAttribute('capture', 'environment');
    if (mehrere) input.multiple = true;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const files = [...(input.files ?? [])];
      input.remove();
      resolve(mehrere ? files : files[0] ?? null);
    }, { once: true });
    input.addEventListener('cancel', () => { input.remove(); resolve(mehrere ? [] : null); }, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

/** Verarbeitet ein Foto: verkleinern, Datum, Fingerabdruck, Speicherschlüssel. */
export async function preparePhoto(api, file, felder = {}) {
  const p = await (api.processImage ?? defaultProcess)(file);
  const id = uuid();
  const keys = fotoKeys(id, p.aufgenommenAm);
  const datensatz = {
    id, stelle_id: felder.stelle_id ?? null, gewerk_id: felder.gewerk_id ?? null, phase_id: felder.phase_id ?? null,
    notiz: felder.notiz || null, checkpunkt: felder.checkpunkt ?? null, aufgenommen_am: p.aufgenommenAm.toISOString(), datum_geschaetzt: p.datumGeschaetzt,
    tag: berlinDate(p.aufgenommenAm), key_bild: keys.bild, key_vorschau: keys.vorschau, sha256: p.sha256,
    breite: p.breite, hoehe: p.hoehe,
  };
  // Offline aufgenommen und Wand noch nicht angelegt: Wand wird beim Hochladen nachgeholt.
  if (felder.wand) datensatz.wand = felder.wand;
  return { typ: 'foto', fotoId: id, bild: p.bild, vorschau: p.vorschau, datensatz };
}

/** Verarbeitet ein Foto und legt es in die Warteschlange. Liefert den Datensatz. */
export async function enqueuePhoto(api, file, felder) {
  const item = await preparePhoto(api, file, felder);
  await api.queue.add(item);
  api.syncNow?.();
  return item.datensatz;
}

/** Gewerk/Phase nachtragen: im Gerät, solange das Foto wartet, sonst in der Datenbank. */
export async function setzeKategorie(api, fotoId, felder) {
  const wartet = await api.queue.patch?.(fotoId, felder);
  if (!wartet) await api.update('fotos', fotoId, felder);
  api.syncNow?.();
}

/** Aufnahme-Ablauf für den Grundriss: liefert Auslöser und das Overlay. */
export function useCapture(api, { onSaved = () => {} } = {}) {
  const [zustand, setZustand] = useState(null); // {art:'waehlen'|'gespeichert'|'eingang'|'fehler', ...}

  /** Foto an einer Wand: Kamera zuerst (iOS verlangt den direkten Klick), dann Wand-Stelle sicherstellen. */
  async function anWand(etage, raum, seite, ctx) {
    const file = await pickFile();
    if (!file) return;
    const name = wandTitel(raum, seite, etage.nord_grad ?? 0);
    let stelle = ctx.wandStelle ?? null;
    if (!stelle) { try { stelle = await ensureWand(api, etage, raum, seite); } catch { stelle = null; } }
    const wand = stelle ? null : { etage_id: etage.id, nord_grad: etage.nord_grad ?? 0, raum_id: raum.id, raum_name: raum.name, seite };
    await mitDatei({ id: stelle?.id ?? null, name, spaeter: !stelle }, { ...ctx, wandStelle: stelle, etage, raum, seite }, file, wand);
  }

  async function aufStelle(stelle, ctx) {
    const file = await pickFile();
    if (!file) return;
    await mitDatei(stelle, ctx, file);
  }

  async function mitDatei(stelle, ctx, file, wand = null) {
    const gewerke = sortByFrequency(ctx.gewerke, countUsage(ctx.fotos));
    try {
      // Sofort sichern: Kamerafotos liegen oft nicht in der Galerie. Gewerk/Phase werden danach nachgetragen.
      const d = await enqueuePhoto(api, file, { stelle_id: stelle.id, checkpunkt: ctx.checkpunkt ?? null, ...(wand && { wand }) });
      setZustand({ art: 'waehlen', stelle, fotoId: d.id, ctx: { ...ctx, gewerke }, n: Date.now() });
    } catch (e) { setZustand({ art: 'fehler', text: e.message }); }
  }

  async function gewaehlt(auswahl) {
    const { stelle, fotoId, ctx } = zustand;
    try {
      await setzeKategorie(api, fotoId, auswahl);
      setZustand({ art: 'gespeichert', stelle, ctx });
      onSaved();
    } catch (e) { setZustand({ art: 'fehler', text: `Gewerk/Phase nicht gespeichert: ${e.message}. Das Foto liegt im Eingang.` }); }
  }

  async function verwerfen() {
    const { fotoId } = zustand;
    setZustand(null);
    if (await api.queue.get?.(fotoId)) await api.queue.remove(fotoId);
    else await api.softDelete('fotos', fotoId).catch(() => {});
    onSaved();
  }

  async function quick() {
    const file = await pickFile();
    if (!file) return;
    try {
      await enqueuePhoto(api, file, {});
      setZustand({ art: 'eingang' });
      onSaved();
      setTimeout(() => setZustand((z) => (z?.art === 'eingang' ? null : z)), 2500);
    } catch (e) { setZustand({ art: 'fehler', text: e.message }); }
  }

  let overlay = null;
  if (zustand?.art === 'waehlen') {
    overlay = html`<div class="dialog karte"><${CategoryPicker} key=${zustand.n} titel=${zustand.ctx.checkpunkt ? `${zustand.stelle.name} · ${zustand.ctx.checkpunkt}` : zustand.stelle.name}
      gewerke=${zustand.ctx.gewerke} phasen=${zustand.ctx.phasen} onComplete=${gewaehlt} />
      <button onClick=${verwerfen}>Verwerfen</button></div>`;
  } else if (zustand?.art === 'gespeichert') {
    overlay = html`<div class="dialog karte" role="status"><p>✓ Gespeichert · ${zustand.stelle.name}</p>
      ${zustand.stelle.spaeter && html`<p class="hinweis">Kein Netz: Das Foto wird der Wand zugeordnet, sobald es hochgeladen wird.</p>`}
      <div class="knopfgitter"><button onClick=${() => setZustand(null)}>Fertig</button>
      <button class="primaer" onClick=${() => (zustand.ctx.raum
        ? anWand(zustand.ctx.etage, zustand.ctx.raum, zustand.ctx.seite, { ...zustand.ctx, checkpunkt: null })
        : aufStelle(zustand.stelle, { ...zustand.ctx, checkpunkt: null }))}>noch eins</button></div></div>`;
  } else if (zustand?.art === 'eingang') {
    overlay = html`<div class="dialog karte" role="status"><p>✓ Im Eingang – später einsortieren.</p></div>`;
  } else if (zustand?.art === 'fehler') {
    overlay = html`<div class="dialog karte" role="alert"><p class="fehler">${zustand.text}</p><button onClick=${() => setZustand(null)}>OK</button></div>`;
  }
  return { atStelle: aufStelle, atWand: anWand, quick, overlay };
}
