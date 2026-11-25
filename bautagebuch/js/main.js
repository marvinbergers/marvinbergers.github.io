import { render } from './vendor/preact.js';
import { html } from './vendor/htm.js';

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

function Shell({ route, badges = {} }) {
  const View = views[route];
  return html`
    <main class="view">${View ? html`<${View} />` : html`<p class="leer">${route}</p>`}</main>
    <nav class="tabs">
      ${TABS.map((t) => html`<a href=${'#/' + t.route} class=${t.route === route ? 'aktiv' : ''} data-route=${t.route}>
        ${t.label}${badges[t.route] ? html` <span class="badge">${badges[t.route]}</span>` : ''}</a>`)}
    </nav>`;
}

export function renderApp(root = document.getElementById('app'), extra = {}) {
  render(html`<${Shell} route=${currentRoute()} ...${extra} />`, root);
}

if (typeof window !== 'undefined' && !globalThis.__BT_TEST__) {
  window.addEventListener('hashchange', () => renderApp());
  renderApp();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { scope: './' });
}
