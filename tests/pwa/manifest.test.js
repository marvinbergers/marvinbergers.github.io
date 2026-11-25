import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const manifest = JSON.parse(readFileSync('bautagebuch/manifest.webmanifest', 'utf8'));

describe('manifest', () => {
  it('ist auf /bautagebuch/ begrenzt und eigenständig', () => {
    expect(manifest.start_url).toBe('/bautagebuch/');
    expect(manifest.scope).toBe('/bautagebuch/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.lang).toBe('de');
  });
  it('hat Icons in 192 und 512', () => {
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });
  it('ist Teilen-Ziel für Bilder', () => {
    const st = manifest.share_target;
    expect(st.action).toBe('/bautagebuch/teilen');
    expect(st.method).toBe('POST');
    expect(st.enctype).toBe('multipart/form-data');
    expect(st.params.files[0].accept).toContain('image/*');
  });
});
