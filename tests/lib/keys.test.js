import { describe, it, expect } from 'vitest';
import { fotoKeys, isValidKey } from '../../bautagebuch/js/lib/keys.js';

describe('Speicherschlüssel', () => {
  it('Fotos nach Jahr/Monat', () => {
    const k = fotoKeys('abc', new Date('2027-03-17T10:00:00Z'));
    expect(k.bild).toBe('fotos/2027/03/abc.jpg');
    expect(k.vorschau).toBe('fotos/2027/03/abc_v.jpg');
  });
  it('nur erlaubte Bereiche, kein ..', () => {
    expect(isValidKey('plaene/eg.png')).toBe(true);
    expect(isValidKey('dokumente/elektro plan.pdf')).toBe(false);
    expect(isValidKey('dokumente/elektro-plan.pdf')).toBe(true);
    expect(isValidKey('fotos/../x')).toBe(false);
    expect(isValidKey('geheim/x.jpg')).toBe(false);
    expect(isValidKey('')).toBe(false);
  });
});
