// Baut die Fremdbibliotheken einmalig als eigenständige ES-Module nach bautagebuch/js/vendor/.
// Kein Build-Schritt für die App selbst: Ergebnis wird eingecheckt.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const out = 'bautagebuch/js/vendor';
const entries = {
  'preact.js': "export * from 'preact'; export * from 'preact/hooks';",
  'htm.js': "import htm from 'htm'; import { h } from 'preact'; export const html = htm.bind(h); export default htm;",
  'supabase.js': "export { createClient } from '@supabase/supabase-js';",
  'exifr.js': "import exifr from 'exifr/dist/lite.esm.mjs'; export default exifr;",
  'fflate.js': "export { zipSync, strToU8 } from 'fflate';",
};
// preact einmal gemeinsam: htm.js importiert ./preact.js statt eigener Kopie
const shared = { name: 'shared-preact', setup(b) {
  b.onResolve({ filter: /^preact$/ }, (a) => a.importer.includes('stdin') && a.resolveDir && entriesFile !== 'preact.js' ? { path: './preact.js', external: true } : undefined);
} };
let entriesFile = '';
for (const [file, contents] of Object.entries(entries)) {
  entriesFile = file;
  await build({
    stdin: { contents, resolveDir: process.cwd(), loader: 'js' },
    bundle: true, format: 'esm', minify: true, outfile: `${out}/${file}`,
    plugins: file === 'preact.js' ? [] : [shared], logLevel: 'error',
  });
}
const pkg = (n) => JSON.parse(readFileSync(`node_modules/${n}/package.json`, 'utf8')).version;
writeFileSync(`${out}/VERSIONS.txt`, ['preact', 'htm', '@supabase/supabase-js', 'exifr', 'fflate'].map((n) => `${n} ${pkg(n)}`).join('\n') + '\n');
console.log('vendor ok');
