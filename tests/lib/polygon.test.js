import { describe, it, expect } from 'vitest';
import {
  pointInPolygon, roomAt, polyBox, uhrzeigersinn, kanten, wandNamen, raumPunkt, einrasten, punktEinfuegen, punktLoeschen,
} from '../../bautagebuch/js/lib/polygon.js';

const P = (id, x, y) => ({ id, x, y });
const quadrat = [P('a', 10, 10), P('b', 30, 10), P('c', 30, 30), P('d', 10, 30)];
// L-Form: oben breit, unten links schmal
const L = [P('a', 0, 0), P('b', 40, 0), P('c', 40, 20), P('d', 20, 20), P('e', 20, 60), P('f', 0, 60)];

describe('Treffer und Lage', () => {
  it('pointInPolygon / roomAt, auch konkav', () => {
    expect(pointInPolygon({ x: 20, y: 20 }, quadrat)).toBe(true);
    expect(pointInPolygon({ x: 5, y: 20 }, quadrat)).toBe(false);
    expect(pointInPolygon({ x: 30, y: 40 }, L)).toBe(false); // in der Aussparung
    expect(pointInPolygon({ x: 10, y: 50 }, L)).toBe(true);
    const r1 = { id: 'q', ecken: quadrat }; const r2 = { id: 'l', ecken: L };
    expect(roomAt({ x: 35, y: 10 }, [r1, r2]).id).toBe('l');
    expect(roomAt({ x: 20, y: 20 }, [r2, r1]).id).toBe('q'); // Überlappung: kleinerer Raum
    expect(roomAt({ x: 90, y: 90 }, [r1, r2])).toBeNull();
  });
  it('polyBox', () => { expect(polyBox(L)).toEqual({ x1: 0, y1: 0, x2: 40, y2: 60 }); });
  it('Raumpunkt liegt auch im L sicher im Raum, weit weg von den Wänden', () => {
    const p = raumPunkt({ ecken: L }, 1);
    expect(pointInPolygon(p, L)).toBe(true);
    expect(p.x).toBeGreaterThan(2); expect(p.x).toBeLessThan(18);
  });
});

describe('Richtung und Namen', () => {
  it('normiert gegen den Uhrzeigersinn gezeichnete Räume', () => {
    expect(uhrzeigersinn([...quadrat].reverse()).map((p) => p.id)).toEqual(['d', 'a', 'b', 'c']); // gleiche Reihenfolge im Kreis
    expect(uhrzeigersinn(quadrat).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
    const gegen = [P('a', 10, 10), P('d', 10, 30), P('c', 30, 30), P('b', 30, 10)];
    const n1 = wandNamen({ ecken: quadrat }, 0, 1); const n2 = wandNamen({ ecken: gegen }, 0, 1);
    expect(n1.get('a')).toBe('Nordwand');
    expect(n2.get('a')).toBe(n1.get('a')); // Wand ab a ist dieselbe Nordwand
  });
  it('Kanten beginnen an ihrer Ecke', () => {
    expect(kanten(quadrat).map((k) => [k.id, k.b.id])).toEqual([['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a']]);
  });
  it('Quadrat mit Nordpfeil oben', () => {
    const n = wandNamen({ ecken: quadrat }, 0, 1);
    expect([...n.values()]).toEqual(['Nordwand', 'Ostwand', 'Südwand', 'Westwand']);
  });
  it('L-Form: doppelte Richtungen werden nummeriert', () => {
    const n = wandNamen({ ecken: L }, 0, 1);
    expect(n.get('a')).toBe('Nordwand');
    expect(n.get('b')).toBe('Ostwand 1'); // außen rechts oben
    expect(n.get('d')).toBe('Ostwand 2'); // Innenecke, rechte Seite des unteren Teils
    expect(n.get('c')).toBe('Südwand 1'); // Stufe
    expect(n.get('e')).toBe('Südwand 2'); // ganz unten
    expect(n.get('f')).toBe('Westwand');
  });
  it('Nordpfeil gedreht', () => {
    expect(wandNamen({ ecken: quadrat }, 90, 1).get('b')).toBe('Nordwand');
  });
  it('Seitenverhältnis wird berücksichtigt (schräge Wand)', () => {
    // Dreieck mit Schräge von (0,0) nach (100,100): bei sehr breitem Plan zeigt die Schräge eher nach oben
    const dreieck = [P('a', 0, 0), P('b', 100, 100), P('c', 0, 100)];
    expect(wandNamen({ ecken: dreieck }, 0, 4).get('a')).toBe('Nordwand');
    expect(wandNamen({ ecken: dreieck }, 0, 0.25).get('a')).toBe('Ostwand');
  });
});

describe('Bearbeiten', () => {
  it('einrasten an Ecken anderer Räume', () => {
    const andere = [{ ecken: [P('x', 50, 50)] }];
    expect(einrasten({ x: 50.8, y: 49.5 }, andere)).toEqual({ x: 50, y: 50 });
    expect(einrasten({ x: 53, y: 50 }, andere)).toEqual({ x: 53, y: 50 });
  });
  it('Punkt einfügen teilt die Linie; die erste Hälfte behält die Kennung', () => {
    const neu = punktEinfuegen(quadrat, 'a', 'n1');
    expect(neu.map((p) => p.id)).toEqual(['a', 'n1', 'b', 'c', 'd']);
    expect(neu[1]).toMatchObject({ x: 20, y: 10 });
  });
  it('Punkt löschen: die Linie davor übernimmt (Fotos ziehen dorthin um)', () => {
    const r = punktLoeschen(quadrat, 'b');
    expect(r.ecken.map((p) => p.id)).toEqual(['a', 'c', 'd']);
    expect(r.umzug).toEqual({ von: 'b', nach: 'a' });
    expect(punktLoeschen(quadrat, 'a').umzug).toEqual({ von: 'a', nach: 'd' });
    expect(() => punktLoeschen(quadrat.slice(0, 3), 'a')).toThrow(/mindestens 3/);
  });
});
