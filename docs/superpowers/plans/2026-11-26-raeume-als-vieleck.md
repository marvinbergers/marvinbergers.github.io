# Räume als Vieleck – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Räume als Vieleck zeichnen und bearbeiten; jede Wandlinie ist eine eigene Wand; Fotos bleiben beim Bearbeiten an ihrer Wand.

**Architecture:** `raeume.ecken = [{id,x,y}]` (im Uhrzeigersinn auf dem Bildschirm). Wand-Stelle = `(raum_id, seite='wand', kante=<Eckpunkt-id>)`; Boden/Decke = `seite` ohne `kante`. Reine Geometrie in `js/lib/polygon.js`; Bearbeiten über `js/ui/RaumEditor.js`.

**Spec:** `docs/superpowers/specs/2026-11-26-raeume-als-vieleck-design.md`

## Global Constraints
- Koordinaten in Prozent des Planbilds; Winkel unter Berücksichtigung des Seitenverhältnisses (`plan_breite/plan_hoehe`).
- Ecken werden beim Speichern im Uhrzeigersinn (Bildschirm, y nach unten) normiert.
- Wandname aus Außennormale → Nord/Ost/Süd/West; mehrere gleiche Richtungen nummeriert in Eckenreihenfolge. Namen nie gespeichert, immer berechnet.
- Einrasten an Ecken anderer Räume derselben Etage innerhalb 1,5 % (Planbreite).
- Mindestens 3 Ecken.

## Review Focus
1. Punkt einfügen → Fotos bleiben an der ersten Hälfte. → Task 2/3
2. Punkt löschen → Fotos der wegfallenden Wand landen auf der zusammengelegten Wand, keine gehen verloren. → Task 3
3. Bestehende Rechteck-Räume: Wandfotos bleiben an der richtigen Linie. → Task 1
4. Konkaver Raum (L/U): Raumpunkt liegt im Raum; Treffer korrekt. → Task 2
5. Gegen den Uhrzeigersinn gezeichneter Raum → gleiche Wandnamen wie im Uhrzeigersinn. → Task 2

### Task 1: Migration 0007 – Ecken, Kanten, Umstellung
- [ ] DB-Tests: Rechteck-Raum → 4 Ecken a,b,c,d; Stellen oben/rechts/unten/links → `wand` + kante a/b/c/d; Mehrfach-Rechteck → Umriss + `pruefen = true`; Eindeutigkeit `(raum_id, seite, kante)`; Boden bleibt `boden`.
- [ ] `supabase/migrations/0007_raeume_vieleck.sql`

### Task 2: Geometrie `js/lib/polygon.js`
- [ ] Tests + `pointInPolygon`, `roomAt`, `polyBox`, `uhrzeigersinn`, `kanten`, `wandNamen(raum, nordGrad, aspect)`, `raumPunkt(raum, aspect)`, `einrasten`, `punktEinfuegen`, `punktLoeschen`.

### Task 3: Aktionen
- [ ] `ensureWand(api, etage, raum, {seite, kante})`; `speichereRaum(api, raum, ecken, entfernt)` mit Fotoumzug beim Punktlöschen; `wandTitel`.

### Task 4: Grundriss und Aufnahme
- [ ] FloorPlan: Treffer/Punkt per Vieleck, Umriss + Abdunkeln per SVG, Wandknöpfe auf ihren Linien; GrundrissView/capture/Inbox mit `{seite, kante}`; Tagebuch zeigt berechnete Namen.

### Task 5: Einrichtung – Raum zeichnen und bearbeiten
- [ ] `RaumEditor`: zeichnen (Tipp je Ecke, Schließen, zurück), bearbeiten (ziehen, „+“, löschen), Einrasten, Speichern/Abbrechen; „bitte prüfen“ markiert.

### Task 6: Archiv, Demo, Gesamttest
- [ ] Ordnernamen und SVG mit Vielecken; Demo-Daten; e2e.
