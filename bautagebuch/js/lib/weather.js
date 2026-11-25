// Wetter über Open-Meteo (kostenlos, ohne Schlüssel).
const TAG_MS = 86_400_000;
const DAILY = 'weather_code,temperature_2m_min,temperature_2m_max,precipitation_sum';

export function weatherUrl(lat, lon, datum, heute = new Date()) {
  const alter = (heute.getTime() - new Date(`${datum}T12:00:00Z`).getTime()) / TAG_MS;
  const host = alter > 90 ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';
  const u = new URL(host);
  u.search = new URLSearchParams({ latitude: lat, longitude: lon, daily: DAILY, timezone: 'Europe/Berlin', start_date: datum, end_date: datum }).toString();
  return u.toString();
}

const WMO = {
  0: 'Klar', 1: 'Überwiegend klar', 2: 'Teilweise bewölkt', 3: 'Bedeckt', 45: 'Nebel', 48: 'Nebel mit Reif',
  51: 'Leichter Nieselregen', 53: 'Nieselregen', 55: 'Starker Nieselregen', 56: 'Gefrierender Nieselregen', 57: 'Gefrierender Nieselregen',
  61: 'Leichter Regen', 63: 'Regen', 65: 'Starker Regen', 66: 'Gefrierender Regen', 67: 'Gefrierender Regen',
  71: 'Leichter Schneefall', 73: 'Schneefall', 75: 'Starker Schneefall', 77: 'Schneegriesel',
  80: 'Leichte Regenschauer', 81: 'Regenschauer', 82: 'Starke Regenschauer', 85: 'Schneeschauer', 86: 'Starke Schneeschauer',
  95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Gewitter mit Hagel',
};

export function mapWeather(json) {
  const d = json?.daily ?? {};
  return { text: WMO[d.weather_code?.[0]] ?? 'Wetter', tmin: d.temperature_2m_min?.[0] ?? null, tmax: d.temperature_2m_max?.[0] ?? null, niederschlag_mm: d.precipitation_sum?.[0] ?? null };
}

export function weatherText(w) {
  if (!w) return '';
  if (w.tmin == null) return w.text;
  return `${w.text}, ${Math.round(w.tmin)}–${Math.round(w.tmax)} °C${w.niederschlag_mm ? `, ${w.niederschlag_mm} mm` : ''}`;
}
