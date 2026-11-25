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

import { groupFotosByDay } from '../../bautagebuch/js/lib/days.js';
describe('groupFotosByDay', () => {
  it('gruppiert nach Tag und Stelle, Eingang unter null', () => {
    const fotos = [
      { id: 1, tag: '2027-03-17', stelle_id: 'a' }, { id: 2, tag: '2027-03-17', stelle_id: 'a' },
      { id: 3, tag: '2027-03-17', stelle_id: null }, { id: 4, tag: '2027-03-18', stelle_id: 'b' },
    ];
    const m = groupFotosByDay(fotos);
    expect([...m.keys()]).toEqual(['2027-03-17', '2027-03-18']);
    const tag = m.get('2027-03-17');
    expect(tag.map((g) => [g.stelle_id, g.fotos.length])).toEqual([['a', 2], [null, 1]]);
  });
});
