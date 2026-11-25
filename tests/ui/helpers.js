import { render, options } from '../../bautagebuch/js/vendor/preact.js';
// Effekte in Tests sofort statt nach dem nächsten Frame ausführen.
options.requestAnimationFrame = (cb) => setTimeout(cb, 0);
// jsdom kennt keine onpointer*-Eigenschaften; ohne sie würde Preact falsche Ereignisnamen binden.
if (typeof HTMLElement !== 'undefined') {
  for (const n of ['onpointerdown', 'onpointermove', 'onpointerup', 'onpointercancel']) {
    if (!(n in HTMLElement.prototype)) Object.defineProperty(HTMLElement.prototype, n, { value: null, writable: true });
  }
}
import { html } from '../../bautagebuch/js/vendor/htm.js';
export { html };

export const flush = async () => { for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0)); };

export function mount(vnode) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  render(vnode, el);
  return el;
}

export async function type(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
}

export async function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await flush();
}

export const byText = (root, sel, text) => [...root.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(text));
