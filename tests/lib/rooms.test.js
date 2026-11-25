import { describe, it, expect } from 'vitest';
import { roomAt, roomBox, fitView, wandNamen, normRect, SEITEN } from '../../bautagebuch/js/lib/rooms.js';

const bad = { id: 'bad', name: 'Bad', flaechen: [{ x1: 0, y1: 0, x2: 20, y2: 30 }] };
const wohnen = { id: 'wo', name: 'Wohnen', flaechen: [{ x1: 30, y1: 0, x2: 60, y2: 50 }, { x1: 30, y1: 50, x2: 45, y2: 80 }] };
const punkt = { id: 'alt', name: 'Alt', x: 90, y: 90 };

describe('roomAt', () => {
  it('trifft Räume, daneben nichts, Punkt-Räume nie', () => {
    expect(roomAt({ x: 10, y: 10 }, [bad, wohnen, punkt]).id).toBe('bad');
    expect(roomAt({ x: 25, y: 10 }, [bad, wohnen])).toBeNull();
    expect(roomAt({ x: 90, y: 90 }, [punkt])).toBeNull();
  });
  it('L-Raum: beide Teile gehören zum selben Raum', () => {
    expect(roomAt({ x: 50, y: 10 }, [bad, wohnen]).id).toBe('wo');
    expect(roomAt({ x: 40, y: 70 }, [bad, wohnen]).id).toBe('wo');
    expect(roomBox(wohnen)).toEqual({ x1: 30, y1: 0, x2: 60, y2: 80 });
  });
  it('bei Überlappung gewinnt der kleinere Raum', () => {
    const gross = { id: 'g', flaechen: [{ x1: 0, y1: 0, x2: 100, y2: 100 }] };
    expect(roomAt({ x: 5, y: 5 }, [gross, bad]).id).toBe('bad');
  });
});

describe('wandNamen', () => {
  it('Nordpfeil oben', () => {
    expect(wandNamen(0)).toEqual({ oben: 'Nordwand', rechts: 'Ostwand', unten: 'Südwand', links: 'Westwand', boden: 'Boden', decke: 'Decke' });
  });
  it('Plan gedreht: Norden zeigt nach rechts', () => {
    expect(wandNamen(90)).toMatchObject({ rechts: 'Nordwand', unten: 'Ostwand', links: 'Südwand', oben: 'Westwand' });
  });
  it('schräg (45°): keine doppelten Namen', () => {
    const n = wandNamen(45);
    const waende = ['oben', 'rechts', 'unten', 'links'].map((s) => n[s]);
    expect(new Set(waende).size).toBe(4);
  });
  it('sechs Seiten', () => { expect(SEITEN).toEqual(['oben', 'rechts', 'unten', 'links', 'boden', 'decke']); });
});

describe('normRect und fitView', () => {
  it('normiert beliebige Ecken', () => {
    expect(normRect({ x: 50, y: 40 }, { x: 10, y: 60 })).toEqual({ x1: 10, y1: 40, x2: 50, y2: 60 });
  });
  it('zoomt den Raum in den Rahmen und zentriert ihn', () => {
    // Rahmen 400×280 px, Plan im Seitenverhältnis 10:7 → Plan füllt den Rahmen bei s=1
    const v = fitView({ x1: 0, y1: 0, x2: 20, y2: 30 }, { w: 400, h: 280 }, 0);
    expect(v.s).toBeCloseTo(280 / (0.3 * 280), 3); // Höhe begrenzt: 30 % → voll
    const mitte = { x: (10 / 100) * 400 * v.s + v.x, y: (15 / 100) * 280 * v.s + v.y };
    expect(mitte.x).toBeCloseTo(200, 3);
    expect(mitte.y).toBeCloseTo(140, 3);
  });
  it('begrenzt den Zoom auf 1…6', () => {
    expect(fitView({ x1: 0, y1: 0, x2: 1, y2: 1 }, { w: 400, h: 280 }, 0).s).toBe(6);
    expect(fitView({ x1: 0, y1: 0, x2: 100, y2: 100 }, { w: 400, h: 280 }, 0)).toEqual({ s: 1, x: 0, y: 0 });
  });
});
