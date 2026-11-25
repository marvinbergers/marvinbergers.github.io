import { describe, it, expect } from 'vitest';
import { validateRequest, KEY_REGEX as SERVER_REGEX } from '../../supabase/functions/r2-sign/logic.ts';
import { KEY_REGEX as CLIENT_REGEX } from '../../bautagebuch/js/lib/keys.js';

const put = (key = 'fotos/2027/03/a.jpg') => ({ method: 'PUT', key, contentType: 'image/jpeg' });

describe('validateRequest', () => {
  it('gültiger PUT', () => {
    expect(validateRequest({ ops: [put()] })).toEqual({ ok: true, ops: [put()] });
  });
  it('GET und DELETE ohne contentType erlaubt', () => {
    expect(validateRequest({ ops: [{ method: 'GET', key: 'plaene/eg.png' }, { method: 'DELETE', key: 'fotos/2027/03/a.jpg' }] }).ok).toBe(true);
  });
  it('Key mit .. → 400', () => {
    expect(validateRequest({ ops: [put('fotos/../geheim')] })).toMatchObject({ ok: false, status: 400 });
  });
  it('mehr als 50 Ops → 400', () => {
    expect(validateRequest({ ops: Array.from({ length: 51 }, () => put()) })).toMatchObject({ ok: false, status: 400 });
  });
  it('Methode POST → 400', () => {
    expect(validateRequest({ ops: [{ method: 'POST', key: 'fotos/a.jpg' }] })).toMatchObject({ ok: false, status: 400 });
  });
  it('PUT ohne contentType → 400', () => {
    expect(validateRequest({ ops: [{ method: 'PUT', key: 'fotos/a.jpg' }] })).toMatchObject({ ok: false, status: 400 });
  });
  it('leerer oder kaputter Body → 400', () => {
    expect(validateRequest(null)).toMatchObject({ ok: false, status: 400 });
    expect(validateRequest({ ops: [] })).toMatchObject({ ok: false, status: 400 });
  });
  it('Server und App nutzen dieselbe Schlüsselregel', () => {
    expect(SERVER_REGEX.source).toBe(CLIENT_REGEX.source);
  });
});
