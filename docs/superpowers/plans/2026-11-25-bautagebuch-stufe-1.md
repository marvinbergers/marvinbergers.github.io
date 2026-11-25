# Bautagebuch Stufe 1 – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installierbare Web-App (PWA) als Familien-Bautagebuch mit Grundriss, Stellen, Fotos, Eingang, Tagebuch, optionalen Stunden und Archiv-Export.

**Architecture:** Statische PWA ohne Build-Schritt unter `/bautagebuch/` auf GitHub Pages (ES-Module, Preact + htm, Bibliotheken vendored für Offline). Daten und Login liegen bei Supabase (Postgres mit RLS, E-Mail-OTP). Fotos und Pläne liegen in einem privaten Cloudflare-R2-Bucket, den man nur über kurzlebige signierte URLs erreicht. Die URLs stellt eine Supabase Edge Function aus. Die Fachlogik steckt in reinen Modulen unter `bautagebuch/js/lib/`, die in Node getestet werden.

**Tech Stack:** HTML/CSS/JS (ES2022-Module), Preact 10 + htm 3 (vendored), @supabase/supabase-js 2 (vendored ESM), exifr (vendored), Supabase (Postgres 15, Auth, Edge Functions/Deno), Cloudflare R2 (S3-API, aws4fetch), Open-Meteo. Tests: Vitest + jsdom, @electric-sql/pglite (Postgres in Node, ohne Docker), fake-indexeddb, Playwright (vorinstalliertes Chromium). Export: Node 22 + pdf-lib.

**Spec:** `docs/superpowers/specs/2026-11-24-bautagebuch-design.md`

## Global Constraints

- App-Pfad: `https://marvinbergers.github.io/bautagebuch/`. Manifest `scope` und `start_url` = `/bautagebuch/`.
- **Keine Pläne, Fotos, E-Mail-Adressen oder Familiendaten ins Repository.** Das Repository ist öffentlich. Konfiguration im Repo nur: Supabase-URL und Anon-Key (öffentlich gedacht, geschützt durch RLS).
- Alle Texte der Oberfläche auf Deutsch. Datum und Tageszuordnung in der Zeitzone `Europe/Berlin`.
- Anmeldung nur per **6-stelligem E-Mail-Code** (`signInWithOtp` mit `shouldCreateUser: false`, dann `verifyOtp` mit `type: 'email'`). **Kein Magic Link.** Die Sitzung bleibt dauerhaft (`persistSession: true`, `autoRefreshToken: true`).
- Kamera nur über `<input type="file" accept="image/*" capture="environment">`. **Kein `getUserMedia`.**
- Fotos werden auf dem Gerät auf **max. 2560 px Kantenlänge, JPEG-Qualität 0,85** verkleinert, dazu ein Vorschaubild mit **400 px**. Originale werden nicht hochgeladen.
- Foto an einer Stelle: **5–6 Tipps**. Schnellfoto: **2–3 Tipps**.
- **Gewerk und Phase werden nie vorausgewählt.** Ein Foto gilt erst als einsortiert, wenn Stelle, Gewerk und Phase gesetzt sind.
- Phasen (Startliste, in dieser Reihenfolge): `Bestand vor Umbau`, `Abbruch`, `Rohbau`, `Installation`, `Verschlossen`, `Fertig`.
- Gewerke haben die Felder `bereich`, `name`, `din276`, `eigenleistung` (wie in der Excel-Kostenliste). Startliste kommt nicht ins Repo, sondern wird in der Einrichtung angelegt.
- Stunden sind optional: **keine Erinnerung, keine Warnung, keine Pflicht.** Die Auswertung zeigt immer „an X von Y Tagen erfasst“.
- Papierkorb: Gelöschtes bleibt **90 Tage** wiederherstellbar.
- Alle vier freigeschalteten Nutzer haben **dieselben Rechte**.
- Wetter: Open-Meteo, ohne API-Schlüssel. Die Koordinaten des Hauses stehen in der Tabelle `einstellungen` und nicht im Repo.
- Geräte: 1× iPhone, 3× Android. Android-Teilen-Ziel (Web Share Target) gehört zu Stufe 1.

## Review Focus

1. **Offline-Foto im Keller, App wird vor dem Upload geschlossen.** Das Foto muss beim nächsten Start weiter hochgeladen werden und darf nicht verloren gehen. → Test in Task 6.
2. **Dasselbe Foto kommt zweimal an**, z. B. per Teilen und später per Galerie-Import. Es darf nur einmal gespeichert werden (SHA-256 des verkleinerten Bildes). → Test in Task 4 und Task 10.
3. **Foto ohne EXIF-Datum** (WhatsApp entfernt EXIF): Dann gilt `file.lastModified` und das Foto wird als „Datum geschätzt“ markiert. Ein Absturz oder das Datum 1970 darf nicht passieren. → Test in Task 4.
4. **Foto kurz vor Mitternacht.** Die Tageszuordnung erfolgt nach `Europe/Berlin` und nicht nach UTC. Ein Foto um 00:30 Uhr deutscher Zeit gehört also zum neuen Tag. → Test in Task 11.
5. **Sitzung nach Monaten abgelaufen.** Dann erscheint die Code-Anmeldung, und die Warteschlange mit Fotos bleibt erhalten und wird nach der Anmeldung abgearbeitet. → Test in Task 7.

