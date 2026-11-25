import { describe, it, expect, vi } from 'vitest';
await import('../../bautagebuch/js/lib/share-target.js');
const { handleShare } = globalThis.btShare;

describe('Android-Teilen-Ziel', () => {
  it('legt geteilte Fotos ab und leitet in den Eingang', async () => {
    const fd = new FormData();
    fd.append('fotos', new File(['a'], 'a.jpg', { type: 'image/jpeg' }));
    fd.append('fotos', new File(['b'], 'b.jpg', { type: 'image/jpeg' }));
    const req = new Request('https://x/bautagebuch/teilen', { method: 'POST', body: fd });
    const addShared = vi.fn(async () => {});
    const res = await handleShare(req, addShared);
    expect(addShared).toHaveBeenCalledTimes(1);
    expect(addShared.mock.calls[0][0].map((f) => f.name)).toEqual(['a.jpg', 'b.jpg']);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/bautagebuch/#/eingang');
  });
});
