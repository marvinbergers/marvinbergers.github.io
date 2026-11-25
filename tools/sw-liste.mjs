// Trägt alle App-Module in die Vorspeicher-Liste des Service Workers ein (nach neuen Dateien ausführen).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const p = 'bautagebuch/sw.js';
const mods = ['ui', 'data', 'lib', 'vendor'].flatMap((d) => readdirSync(`bautagebuch/js/${d}`).filter((f) => f.endsWith('.js')).sort().map((f) => `js/${d}/${f}`));
const s = readFileSync(p, 'utf8');
const a = s.indexOf('const SHELL = ['); const b = s.indexOf('];', a) + 2;
const liste = `const SHELL = [\n  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'js/main.js', 'js/config.js',\n  'icons/icon-192.png', 'icons/icon-512.png',\n${mods.map((m) => `  '${m}',\n`).join('')}];`;
writeFileSync(p, s.slice(0, a) + liste + s.slice(b));
console.log(`${mods.length} Module eingetragen`);