---

## Dateistruktur

```
package.json, vitest.config.js, .gitignore           Tests und Werkzeuge (Repo-Wurzel)
bautagebuch/
  index.html, manifest.webmanifest, sw.js, icons/    PWA-Hülle
  css/app.css
  js/config.js                                       SUPABASE_URL, SUPABASE_ANON_KEY
  js/main.js                                         Start, Router (#/grundriss, #/tagebuch, #/eingang, #/einrichtung …)
  js/vendor/                                         preact, htm, supabase-js, exifr (feste Versionen)
  js/lib/                                            reine Fachlogik (in Node getestet)
    geometry.js  photo.js  keys.js  queue.js  days.js  hours.js  weather.js  frequency.js
  js/data/                                           Zugriffsschicht
    supabase.js  storage.js  sync.js
  js/ui/                                             Preact-Komponenten
    Login.js  FloorPlan.js  StellePanel.js  CategoryPicker.js  Inbox.js
    Diary.js  DayEntry.js  Attendance.js  Setup.js  Trash.js  History.js  Share.js
supabase/
  migrations/0001_schema.sql  0002_rls.sql  0003_verlauf.sql
  functions/r2-sign/index.ts
tools/export/export.mjs, tools/export/pdf.mjs, tools/export/README.md
tests/                                               spiegelt js/lib, js/ui, supabase, tools
docs/einrichtung.md                                  Anleitung Supabase, Cloudflare, Domain-Freigaben
```

---

### Task 1: Gerüst, Testumgebung und PWA-Hülle

**Files:**
- Create: `package.json`, `vitest.config.js`, `.gitignore`, `bautagebuch/index.html`, `bautagebuch/manifest.webmanifest`, `bautagebuch/sw.js`, `bautagebuch/css/app.css`, `bautagebuch/js/main.js`, `bautagebuch/js/config.js`, `bautagebuch/js/vendor/*`, `bautagebuch/icons/icon-192.png`, `bautagebuch/icons/icon-512.png`
- Test: `tests/pwa/manifest.test.js`, `tests/e2e/shell.spec.js`

**Interfaces:**
- Produces: `npm test` (Vitest), `npm run e2e` (Playwright gegen `npx http-server . -p 8080`); Router `navigate(route: string): void` in `main.js`; Service Worker cacht die App-Hülle (Cache-Name `bautagebuch-v1`).

- [ ] **Step 1: Test schreiben.** `manifest.test.js` liest das Manifest und prüft: `start_url === '/bautagebuch/'`, `scope === '/bautagebuch/'`, `display === 'standalone'`, `lang === 'de'`, Icons 192 und 512 vorhanden, `share_target.action === '/bautagebuch/teilen'`, `share_target.method === 'POST'`, `share_target.enctype === 'multipart/form-data'`, `share_target.params.files[0].accept` enthält `image/*`.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL (Datei fehlt).
- [ ] **Step 3: Implementieren.** Manifest, `index.html` mit Unteransicht `#app`, `main.js` mit Hash-Router und drei Reitern (Grundriss | Tagebuch | Eingang), `sw.js` mit Precache der Hülle. Vendor-Dateien mit festen Versionen von jsdelivr herunterladen (preact 10.24.3, htm 3.1.1, @supabase/supabase-js 2.45.4 als ESM, exifr 7.1.3 lite), Versionen in `bautagebuch/js/vendor/VERSIONS.txt` notieren.
- [ ] **Step 4:** `e2e/shell.spec.js`: Seite laden, drei Reiter sichtbar, Service Worker registriert. `npm test && npm run e2e -- --trace off` ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: PWA-Gerüst und Testumgebung`

### Task 2: Datenbankschema, Zugriffsregeln, Änderungsverlauf, Papierkorb

**Files:**
- Create: `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_verlauf.sql`
- Test: `tests/db/helpers.js` (PGlite starten, `auth`-Schema-Stub mit `auth.uid()` und `auth.jwt()` aus `request.jwt.claims`, Rollen `authenticated` und `anon`, Migrationen einspielen), `tests/db/schema.test.js`

**Interfaces:**
- Produces, Tabellen (alle mit `id uuid pk default gen_random_uuid()`, `erstellt_am timestamptz`, `erstellt_von uuid`, `geaendert_am`, `geaendert_von`, `geloescht_am timestamptz null`):
  `erlaubte_nutzer(email text pk)`, `personen(name, email null, ist_nutzer bool)`, `firmen(name, gewerk_id null, kontakt)`, `gewerke(bereich, name, din276, eigenleistung bool, sortierung int)`, `phasen(name, sortierung int)`, `etagen(name, sortierung, plan_key, plan_breite, plan_hoehe, nord_grad numeric, bestand_key null, bestand_passpunkte jsonb null)`, `raeume(etage_id, name, x numeric, y numeric)`, `stellen(etage_id, name, x numeric, y numeric, richtung_grad numeric)`, `fotos(stelle_id null, gewerk_id null, phase_id null, aufgenommen_am timestamptz, datum_geschaetzt bool, tag date, notiz, key_bild, key_vorschau, sha256 text unique, breite int, hoehe int)`, `tage(datum date unique, wetter jsonb, wetter_manuell bool)`, `tag_abschnitte(tag_id, typ text check in ('arbeiten','lieferungen','probleme'), text)`, `anwesenheit(tag_id, person_id null, firma_id null, stunden numeric null, gewerk_id null)`, `dokumente(titel, key, mime, groesse)`, `einstellungen(schluessel text pk, wert jsonb)`, `aenderungen(tabelle, datensatz_id, aktion, vorher jsonb, nachher jsonb, von uuid, am timestamptz)`.
  Function `ist_familie() returns boolean`. Views `*_aktiv` (ohne gelöschte). Seed in `0001`: die sechs Phasen aus den Global Constraints.

- [ ] **Step 1: Tests schreiben** in `schema.test.js`:
  - `fremder Nutzer sieht nichts`: Claims mit `email='fremd@example.org'`, `select count(*) from fotos` → 0, Insert in `tage` wirft RLS-Fehler.
  - `Familienmitglied darf alles`: E-Mail steht in `erlaubte_nutzer`, Insert, Update und Soft-Delete in `stellen` funktionieren.
  - `anon sieht nichts`: Rolle `anon`, jede Tabelle hat 0 Zeilen.
  - `Verlauf protokolliert Änderungen`: Update von `tag_abschnitte.text` erzeugt eine Zeile in `aenderungen` mit `vorher.text` (alt), `nachher.text` (neu) und `von` = uid.
  - `Papierkorb`: Setzen von `geloescht_am` blendet die Zeile in `stellen_aktiv` aus, die Zeile bleibt in `stellen`.
  - `Phasen-Seed`: `select name from phasen order by sortierung` entspricht genau der Liste aus den Global Constraints.
  - `erstellt_von automatisch`: Trigger setzt `erstellt_von`/`geaendert_von` aus `auth.uid()`.
- [ ] **Step 2:** `npx vitest run tests/db` ausführen. Erwartet: FAIL.
- [ ] **Step 3: Implementieren.** RLS: jede Tabelle `enable row level security`, Policy `for all to authenticated using (ist_familie()) with check (ist_familie())`. `ist_familie()` ist `security definer` und prüft `lower(auth.jwt()->>'email')` in `erlaubte_nutzer`. Verlauf über einen generischen Trigger `protokolliere()` auf allen Fachtabellen.
- [ ] **Step 4:** `npx vitest run tests/db` ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Datenbankschema mit RLS, Verlauf und Papierkorb`

