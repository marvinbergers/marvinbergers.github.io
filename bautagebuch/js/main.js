import { render } from './vendor/preact.js';
import { html } from './vendor/htm.js';
import { useState, useEffect } from './vendor/preact.js';
import { SUPABASE_URL } from './config.js';
import { ApiContext, useApi } from './data/api.js';
import { imEingang } from './data/inbox.js';
import { openQueue } from './lib/queue.js';
import { SyncBadge } from './ui/SyncBadge.js';

export const ROUTES = ['grundriss', 'tagebuch', 'eingang', 'einrichtung', 'papierkorb'];
const TABS = [
  { route: 'grundriss', label: 'Grundriss' },
  { route: 'tagebuch', label: 'Tagebuch' },
  { route: 'eingang', label: 'Eingang' },
];
const views = {};

/** Seiten melden sich hier an, damit main.js ohne Zirkelimporte bleibt. */
export function registerView(route, component) { views[route] = component; }

export function currentRoute() {
  const r = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
  return ROUTES.includes(r) ? r : 'grundriss';
}

export function navigate(route) { location.hash = `#/${route}`; }

export function Shell({ warteschlange = 0, demo = false }) {
  const api = useApi();
  const [route, setRoute] = useState(currentRoute());
  const [badges, setBadges] = useState({});
  useEffect(() => {
    const f = () => setRoute(currentRoute());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  // Zahl im Menü: Fotos im Eingang. Neu berechnet bei jedem Seitenwechsel und nach Uploads.
  useEffect(() => {
    api?.list('fotos').then((fotos) => setBadges({ eingang: fotos.filter(imEingang).length })).catch(() => {});
  }, [route, warteschlange]);
  const View = views[route];
  return html`
    ${demo && html`<div class="demo">Vorschau ohne Server – nichts wird gespeichert.</div>`}
    <${SyncBadge} count=${warteschlange} />
    <main class="view">${View ? html`<${View} />` : html`<p class="leer">${route}</p>`}</main>
    <nav class="tabs">
      ${TABS.map((t) => html`<a href=${'#/' + t.route} class=${t.route === route ? 'aktiv' : ''} data-route=${t.route}>
        ${t.label}${badges[t.route] ? html` <span class="badge">${badges[t.route]}</span>` : ''}</a>`)}
    </nav>`;
}

async function start(root) {
  await import('./ui/views.js'); // registriert alle Seiten
  const queue = await openQueue();
  const demo = !SUPABASE_URL || new URLSearchParams(location.search).has('demo');
  if (demo) {
    const { createMemoryApi } = await import('./data/memory.js');
    const { demoSeed, demoBlobs } = await import('./data/demo.js');
    const api = createMemoryApi({ queue, seed: demoSeed(), seedBlobs: demoBlobs() });
    window.__btApi = api;
    render(html`<${ApiContext.Provider} value=${api}><${Shell} demo=${true} /><//>`, root);
    return;
  }
  const { getClient, requestCode, verifyCode, onAuthChange } = await import('./data/supabase.js');
  const { createRemoteApi } = await import('./data/remote.js');
  const { AuthGate } = await import('./ui/Login.js');
  const client = await getClient();
  const auth = {
    requestCode: (e) => requestCode(client, e),
    verifyCode: (e, c) => verifyCode(client, e, c),
    onAuthChange: (cb) => onAuthChange(client, cb),
  };
  function App() {
    const [api, setApi] = useState(null);
    const [wartend, setWartend] = useState(0);
    const signedIn = async () => {
      const { data } = await client.auth.getUser();
      setApi(createRemoteApi({ client, queue, me: { id: data.user.id, email: data.user.email }, onQueueChange: setWartend }));
    };
    return html`<${AuthGate} auth=${auth} onSignedIn=${signedIn}>
      ${api ? html`<${ApiContext.Provider} value=${api}><${Shell} warteschlange=${wartend} /><//>` : html`<p class="hinweis">Lädt …</p>`}
    <//>`;
  }
  render(html`<${App} />`, root);
}

if (typeof window !== 'undefined' && !globalThis.__BT_TEST__) {
  start(document.getElementById('app'));
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { scope: './' });
}
