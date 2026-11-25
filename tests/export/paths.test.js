import { describe, it, expect } from 'vitest';
import { fotoDateiname, stellenOrdner, sauber } from '../../tools/export/paths.mjs';

describe('Archiv-Pfade', () => {
  it('Fotodateiname aus Tag, Gewerk, Phase und Laufnummer', () => {
    expect(fotoDateiname({ tag: '2027-03-17' }, { name: 'Elektro' }, { name: 'Installation' }, 1)).toBe('2027-03-17_Elektro_Installation_01.jpg');
    expect(fotoDateiname({ tag: '2027-03-17' }, null, null, 12)).toBe('2027-03-17_12.jpg');
  });
  it('Stellen-Ordner, für Windows gültig, Umlaute bleiben', () => {
    expect(stellenOrdner({ name: 'EG' }, { name: 'Bad – Ostwand' })).toBe('Stellen/EG/Bad – Ostwand');
    expect(stellenOrdner({ name: 'EG' }, { name: 'Küche: Spüle/Fenster?' })).toBe('Stellen/EG/Küche- Spüle-Fenster-');
    expect(sauber('a\\b*c"d<e>f|g')).toBe('a-b-c-d-e-f-g');
  });
});