### Task 3: Grundriss-Geometrie und Namensvorschlag

**Files:**
- Create: `bautagebuch/js/lib/geometry.js`
- Test: `tests/lib/geometry.test.js`

**Interfaces:**
- Produces:
  - `dragToDirection(start: {x,y}, end: {x,y}): number|null`: Winkel in Grad im Planbild, 0 = nach oben, im Uhrzeigersinn, 0–359. `null`, wenn der Zug kürzer als 2 % ist.
  - `toCompass(planDeg: number, nordGrad: number): 'Nord'|'Ost'|'Süd'|'West'`: richtet den Winkel an der Nordrichtung der Etage aus.
  - `nearestRoom(point: {x,y}, raeume: {name,x,y}[]): string|null`
  - `suggestName(point, richtungGrad, nordGrad, raeume): string`, z. B. `"Bad – Ostwand"`, ohne Räume `"Stelle – Ostwand"`.
  - `fitTransform(passpunktePlan: [{x,y},{x,y}], passpunkteBestand: [{x,y},{x,y}]): {scale, rotation, tx, ty}`: Ähnlichkeitstransformation für die Überlagerung des Bestandsplans.
  - Koordinaten überall in **Prozent des Planbilds** (0–100).

- [ ] **Step 1: Tests schreiben:** `dragToDirection({x:50,y:50},{x:60,y:50}) === 90`, `({x:50,y:50},{x:50,y:40}) === 0`; `toCompass(90, 0) === 'Ost'`, `toCompass(90, 90) === 'Nord'`, `toCompass(44, 0) === 'Nord'`, `toCompass(46, 0) === 'Ost'`; `suggestName({x:10,y:10}, 90, 0, [{name:'Bad',x:12,y:12},{name:'Küche',x:80,y:80}]) === 'Bad – Ostwand'`; `suggestName(p, 180, 0, []) === 'Stelle – Südwand'`; `fitTransform` bildet beide Bestand-Passpunkte auf die Plan-Passpunkte ab (Toleranz 1e-6). `dragToDirection({x:50,y:50},{x:51,y:50}) === null` (Zug kürzer als 2 %).
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** Tests ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Geometrie und Namensvorschlag für Stellen`

### Task 4: Foto-Verarbeitung auf dem Gerät

**Files:**
- Create: `bautagebuch/js/lib/photo.js`, `bautagebuch/js/lib/keys.js`
- Test: `tests/lib/photo.test.js`, `tests/lib/keys.test.js`, `tests/fixtures/` (kleine Test-JPEGs mit und ohne EXIF, selbst erzeugt, **keine echten Baustellenfotos**)

**Interfaces:**
- Produces:
  - `targetSize(w: number, h: number, max = 2560): {w, h}`
  - `async processImage(file: File|Blob): {bild: Blob, vorschau: Blob, breite, hoehe, sha256: string, aufgenommenAm: Date, datumGeschaetzt: boolean}`: Bild per `createImageBitmap` und `OffscreenCanvas` (Fallback `<canvas>`), JPEG 0,85, Vorschau 400 px, EXIF-Ausrichtung beachten. `sha256` wird über `bild` berechnet.
  - `readCaptureDate(file): Promise<{date: Date, geschaetzt: boolean}>`: EXIF `DateTimeOriginal` über exifr, sonst `file.lastModified` mit `geschaetzt: true`, sonst jetzt mit `geschaetzt: true`.
  - `fotoKeys(fotoId: string, datum: Date): {bild: string, vorschau: string}` → `fotos/2027/03/<id>.jpg`, `fotos/2027/03/<id>_v.jpg`.
  - `isValidKey(key: string): boolean`: nur `^(fotos|plaene|dokumente)/[\w\-/.]+$`, ohne `..`.

- [ ] **Step 1: Tests schreiben:** `targetSize(4032,3024)` → `{w:2560,h:1920}`; `targetSize(1000,800)` bleibt unverändert; `readCaptureDate` mit EXIF-Fixture liefert dessen Datum und `geschaetzt:false`; ohne EXIF mit `lastModified=Date.UTC(2027,2,17,9)` → dieses Datum und `geschaetzt:true`; mit `lastModified=0` (unbekannt) → kein Datum vor 2000, `geschaetzt:true`; `fotoKeys('abc', new Date('2027-03-17T10:00:00Z')).bild === 'fotos/2027/03/abc.jpg'`; `isValidKey('fotos/../x')===false`, `isValidKey('plaene/eg.png')===true`; gleiche Eingabe liefert gleiche `sha256`; eine nicht dekodierbare Datei wirft `FotoFehler` mit Meldung „Foto konnte nicht gelesen werden“.
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren. In Node die Canvas-Teile über eine injizierbare Funktion `decode` mocken.
- [ ] **Step 4:** Tests ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Foto-Verkleinerung, Datum und Speicherschlüssel`

