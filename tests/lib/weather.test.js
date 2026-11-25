import { describe, it, expect } from 'vitest';
import { weatherUrl, mapWeather } from '../../bautagebuch/js/lib/weather.js';

describe('Wetter (Open-Meteo)', () => {
  it('heute und jüngere Tage über forecast, ältere über archive', () => {
    const heute = new Date('2027-03-20T10:00:00Z');
    const u1 = new URL(weatherUrl(51.6, 6.2, '2027-03-17', heute));
    expect(u1.host).toBe('api.open-meteo.com');
    expect(u1.searchParams.get('start_date')).toBe('2027-03-17');
    expect(u1.searchParams.get('end_date')).toBe('2027-03-17');
    expect(u1.searchParams.get('timezone')).toBe('Europe/Berlin');
    expect(u1.searchParams.get('daily')).toContain('weather_code');
    const u2 = new URL(weatherUrl(51.6, 6.2, '2026-11-01', heute));
    expect(u2.host).toBe('archive-api.open-meteo.com');
  });
  it('übersetzt WMO-Code und Werte', () => {
    const json = { daily: { weather_code: [61], temperature_2m_min: [2.4], temperature_2m_max: [8.1], precipitation_sum: [3.2] } };
    expect(mapWeather(json)).toEqual({ text: 'Leichter Regen', tmin: 2.4, tmax: 8.1, niederschlag_mm: 3.2 });
  });
  it('unbekannter Code → „Wetter“ statt Absturz', () => {
    expect(mapWeather({ daily: { weather_code: [999], temperature_2m_min: [1], temperature_2m_max: [2], precipitation_sum: [0] } }).text).toBe('Wetter');
  });
});
