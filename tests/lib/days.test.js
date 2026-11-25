import { describe, it, expect } from 'vitest';
import { berlinDate } from '../../bautagebuch/js/lib/days.js';

describe('berlinDate', () => {
  it('ordnet nach deutscher Zeit zu, nicht nach UTC', () => {
    expect(berlinDate(new Date('2027-03-16T23:30:00Z'))).toBe('2027-03-17'); // 00:30 MEZ
    expect(berlinDate(new Date('2027-03-27T23:30:00Z'))).toBe('2027-03-28'); // Nacht der Zeitumstellung
    expect(berlinDate(new Date('2027-07-01T21:59:00Z'))).toBe('2027-07-01'); // 23:59 MESZ
    expect(berlinDate(new Date('2027-07-01T22:00:00Z'))).toBe('2027-07-02'); // 00:00 MESZ
  });
});