### Task 5: Signierte R2-URLs (Edge Function)

**Files:**
- Create: `supabase/functions/r2-sign/index.ts`, `supabase/functions/r2-sign/logic.ts`
- Test: `tests/functions/r2-sign.test.js` (testet `logic.ts` über `vite-node`/esbuild-Transform)

**Interfaces:**
- Consumes: `isValidKey` (Regel aus Task 4, in `logic.ts` gespiegelt, gleiche Regex).
- Produces: `POST /functions/v1/r2-sign` mit Body `{ops: [{method: 'PUT'|'GET'|'DELETE', key: string, contentType?: string}]}` und Header `Authorization: Bearer <access_token>`. Antwort `{urls: string[]}`, Gültigkeit 300 s. Fehler: 401 ohne gültiges Token, 403 wenn nicht Familie, 400 bei ungültigem Key oder mehr als 50 Ops. Secrets: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
  `validateRequest(body): {ok: true, ops} | {ok: false, status: 400, fehler: string}`

- [ ] **Step 1: Tests schreiben** für `validateRequest`: gültiger PUT → ok; Key mit `..` → 400; 51 Ops → 400; Methode `POST` → 400; PUT ohne `contentType` → 400.
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren. `index.ts` prüft das Token mit `supabase.auth.getUser(token)`, die Familienzugehörigkeit per RPC `ist_familie()` mit dem Nutzer-Token und signiert mit `aws4fetch` (`AwsClient.sign` mit `signQuery: true`).
- [ ] **Step 4:** Tests ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Edge Function für signierte R2-URLs`

### Task 6: Offline-Warteschlange und Synchronisierung

**Files:**
- Create: `bautagebuch/js/lib/queue.js`, `bautagebuch/js/data/sync.js`, `bautagebuch/js/data/storage.js`
- Test: `tests/lib/queue.test.js`, `tests/data/sync.test.js`

**Interfaces:**
- Consumes: `processImage` und `fotoKeys` (Task 4), `POST r2-sign` (Task 5).
- Produces:
  - `openQueue(): Promise<Queue>` (IndexedDB `bautagebuch`, Store `warteschlange`)
  - `Queue.add(item: {typ: 'foto', fotoId, bild: Blob, vorschau: Blob, datensatz: object}): Promise<void>`
  - `Queue.pending(): Promise<item[]>`, `Queue.remove(fotoId)`, `Queue.count(): Promise<number>`
  - `syncOnce(deps: {queue, sign, upload, insertFoto}): Promise<{erledigt: number, fehler: number}>`: erst Upload von Bild und Vorschau, dann DB-Insert, dann Entfernen aus der Queue. Bei Fehler bleibt der Eintrag in der Queue. Ein DB-Konflikt auf `sha256` (Duplikat) entfernt den Eintrag ohne Fehler.
  - `startSync()`: läuft beim App-Start, bei `online` und alle 60 s, solange etwas wartet.
  - `<SyncBadge />`: zeigt „⇅ 3 warten auf Upload“, solange `Queue.count() > 0`, sonst nichts.
  - `storage.signedUrl(key): Promise<string>` mit Zwischenspeicher bis 240 s.

- [ ] **Step 1: Tests schreiben** (fake-indexeddb):
  - `Eintrag überlebt Neustart`: add, Queue schließen, neu öffnen, `count() === 1`.
  - `Fehler beim Upload behält Eintrag`: `upload` wirft, Ergebnis `{erledigt:0, fehler:1}`, `count() === 1`.
  - `Erfolg leert Queue in richtiger Reihenfolge`: Aufrufreihenfolge upload(bild), upload(vorschau), insertFoto, danach `count() === 0`.
  - `Duplikat wird still entfernt`: `insertFoto` wirft `{code:'23505'}` → `erledigt:1`, `count() === 0`.
  - `SyncBadge`: bei `count() === 3` steht „3 warten auf Upload“ im Dokument, bei 0 nicht.
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** Tests ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Offline-Warteschlange mit Synchronisierung`

