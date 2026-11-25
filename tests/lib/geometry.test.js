import { describe, it, expect } from 'vitest';
import { dragToDirection, toCompass, nearestRoom, suggestName, fitTransform, applyTransform } from '../../bautagebuch/js/lib/geometry.js';

describe('dragToDirection', () => {
  it('rechts = 90°, oben = 0°, unten = 180°, links = 270°', () => {
    expect(dragToDirection({ x: 50, y: 50 }, { x: 60, y: 50 })).toBe(90);
    expect(dragToDirection({ x: 50, y: 50 }, { x: 50, y: 40 })).toBe(0);
    expect(dragToDirection({ x: 50, y: 50 }, { x: 50, y: 60 })).toBe(180);
    expect(dragToDirection({ x: 50, y: 50 }, { x: 40, y: 50 })).toBe(270);
  });
  it('zu kurzer Zug ergibt null', () => {
    expect(dragToDirection({ x: 50, y: 50 }, { x: 51, y: 50 })).toBeNull();
    expect(dragToDirection({ x: 50, y: 50 }, { x: 50, y: 50 })).toBeNull();
  });
});

describe('toCompass', () => {
  it('richtet am Nordpfeil der Etage aus', () => {
    expect(toCompass(90, 0)).toBe('Ost');
    expect(toCompass(90, 90)).toBe('Nord');
    expect(toCompass(44, 0)).toBe('Nord');
    expect(toCompass(46, 0)).toBe('Ost');
    expect(toCompass(0, 90)).toBe('West');
    expect(toCompass(181, 0)).toBe('Süd');
  });
});

describe('Namensvorschlag', () => {
  const raeume = [{ name: 'Bad', x: 12, y: 12 }, { name: 'Küche', x: 80, y: 80 }];
  it('nächster Raum', () => {
    expect(nearestRoom({ x: 70, y: 75 }, raeume)).toBe('Küche');
    expect(nearestRoom({ x: 1, y: 1 }, [])).toBeNull();
  });
  it('Raum + Himmelsrichtung', () => {
    expect(suggestName({ x: 10, y: 10 }, 90, 0, raeume)).toBe('Bad – Ostwand');
    expect(suggestName({ x: 10, y: 10 }, 180, 0, [])).toBe('Stelle – Südwand');
  });
});

describe('fitTransform (Bestandsplan überlagern)', () => {
  it('bildet beide Passpunkte exakt ab', () => {
    const plan = [{ x: 10, y: 10 }, { x: 90, y: 30 }];
    const bestand = [{ x: 20, y: 50 }, { x: 60, y: 10 }];
    const t = fitTransform(plan, bestand);
    for (let i = 0; i < 2; i++) {
      const p = applyTransform(t, bestand[i]);
      expect(p.x).toBeCloseTo(plan[i].x, 6);
      expect(p.y).toBeCloseTo(plan[i].y, 6);
    }
  });
});
