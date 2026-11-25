import { describe, it, expect } from 'vitest';
import { sortByFrequency, countUsage } from '../../bautagebuch/js/lib/frequency.js';

const g = [{ id: 'a', sortierung: 1 }, { id: 'b', sortierung: 2 }, { id: 'c', sortierung: 3 }];
describe('sortByFrequency', () => {
  it('häufigstes Gewerk zuerst, bei Gleichstand nach Sortierung', () => {
    const n = countUsage([{ gewerk_id: 'c' }, { gewerk_id: 'c' }, { gewerk_id: 'b' }, { gewerk_id: null }]);
    expect(sortByFrequency(g, n).map((x) => x.id)).toEqual(['c', 'b', 'a']);
    expect(sortByFrequency(g, []).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});