### Task 7: Anmeldung mit E-Mail-Code

**Files:**
- Create: `bautagebuch/js/data/supabase.js`, `bautagebuch/js/ui/Login.js`
- Modify: `bautagebuch/js/main.js` (Login vor allen Routen)
- Test: `tests/ui/login.test.js`

**Interfaces:**
- Produces: `supabase` (Client mit `persistSession: true`, `autoRefreshToken: true`, `storageKey: 'bautagebuch-auth'`), `async requestCode(email)`, `async verifyCode(email, code)`, `onAuthChange(cb)`.

- [ ] **Step 1: Tests schreiben** (Supabase-Client gemockt):
  - `requestCode` ruft `signInWithOtp({email, options:{shouldCreateUser:false}})` auf und **nie** mit `emailRedirectTo`.
  - Die Login-Maske zeigt nach dem Absenden ein Eingabefeld mit `inputmode="numeric"`, `autocomplete="one-time-code"` und `maxlength="6"`.
  - Ein falscher Code zeigt „Code stimmt nicht oder ist abgelaufen“.
  - Unbekannte E-Mail: Text „Diese Adresse ist nicht freigeschaltet“.
  - `abgelaufene Sitzung behält Warteschlange`: Ein `SIGNED_OUT`-Ereignis zeigt die Login-Maske, `Queue.count()` bleibt unverändert, und nach `SIGNED_IN` wird `startSync` aufgerufen.
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** Tests ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Anmeldung per E-Mail-Code`

### Task 8: Grundriss-Startbildschirm und Stellen setzen

**Files:**
- Create: `bautagebuch/js/ui/FloorPlan.js`, `bautagebuch/js/ui/StellePanel.js`
- Test: `tests/ui/floorplan.test.js`, `tests/e2e/floorplan.spec.js`

**Interfaces:**
- Consumes: `dragToDirection`, `suggestName`, `fitTransform` (Task 3), `storage.signedUrl` (Task 6).
- Produces: `<FloorPlan etage stellen raeume filter onSelectStelle onCreateStelle />`. `onCreateStelle({x, y, richtung_grad, name})` wird erst nach Bestätigung des Namensvorschlags aufgerufen. `StellePanel` zeigt Name, Zahl der Fotos, eine Zeitleiste nach Phase und den Knopf „📷 Foto“.

- [ ] **Step 1: Tests schreiben:**
  - Zuletzt benutzte Etage wird aus `localStorage['bautagebuch-etage']` geöffnet (fehlt der Wert, die erste Etage).
  - Druck-und-Zieh (pointerdown → pointermove → pointerup) erzeugt `onCreateStelle` mit Prozentkoordinaten und dem Namensvorschlag.
  - Ein kurzer Tipp auf eine leere Fläche setzt **keine** Stelle; ein Tipp auf eine Stelle ruft `onSelectStelle`.
  - Filter Gewerk = Elektro blendet Stellen ohne Elektro-Fotos aus.
  - Der Bestandsplan-Schalter erscheint nur, wenn `etage.bestand_key` gesetzt ist.
  - Der 📷-Knopf für das Schnellfoto ist immer sichtbar.
  - Im `StellePanel`: Umbenennen speichert `name`; „Verschieben“ und dann neu ziehen speichert `x`, `y` und `richtung_grad`; „Zusammenlegen mit…“ hängt alle Fotos der Stelle an die Zielstelle und löscht die Quelle per `geloescht_am`.
  - e2e: Zoomen mit zwei Fingern (Touch-Emulation) verändert den Maßstab, Stellen bleiben am selben Planpunkt.
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren. Zoomen und Verschieben über CSS-Transform. Pointer-Events: Ziehen mit einem Finger auf einer leeren Fläche heißt „neue Stelle“, wenn die Bewegung ≥ 2 % beträgt, sonst nichts. Verschieben mit zwei Fingern.
- [ ] **Step 4:** Tests ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Grundriss mit Stellen, Filter und Bestandsplan`

### Task 9: Aufnahme mit Gewerk- und Phasenwahl, Schnellfoto

**Files:**
- Create: `bautagebuch/js/ui/CategoryPicker.js`, `bautagebuch/js/lib/frequency.js`
- Modify: `bautagebuch/js/ui/StellePanel.js`, `bautagebuch/js/ui/FloorPlan.js`
- Test: `tests/ui/capture.test.js`, `tests/lib/frequency.test.js`

