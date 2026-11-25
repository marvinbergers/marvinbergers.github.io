// Erzeugt die App-Icons aus einem SVG (Bauhelm über Grundriss) mit dem vorinstallierten Chromium.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#2f5d50"/>
<g fill="none" stroke="#f6f4ef" stroke-width="18" stroke-linejoin="round">
<rect x="110" y="250" width="292" height="170"/><path d="M110 330h120v90M300 250v80h102"/></g>
<path d="M150 210a106 106 0 0 1 212 0z" fill="#f2b33d"/><rect x="128" y="205" width="256" height="26" rx="10" fill="#f2b33d"/>
<rect x="244" y="104" width="24" height="70" rx="8" fill="#d9952a"/></svg>`;
const b = await chromium.launch();
const p = await b.newPage();
for (const s of [192, 512]) {
  await p.setViewportSize({ width: s, height: s });
  await p.setContent(`<style>html,body{margin:0}</style>${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}`);
  await p.screenshot({ path: `bautagebuch/icons/icon-${s}.png` });
}
await b.close();
console.log('icons ok');
