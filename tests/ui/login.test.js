// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { mount, html, type, click, flush, byText } from './helpers.js';
import { requestCode, verifyCode } from '../../bautagebuch/js/data/supabase.js';
import { Login, AuthGate } from '../../bautagebuch/js/ui/Login.js';
import { openQueue } from '../../bautagebuch/js/lib/queue.js';

const client = (over = {}) => ({ auth: {
  signInWithOtp: vi.fn(async () => ({ error: null })),
  verifyOtp: vi.fn(async () => ({ error: null, data: { session: {} } })),
  ...over } });

describe('requestCode / verifyCode', () => {
  it('fordert einen Code an – nie einen Link, nie ein neues Konto', async () => {
    const c = client();
    await requestCode(c, ' Eins@Example.org ');
    expect(c.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'eins@example.org', options: { shouldCreateUser: false } });
    expect(JSON.stringify(c.auth.signInWithOtp.mock.calls)).not.toContain('emailRedirectTo');
  });
  it('prüft den Code als E-Mail-OTP', async () => {
    const c = client();
    await verifyCode(c, 'eins@example.org', '123456');
    expect(c.auth.verifyOtp).toHaveBeenCalledWith({ email: 'eins@example.org', token: '123456', type: 'email' });
  });
});

describe('Login-Maske', () => {
  const auth = (over = {}) => ({ requestCode: vi.fn(async () => {}), verifyCode: vi.fn(async () => {}), ...over });

  it('zeigt nach dem Anfordern ein Code-Feld für 6 Ziffern', async () => {
    const a = auth();
    const el = mount(html`<${Login} auth=${a} />`);
    await type(el.querySelector('input[type=email]'), 'eins@example.org');
    await click(byText(el, 'button', 'Code anfordern'));
    const code = el.querySelector('input[name=code]');
    expect(code.getAttribute('inputmode')).toBe('numeric');
    expect(code.getAttribute('autocomplete')).toBe('one-time-code');
    expect(code.getAttribute('maxlength')).toBe('6');
  });

  it('meldet sich bei 6 Ziffern automatisch an', async () => {
    const a = auth();
    const el = mount(html`<${Login} auth=${a} />`);
    await type(el.querySelector('input[type=email]'), 'eins@example.org');
    await click(byText(el, 'button', 'Code anfordern'));
    await type(el.querySelector('input[name=code]'), '123456');
    expect(a.verifyCode).toHaveBeenCalledWith('eins@example.org', '123456');
  });

  it('falscher Code → verständliche Meldung', async () => {
    const a = auth({ verifyCode: vi.fn(async () => { throw new Error('Token has expired or is invalid'); }) });
    const el = mount(html`<${Login} auth=${a} />`);
    await type(el.querySelector('input[type=email]'), 'eins@example.org');
    await click(byText(el, 'button', 'Code anfordern'));
    await type(el.querySelector('input[name=code]'), '000000');
    expect(el.textContent).toContain('Code stimmt nicht oder ist abgelaufen');
  });

  it('unbekannte Adresse → nicht freigeschaltet', async () => {
    const a = auth({ requestCode: vi.fn(async () => { throw Object.assign(new Error('Signups not allowed for otp'), { status: 422 }); }) });
    const el = mount(html`<${Login} auth=${a} />`);
    await type(el.querySelector('input[type=email]'), 'fremd@example.org');
    await click(byText(el, 'button', 'Code anfordern'));
    expect(el.textContent).toContain('Diese Adresse ist nicht freigeschaltet');
  });
});

describe('AuthGate', () => {
  it('abgelaufene Sitzung behält Warteschlange und synchronisiert nach neuer Anmeldung', async () => {
    const queue = await openQueue('auth-gate');
    await queue.add({ typ: 'foto', fotoId: 'x', bild: new Blob(['b']), vorschau: new Blob(['v']), datensatz: {} });
    let cb;
    const auth = { onAuthChange: (f) => { cb = f; }, requestCode: vi.fn(), verifyCode: vi.fn() };
    const onSignedIn = vi.fn();
    const el = mount(html`<${AuthGate} auth=${auth} onSignedIn=${onSignedIn}><p>App</p><//>`);
    await flush(); // useEffect läuft nach dem Rendern
    cb('SIGNED_IN', { user: {} }); await flush();
    expect(el.textContent).toContain('App');
    cb('SIGNED_OUT', null); await flush();
    expect(el.querySelector('input[type=email]')).not.toBeNull();
    expect(await queue.count()).toBe(1);
    cb('SIGNED_IN', { user: {} }); await flush();
    expect(onSignedIn).toHaveBeenCalledTimes(2);
    expect(await queue.count()).toBe(1);
  });
});