**Interfaces:**
- Consumes: `processImage` (Task 4), `Queue.add` (Task 6).
- Produces: `<CategoryPicker gewerke phasen onComplete({gewerk_id, phase_id}) />` mit optionalem Notizfeld (zugeklappt, Notiz wird mit `onComplete` als `notiz` übergeben, kein zusätzlicher Pflicht-Tipp); `sortByFrequency(gewerke, nutzungen: {gewerk_id, anzahl}[]): gewerke[]`; `capturePhoto({stelleId|null}): Promise<void>` öffnet das versteckte `<input capture>`.

- [ ] **Step 1: Tests schreiben:**
  - `nichts vorausgewählt`: Beim ersten Anzeigen hat kein Knopf `aria-pressed="true"`, auch dann nicht, wenn vorher schon ein Foto gespeichert wurde.
  - `speichert erst bei beidem`: Ein Tipp auf das Gewerk allein ruft `onComplete` nicht auf; mit dem Tipp auf die Phase wird es genau einmal mit beiden IDs aufgerufen.
  - `Reihenfolge nach Häufigkeit`: `sortByFrequency` stellt das häufigste Gewerk nach vorn, bei Gleichstand gilt `sortierung`.
  - `Weg 1`: Stelle → „📷 Foto“ → Datei wählen → Picker → beides gewählt → `Queue.add` mit `stelle_id`, `gewerk_id`, `phase_id`. Danach erscheint „noch eins“, und der Picker ist für das nächste Foto wieder leer.
  - `Schnellfoto`: 📷 oben → Datei wählen → `Queue.add` mit `stelle_id: null`, `gewerk_id: null`, `phase_id: null` **ohne** Picker.
  - `Abbruch der Kamera`: ein `change`-Ereignis ohne Datei legt nichts an.
  - `Tipp-Zählung`: Weg 1 mit bestehender Stelle braucht laut Test-Skript genau 5 Interaktionen in der App (Stelle, 📷, Datei, Gewerk, Phase). Hinzu kommt auf iOS „Foto verwenden“ als Systemdialog.
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren. Große Knöpfe, mindestens 48 px hoch, in zwei Gruppen mit Überschrift „Gewerk“ und „Phase“. Weitere Gewerke liegen hinter „mehr…“, sichtbar sind die ersten 5.
- [ ] **Step 4:** Tests ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Fotoaufnahme mit bewusster Gewerk- und Phasenwahl`

### Task 10: Eingang, Galerie-Import und Android-Teilen

**Files:**
- Create: `bautagebuch/js/ui/Inbox.js`
- Modify: `bautagebuch/sw.js` (POST `/bautagebuch/teilen` abfangen, Dateien in IndexedDB-Store `geteilt` legen, Weiterleitung auf `/bautagebuch/#/eingang`), `bautagebuch/js/main.js`
- Test: `tests/ui/inbox.test.js`, `tests/pwa/share-target.test.js`

**Interfaces:**
- Consumes: `processImage`, `Queue.add`, `CategoryPicker`, `FloorPlan` im Auswahlmodus `mode="auswahl"`.
- Produces: `<Inbox />`; `importFiles(files: File[]): Promise<{neu: number, doppelt: number, fehler: number}>`; `assignFotos(fotoIds, {stelle_id, gewerk_id, phase_id})`.

