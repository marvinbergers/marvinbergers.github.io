import { html } from '../vendor/htm.js';
import { useState, useEffect, useRef } from '../vendor/preact.js';

export function Login({ auth }) {
  const [email, setEmail] = useState('');
  const [schritt, setSchritt] = useState('email');
  const [fehler, setFehler] = useState('');
  const [busy, setBusy] = useState(false);

  async function anfordern(e) {
    e?.preventDefault();
    setFehler(''); setBusy(true);
    try {
      await auth.requestCode(email);
      setSchritt('code');
    } catch (err) {
      const t = `${err?.message ?? ''}`.toLowerCase();
      setFehler(t.includes('signup') || err?.status === 422 || err?.status === 400
        ? 'Diese Adresse ist nicht freigeschaltet.'
        : 'Code konnte nicht gesendet werden. Bitte später erneut versuchen.');
    } finally { setBusy(false); }
  }

  async function codeEingabe(e) {
    const code = e.target.value.replace(/\D/g, '').slice(0, 6);
    e.target.value = code;
    if (code.length !== 6) return;
    setFehler(''); setBusy(true);
    try { await auth.verifyCode(email, code); } catch { setFehler('Code stimmt nicht oder ist abgelaufen.'); } finally { setBusy(false); }
  }

  return html`<div class="login karte">
    <h1>Bautagebuch</h1>
    ${schritt === 'email' ? html`
      <form onSubmit=${anfordern}>
        <label>E-Mail-Adresse<input type="email" autocomplete="email" required value=${email}
          onInput=${(e) => setEmail(e.target.value)} /></label>
        <p class="hinweis">Du bekommst einen 6-stelligen Code per E-Mail. Danach bleibst du auf diesem Handy angemeldet.</p>
        <button class="primaer" type="submit" disabled=${busy} onClick=${anfordern}>Code anfordern</button>
      </form>` : html`
      <p>Code an <b>${email}</b> gesendet.</p>
      <label>Code<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*"
        onInput=${codeEingabe} disabled=${busy} /></label>
      <button type="button" onClick=${() => { setSchritt('email'); setFehler(''); }}>Andere Adresse</button>`}
    ${fehler && html`<p class="fehler" role="alert">${fehler}</p>`}
  </div>`;
}

/** Zeigt die App nur angemeldet. Beim Abmelden bleibt alles im Gerät (Warteschlange) erhalten. */
export function AuthGate({ auth, onSignedIn = () => {}, children }) {
  const [status, setStatus] = useState('laden');
  const drin = useRef(false);
  useEffect(() => {
    auth.onAuthChange((event, session) => {
      const jetztDrin = event === 'SIGNED_IN';
      if (jetztDrin && !drin.current) onSignedIn(session);
      drin.current = jetztDrin;
      setStatus(jetztDrin ? 'drin' : 'draussen');
    });
  }, []);
  if (status === 'laden') return html`<p class="hinweis">Lädt …</p>`;
  return status === 'drin' ? children : html`<${Login} auth=${auth} />`;
}
