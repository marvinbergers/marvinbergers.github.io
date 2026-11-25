# Räume und Wände – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fotos werden über „Raum antippen → Wand antippen“ abgelegt statt über gezogene Stellen; Gewerk und Phase sind freiwillig.

**Architecture:** Räume bekommen Rechteck-Flächen (`raeume.flaechen`). Eine Wand ist eine automatisch angelegte `stellen`-Zeile mit `raum_id` + `seite`. Die Logik für Treffer, Zoom und Wandnamen liegt rein in `js/lib/rooms.js`; UI in `FloorPlan.js` (Raumflächen, Raumansicht mit Wandknöpfen).

**Tech Stack:** wie Stufe 1 (Preact/htm, Vitest, PGlite, Playwright).

**Spec:** `docs/superpowers/specs/2026-11-25-raeume-und-waende-design.md` (baut auf `2026-11-24-bautagebuch-design.md` auf)

## Global Constraints

- Seiten: `oben | rechts | unten | links | boden | decke` (Planseite, nicht Himmelsrichtung). Anzeige: `Nordwand`, `Ostwand`, `Südwand`, `Westwand`, `Boden`, `Decke`; ergeben zwei Wandseiten dieselbe Himmelsrichtung → `Wand oben/rechts/unten/links`.
- Eine Wand-Stelle je `(raum_id, seite)` unter nicht gelöschten Stellen; angelegt beim ersten Foto.
- Gewerk/Phase: nie vorausgewählt, freiwillig, gespeichert wird mit **Speichern**.
- Ein Foto ist einsortiert, sobald `stelle_id` gesetzt ist.
- Kein Ziehen zum Anlegen von Stellen mehr.
- Koordinaten weiterhin in Prozent des Planbilds.

## Review Focus

1. Tipp zwischen zwei Räumen oder auf eine Fläche ohne Raum → nichts passiert, kein Fehler. → Task 2.
2. Raum mit zwei Rechtecken (L-Form): Tipp in beide Teile öffnet denselben Raum, Zoom umfasst beide. → Task 2.
3. Zweimal schnell dieselbe Wand fotografieren (offline) → nur eine Wand-Stelle. → Task 3.
4. Nordpfeil schräg (45°) → keine doppelten Wandnamen. → Task 2.
5. Alte Testdaten (gezogene Stellen) verschwinden nicht still: Fotos im Eingang, Stellen im Papierkorb. → Task 1.

---

### Task 1: Datenbank – Raumflächen und Wand-Stellen

**Files:** Create `supabase/migrations/0006_raeume_waende.sql`; Test `tests/db/schema.test.js`

- Produces: `raeume.flaechen jsonb`, `raeume.x/y` nullable; `stellen.raum_id uuid references raeume`, `stellen.seite text check (seite in (...))`, `x/y/richtung_grad` nullable; eindeutiger Index `(raum_id, seite) where geloescht_am is null and raum_id is not null`; Daten: Fotos an Stellen ohne `raum_id` → `stelle_id = null`, diese Stellen → `geloescht_am = now()`. `*_aktiv`-Sichten neu anlegen.
- [ ] Tests: Raum mit `flaechen` ohne x/y anlegen; zweite aktive Stelle für dieselbe `(raum_id, seite)` → 23505; nach Löschen der ersten wieder möglich; Migration auf Altbestand (Stelle ohne raum_id + Foto) → Foto `stelle_id` null, Stelle in Papierkorb.
- [ ] RED → Migration → GREEN → Commit `feat: Räume mit Flächen, Wand-Stellen`

### Task 2: Raum-Logik

**Files:** Create `bautagebuch/js/lib/rooms.js`; Test `tests/lib/rooms.test.js`

- Produces: `roomAt(p, raeume): raum|null` (Punkt in einer der Flächen; kleinster Raum gewinnt bei Überlappung), `roomBox(raum): {x1,y1,x2,y2}`, `fitView(box, frame:{w,h}, aspect, rand=0.08): {s,x,y}`, `SEITEN`, `wandNamen(nordGrad): Record<seite,string>`, `normRect(a,b)`.
- [ ] Tests: Treffer/kein Treffer; L-Raum (zwei Rechtecke) → derselbe Raum, Box umfasst beide; `wandNamen(0)` → oben=Nordwand, rechts=Ostwand …; `wandNamen(90)` → rechts=Nordwand; `wandNamen(45)` → keine Doppelten (Fallback „Wand oben“ …); Boden/Decke immer gleich; `fitView` zentriert und begrenzt Zoom 1…6.
- [ ] RED → Implementierung → GREEN → Commit