- [ ] **Step 1: Tests schreiben:**
  - Der Eingang zeigt alle Fotos mit `stelle_id`, `gewerk_id` oder `phase_id` = null, im Menü mit Zahl.
  - Mehrfachauswahl → „Einsortieren“ → Stelle wählen → Picker → `assignFotos` mit allen IDs. Danach verschwinden die Fotos aus dem Eingang.
  - `importFiles` mit derselben Datei zweimal → `{neu:1, doppelt:1}`.
  - `importFiles` mit einer unlesbaren Datei → `fehler:1` und Meldung, die übrigen werden importiert.
  - Share-Target: Der SW-Handler legt eine geteilte Datei in `geteilt` ab und antwortet mit 303 auf `/bautagebuch/#/eingang`. Beim Start übernimmt `Inbox` die Dateien per `importFiles` und leert `geteilt`.
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** Tests ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Eingang, Galerie-Import und Android-Teilen`

### Task 11: Tagebuch, Anwesenheit, Stunden und Wetter

**Files:**
- Create: `bautagebuch/js/lib/days.js`, `bautagebuch/js/lib/hours.js`, `bautagebuch/js/lib/weather.js`, `bautagebuch/js/ui/Diary.js`, `bautagebuch/js/ui/DayEntry.js`, `bautagebuch/js/ui/Attendance.js`
- Test: `tests/lib/days.test.js`, `tests/lib/hours.test.js`, `tests/lib/weather.test.js`, `tests/ui/diary.test.js`

**Interfaces:**
- Produces:
  - `berlinDate(d: Date): string` (`YYYY-MM-DD` in Europe/Berlin)
  - `groupFotosByDay(fotos): Map<string, {stelle_id: string|null, fotos: Foto[]}[]>`
  - `summarizeHours(anwesenheit, tage): {proPerson: {name, stunden}[], proMonat: {monat, stunden}[], proGewerk: {gewerk, stunden}[], erfassteTage: number, tageGesamt: number}`
  - `hoursLabel(erfasst, gesamt): string` → `"an 34 von 52 Tagen erfasst"`
  - `weatherUrl(lat, lon, datum): string` (Open-Meteo: `forecast` für heute und Vortage bis 90 Tage, sonst `archive-api`), `mapWeather(json): {text, tmin, tmax, niederschlag_mm}` mit WMO-Code → deutscher Text
  - `<DayEntry datum />` mit den Abschnitten Wetter, Anwesend, Arbeiten, Lieferungen, Probleme/Entscheidungen und Fotos

- [ ] **Step 1: Tests schreiben:**
  - `berlinDate(new Date('2027-03-16T23:30:00Z')) === '2027-03-17'` (Sommerzeit-Grenze prüfen: `'2027-03-27T23:30:00Z'` → `'2027-03-28'`).
  - `groupFotosByDay` gruppiert nach Tag und Stelle, Fotos aus dem Eingang stehen unter `stelle_id: null`.
  - `summarizeHours`: Anwesenheit ohne `stunden` zählt nicht in die Summen und nicht zu `erfassteTage`; ein Tag mit mindestens einem Stundenwert zählt als erfasst.
  - `hoursLabel(34, 52) === 'an 34 von 52 Tagen erfasst'`.
  - `mapWeather` mit Code 61 → `text: 'Leichter Regen'`.
  - `DayEntry`: Alle Abschnitte sind leer speicherbar, es erscheint keine Warnung bei fehlenden Stunden, und bei jedem Abschnitt steht der Name des Verfassers.
  - `Diary`: Tage ohne Eintrag und ohne Fotos tauchen nicht auf.
  - Wetter wird beim Anlegen eines Tages einmal geholt und als `wetter` gespeichert; eine manuelle Änderung setzt `wetter_manuell = true`, danach wird das Wetter nicht mehr überschrieben.
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren. Die Stundenauswahl `2 h`, `4 h`, `ganzer Tag` (= 8 h) oder frei, Gewerk optional.
- [ ] **Step 4:** Tests ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Tagebuch mit Anwesenheit, optionalen Stunden und Wetter`

### Task 12: Einrichtung (Etagen, Pläne, Räume, Listen, Dokumente)

**Files:**
- Create: `bautagebuch/js/ui/Setup.js`, `tools/plan-render/README.md` (Befehl `pdftoppm -r 150 -png -f <seite> -l <seite> plan.pdf eg`, Ergebnis **nicht** ins Repo)
- Test: `tests/ui/setup.test.js`

**Interfaces:**
- Consumes: `storage` (Upload mit `plaene/<etage_id>.png`), `fitTransform`.
- Produces: Route `#/einrichtung` mit den Abschnitten: Etagen (anlegen, sortieren, Planbild hochladen), Nordrichtung (Pfeil drehen → `nord_grad`), Räume (antippen und benennen), Bestandsplan (hochladen, je zwei Passpunkte setzen), Gewerke (Felder wie in den Global Constraints), Phasen, Personen und Firmen, Dokumente (Upload nach `dokumente/`), Einstellungen (Haus-Koordinaten für das Wetter).

- [ ] **Step 1: Tests schreiben:** Nach dem Plan-Upload werden `plan_key`, `plan_breite` und `plan_hoehe` gespeichert; das Drehen des Nordpfeils speichert `nord_grad`; ein Tipp auf den Plan im Raummodus mit Name „Bad“ erzeugt `raeume`; beim Bestandsplan erst nach vier Passpunkten (2 + 2) `bestand_passpunkte` speichern; ein Gewerk lässt sich nur mit `bereich` und `name` speichern.
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** Tests ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Einrichtung für Etagen, Pläne, Räume und Listen`

### Task 13: Teilen an den Statiker und Foto-Checkliste

**Files:**
- Create: `bautagebuch/js/ui/Share.js`, `supabase/migrations/0004_checkpunkt.sql`
- Modify: `StellePanel.js`, `DayEntry.js` (Mehrfachauswahl → Teilen)
- Test: `tests/ui/share.test.js`

**Interfaces:**
- Produces: `async shareFotos(fotos): Promise<'geteilt'|'abgebrochen'|'nicht_unterstuetzt'>`. Lädt die Bilder über signierte URLs, prüft `navigator.canShare({files})` und ruft `navigator.share({files, title: 'Baufotos'})`. Fallback: ZIP-Download (fflate, vendored). `<Checkliste />` mit Einträgen aus `einstellungen['checklisten']`, die in der Einrichtung gepflegt werden. Die Startvorlage „Bodenplatte“ hat die Punkte: nach dem Aushub, vor dem Betonieren, vor dem Verdecken, nach der Herstellung. Ein Punkt gilt als erledigt, sobald ein Foto mit Verweis auf ihn existiert (Spalte `fotos.checkpunkt text null`, Migration `0004`).
- [ ] **Step 1: Tests schreiben:** `share` wird mit genau den ausgewählten Dateien aufgerufen; `AbortError` → `'abgebrochen'`; ohne `canShare` → ZIP-Download wird angestoßen; ein Checklisten-Punkt mit Foto ist abgehakt.
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** Tests ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Teilen an den Statiker und Foto-Checkliste`

### Task 14: Verlauf und Papierkorb

