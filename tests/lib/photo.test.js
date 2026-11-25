import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { targetSize, readCaptureDate, processImage, FotoFehler } from '../../bautagebuch/js/lib/photo.js';

const datei = (name, lastModified = Date.UTC(2027, 2, 17, 9)) =>
  new File([readFileSync(`tests/fixtures/${name}`)], name, { type: 'image/jpeg', lastModified });

// Canvas gibt es in Node nicht: Dekodieren/Kodieren werden ersetzt.
const fakeDeps = {
  decode: async (blob) => {
    const b = new Uint8Array(await blob.arrayBuffer());
    if (b.length < 50) throw new Error('decode');
    return { width: 4032, height: 3024, close() {} };
  },
  encode: async (bmp, w, h, q) => new Blob([`${w}x${h}@${q}`], { type: 'image/jpeg' }),
};

describe('targetSize', () => {
  it('verkleinert auf 2560 an der langen Kante', () => {
    expect(targetSize(4032, 3024)).toEqual({ w: 2560, h: 1920 });
    expect(targetSize(3024, 4032)).toEqual({ w: 1920, h: 2560 });
  });
  it('vergrößert nicht', () => {
    expect(targetSize(1000, 800)).toEqual({ w: 1000, h: 800 });
  });
});

describe('readCaptureDate', () => {
  it('nimmt EXIF DateTimeOriginal (lokale Zeit)', async () => {
    const r = await readCaptureDate(datei('mit-exif.jpg'));
    expect(r.geschaetzt).toBe(false);
    expect(r.date.toISOString()).toBe('2027-03-17T08:15:00.000Z'); // 09:15 MEZ
  });
  it('ohne EXIF: Dateidatum, als geschätzt markiert', async () => {
    const r = await readCaptureDate(datei('ohne-exif.jpg'));
    expect(r.geschaetzt).toBe(true);
    expect(r.date.getTime()).toBe(Date.UTC(2027, 2, 17, 9));
  });
  it('ohne EXIF und ohne Dateidatum: nie 1970', async () => {
    const r = await readCaptureDate(datei('ohne-exif.jpg', 0));
    expect(r.geschaetzt).toBe(true);
    expect(r.date.getFullYear()).toBeGreaterThanOrEqual(2000);
  });
});

describe('processImage', () => {
  it('liefert Bild, Vorschau, Maße, Hash und Datum', async () => {
    const r = await processImage(datei('mit-exif.jpg'), fakeDeps);
    expect(await r.bild.text()).toBe('2560x1920@0.85');
    expect(await r.vorschau.text()).toBe('400x300@0.8');
    expect(r.breite).toBe(2560);
    expect(r.hoehe).toBe(1920);
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.datumGeschaetzt).toBe(false);
  });
  it('gleiches Foto → gleicher Hash', async () => {
    const a = await processImage(datei('ohne-exif.jpg'), fakeDeps);
    const b = await processImage(datei('ohne-exif.jpg'), fakeDeps);
    expect(a.sha256).toBe(b.sha256);
  });
  it('unlesbare Datei → FotoFehler mit deutscher Meldung', async () => {
    await expect(processImage(datei('kaputt.jpg'), fakeDeps)).rejects.toBeInstanceOf(FotoFehler);
    await expect(processImage(datei('kaputt.jpg'), fakeDeps)).rejects.toThrow('Foto konnte nicht gelesen werden');
  });
});