### Task 3: Wand-Stelle anlegen/finden

**Files:** Modify `bautagebuch/js/data/actions.js`; Test `tests/ui/floorplan.test.js`

- Produces: `ensureWand(api, raum, seite): Promise<stelle>` – findet aktive Stelle `(raum_id, seite)` oder legt sie an (`etage_id`, `name` = „Raum – Wandname“); bei 23505 erneut suchen. Parallel-sicher innerhalb eines Geräts (Promise-Cache je Schlüssel).
- [ ] Tests: zweimal gleichzeitig → eine Stelle; vorhandene wird wiederverwendet.

### Task 4: Grundriss mit Räumen und Raumansicht

**Files:** Modify `FloorPlan.js`, `GrundrissView.js`, `StellePanel.js`, CSS; Tests `tests/ui/floorplan.test.js`, `tests/e2e/floorplan.spec.js`

- Produces: `<FloorPlan etage planUrl raeume zahlen={raumId: n} aktiverRaum onRoom(raum) onWand(raum, seite) wandZahlen={seite:n} onQuickPhoto />`. Tipp auf Fläche → `onRoom`; aktiver Raum → Zoom per `fitView`, andere Räume abgedunkelt, Wandknöpfe an den vier Seiten + Leiste Boden/Decke mit Zahlen; „‹ Grundriss“ zurück. Kein Ziehen mehr; Zwei-Finger-Zoom bleibt.
- GrundrissView: Wand antippen → Wand-Ansicht (`StellePanel` mit Fotos der Wand-Stelle, Titel „Bad – Nordwand“); 📷 Foto → `ensureWand` erst beim Speichern/Aufnehmen.
- Filter: Zahlen zählen nur passende Fotos; Räume ohne Treffer abgedunkelt.
- [ ] Tests: Tipp in Raumfläche ruft `onRoom`; Tipp daneben nichts; Raumansicht zeigt 6 Wandknöpfe mit Namen aus Nordpfeil und Zahlen; Wand → Wand-Ansicht; e2e: Raum antippen zoomt (Fläche füllt Rahmen).

### Task 5: Aufnahme mit freiwilliger Auswahl

**Files:** Modify `CategoryPicker.js`, `capture.js`, `data/inbox.js`; Tests `tests/ui/capture.test.js`

- Produces: Picker mit **Speichern** (auch ohne Auswahl), Auswahl toggelbar (nochmal tippen = abwählen), keine Vorauswahl. `atWand(raum, seite, ctx)` → `ensureWand` → Foto sofort gesichert → Picker → Speichern. `imEingang(f) = !f.stelle_id`.
- [ ] Tests: Speichern ohne Auswahl speichert mit null; mit Auswahl → Werte; Tipp-Zählung Raum, Wand, 📷, Datei, Speichern = 5 Interaktionen (inkl. Auslösen); Foto mit Wand, ohne Gewerk → nicht im Eingang.

### Task 6: Eingang einsortieren über Raum/Wand

**Files:** Modify `Inbox.js`; Test `tests/ui/inbox.test.js`
- [ ] Tests: markieren → Raum → Wand → Speichern → Fotos mit `stelle_id` der Wand, verschwinden aus dem Eingang.

### Task 7: Einrichtung – Räume aufziehen

**Files:** Modify `Setup.js`; Test `tests/ui/setup.test.js`
- Produces: Raummodus: zwei Tipps = Rechteck (Vorschau nach erstem Tipp), Name, **Hinzufügen**; „+ weiteres Rechteck“ für den zuletzt angelegten Raum; Liste mit „neu aufziehen“ bei Räumen ohne `flaechen`; Löschen.
- [ ] Tests: zwei Tipps + Name → `flaechen` mit normiertem Rechteck; weiteres Rechteck hängt an; Punkt-Raum zeigt „neu aufziehen“.

### Task 8: Archiv und Abschluss

**Files:** Modify `tools/export/export.mjs`, `paths.mjs`; Tests `tests/export/*`, `tests/e2e/smoke.spec.js`, Demo-Daten
- [ ] Archivordner `Stellen/<Etage>/<Raum> – <Wand>` aus Raum + Seite (Nordpfeil); SVG zeichnet Raumflächen mit Zahlen statt Punkte.
- [ ] Demo-Daten mit Raumflächen; Gesamttest: Raum → Wand → 📷 → Speichern → Tagebuch zeigt Foto unter „Bad – Nordwand“.
