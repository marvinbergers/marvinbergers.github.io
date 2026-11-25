// Tagebuch: Tag anlegen (mit Wetter), Verfasser-Namen.
import { weatherUrl, mapWeather } from '../lib/weather.js';

export async function findTag(api, datum) {
  return (await api.list('tage', { datum }))[0] ?? null;
}

/** Holt den Tag oder legt ihn an. Beim Anlegen wird einmal das Wetter geholt (wenn Koordinaten hinterlegt). */
export async function ensureTag(api, datum) {
  const da = await findTag(api, datum);
  if (da) return da;
  let wetter = null;
  try {
    const k = (await api.list('einstellungen')).find((e) => e.schluessel === 'haus_koordinaten')?.wert;
    if (k?.lat != null) wetter = mapWeather(await fetchWeather(api, weatherUrl(k.lat, k.lon, datum)));
  } catch { /* ohne Netz: Tag ohne Wetter anlegen */ }
  return api.insert('tage', { datum, wetter, wetter_manuell: false });
}

const fetchWeather = (api, url) => (api.fetchWeather ? api.fetchWeather(url) : fetch(url).then((r) => r.json()));

export function nameOf(uid, personen) {
  return personen.find((p) => p.nutzer_id && p.nutzer_id === uid)?.name ?? 'Unbekannt';
}