**Files:**
- Create: `bautagebuch/js/ui/History.js`, `bautagebuch/js/ui/Trash.js`
- Test: `tests/ui/trash.test.js`

**Interfaces:**
- Consumes: `aenderungen`, `*_aktiv`-Views (Task 2).
- Produces: „Löschen“ setzt überall nur `geloescht_am`. `#/papierkorb` listet Gelöschtes der letzten 90 Tage mit „Wiederherstellen“. Bei jedem Eintrag erscheint „Verlauf“ mit früheren Fassungen und Autor.
- [ ] **Step 1: Tests schreiben:** Löschen eines Fotos ruft ein Update mit `geloescht_am` auf und **kein** delete; Wiederherstellen setzt `geloescht_am = null`; ein Eintrag älter als 90 Tage erscheint nicht; der Verlauf zeigt Fassungen neueste zuerst mit Namen.
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** Tests ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Verlauf und Papierkorb`

### Task 15: Archiv-Export und endgültiges Löschen

**Files:**
- Create: `tools/export/export.mjs`, `tools/export/pdf.mjs`, `tools/export/paths.mjs`, `tools/export/README.md`
- Test: `tests/export/paths.test.js`, `tests/export/export.test.js`

**Interfaces:**
- Consumes: Supabase mit `SUPABASE_SERVICE_ROLE_KEY`, R2-Schlüssel. Alles kommt aus einer lokalen `.env` auf dem PC (in `.gitignore`, **nie** ins Repo).
- Produces: `node tools/export/export.mjs --ziel "<Ordner>"` erzeugt die Struktur aus Spec 6.10 inkrementell, lädt also nur neue Fotos. `fotoDateiname(foto, gewerk, phase, laufnr): string` → `2027-03-17_Elektro_Installation_01.jpg`; `stellenOrdner(etage, stelle): string` → `Stellen/EG/Bad – Ostwand` (Zeichen `\/:*?"<>|` werden durch `-` ersetzt). Erzeugt außerdem `Tagebuch.pdf` (pdf-lib, Tag für Tag mit Vorschaubildern), `Grundrisse/<Etage>.png` mit eingezeichneten Stellen und `daten.json`. Danach löscht das Skript Datensätze und R2-Objekte, deren `geloescht_am` älter als 90 Tage ist. Das README beschreibt die Einrichtung in der Windows-Aufgabenplanung (wöchentlich, Sonntag 20:00).
  In der App gibt es zusätzlich unter `#/einrichtung` den Knopf „Archiv herunterladen“: Er erzeugt im Browser ein ZIP (fflate) mit `daten.json` und den Fotos eines gewählten Monats. Das ganze Archiv als ZIP wäre im Browser zu groß, das bleibt dem Skript vorbehalten.
- [ ] **Step 1: Tests schreiben:** Der In-App-Export für März 2027 enthält genau die Fotos mit `tag` im März und `daten.json`; Dateinamen für Windows gültig, Umlaute bleiben erhalten; ein zweiter Lauf lädt keine bereits vorhandenen Dateien neu (Upload-Mock zählt 0); ein Foto im Eingang landet unter `Eingang/`; `daten.json` enthält alle Tabellen außer `erlaubte_nutzer`; das endgültige Löschen betrifft nur Einträge mit `geloescht_am` älter als 90 Tage.
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** Tests ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** `feat: Archiv-Export mit Tagebuch-PDF`

### Task 16: Einrichtungsanleitung und Abnahme auf echten Geräten

**Files:**
- Create: `docs/einrichtung.md`
- Test: `tests/e2e/smoke.spec.js` (gegen eine Supabase-Testinstanz, nur wenn `E2E_SUPABASE_URL` gesetzt ist)

- [ ] **Step 1: Anleitung schreiben** in Schritten: Supabase-Projekt anlegen (Region Frankfurt), „Allow new users to sign up“ ausschalten, E-Mail-Vorlage auf `{{ .Token }}` umstellen (Code statt Link), Migrationen einspielen, vier Adressen in `erlaubte_nutzer` und als Nutzer einladen, Edge Function deployen und R2-Secrets setzen. Cloudflare: R2 aktivieren, Bucket privat anlegen, CORS für `https://marvinbergers.github.io` (PUT, GET), API-Token nur für diesen Bucket. Danach `config.js` befüllen, GitHub Pages aktiv lassen, Export-Skript nach `tools/export/README.md` einrichten.
- [ ] **Step 2:** `smoke.spec.js`: Anmeldung mit Testkonto, Stelle setzen, Foto (Fixture) mit Gewerk und Phase ablegen, das Foto erscheint im Tagebuch des Tages. Ausführen mit `npm run e2e -- --trace off`. Erwartet: PASS.
- [ ] **Step 3: Abnahme auf echten Geräten** (manuell, durch Marvin): auf dem iPhone und einem Android-Handy installieren; einmal anmelden und nach einem Neustart des Handys noch angemeldet sein; Foto an einer Stelle mit 5–6 Tipps; Schnellfoto; Flugmodus-Foto wird nach dem Wiedereinschalten hochgeladen; Android: Teilen aus der Galerie landet im Eingang.
- [ ] **Step 4: Commit** `docs: Einrichtungsanleitung und Abnahme`
