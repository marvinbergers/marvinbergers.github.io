import { describe, it, expect } from 'vitest';
import { summarizeHours, hoursLabel } from '../../bautagebuch/js/lib/hours.js';

const tage = [{ id: 't1', datum: '2027-03-17' }, { id: 't2', datum: '2027-03-18' }, { id: 't3', datum: '2027-04-02' }];
const personen = [{ id: 'm', name: 'Person A' }, { id: 'n', name: 'Person B' }];
const gewerke = [{ id: 'g', name: 'Trockenbau' }];

describe('summarizeHours', () => {
  it('zählt nur erfasste Stunden; Tage ohne Stunden zählen nicht als erfasst', () => {
    const a = [
      { tag_id: 't1', person_id: 'm', stunden: 4, gewerk_id: 'g' },
      { tag_id: 't1', person_id: 'n', stunden: null },
      { tag_id: 't2', person_id: 'n', stunden: null },
      { tag_id: 't3', person_id: 'n', stunden: 8 },
      { tag_id: 't3', firma_id: 'f', stunden: 6 },
    ];
    const s = summarizeHours(a, tage, personen, gewerke);
    expect(s.erfassteTage).toBe(2);
    expect(s.tageGesamt).toBe(3);
    expect(s.proPerson).toEqual([{ name: 'Person B', stunden: 8 }, { name: 'Person A', stunden: 4 }]);
    expect(s.proMonat).toEqual([{ monat: '2027-03', stunden: 4 }, { monat: '2027-04', stunden: 8 }]);
    expect(s.proGewerk).toEqual([{ gewerk: 'ohne Gewerk', stunden: 8 }, { gewerk: 'Trockenbau', stunden: 4 }]);
  });
  it('Firmenstunden zählen nicht als Eigenleistung', () => {
    const s = summarizeHours([{ tag_id: 't1', firma_id: 'f', stunden: 6 }], tage, personen, gewerke);
    expect(s.proPerson).toEqual([]);
  });
});

describe('hoursLabel', () => {
  it('sagt ehrlich, wie vollständig die Erfassung ist', () => {
    expect(hoursLabel(34, 52)).toBe('an 34 von 52 Tagen erfasst');
    expect(hoursLabel(1, 1)).toBe('an 1 von 1 Tag erfasst');
  });
});
