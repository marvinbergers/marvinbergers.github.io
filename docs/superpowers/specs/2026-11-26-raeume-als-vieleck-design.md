# Räume als Vieleck, nachträglich bearbeitbar – Design

Stand: 26.11.2026 · Änderung an „Räume und Wände“ (`2026-11-25-raeume-und-waende-design.md`)

## Warum

- Rechtecke reichen für verwinkelte Räume nicht (L-, U-Form, schräge Wände).
- Ein falsch aufgezogener Raum lässt sich bisher nur löschen; seine Fotos landen dann im Eingang.

## Ziele

- Räume werden **Ecke für Ecke** gezeichnet (Vieleck).
- **Jede Wandlinie ist eine eigene Wand** mit eigener Fotosammlung, dazu Boden und Decke.
- Räume lassen sich **nachträglich bearbeiten**: Eckpunkte verschieben, einfügen, löschen, umbenennen – **ohne dass Fotos verloren gehen oder an die falsche Wand rutschen**.

## Nicht-Ziele

- Keine Rundungen/Bögen; schräge Wände ja.
- Keine automatische Raumerkennung.

## Lösungswege

| | Weg | Abwägung |
|---|---|---|
| **A** ✅ | Vieleck mit **festen Eckpunkt-Kennungen**; Wand = Linie ab Eckpunkt X | Fotos bleiben beim Bearbeiten an ihrer Wand; etwas mehr Aufwand |
| B | Vieleck, Wände nach Reihenfolge nummeriert | Einfacher, aber nach Einfügen eines Punkts rutschen Fotos an falsche Wände – ausgeschlossen |
| C | Weiter Rechtecke, nur verschiebbar | Löst schräge/verwinkelte Räume nicht |

**Entscheidung: A.**

## Abläufe

### Neuen Raum zeichnen (Einrichtung → Etage → Räume → „+ Neuer Raum“)
- Ecken nacheinander antippen; eine Linie folgt dem Finger.
- **Schließen:** ersten Punkt erneut antippen oder **Fertig** (ab 3 Punkten).
- **Letzten Punkt zurück** jederzeit.
- Danach Name eingeben → **Speichern**.
- **Einrasten:** Punkte in der Nähe einer Ecke eines Nachbarraums rasten dort ein (gemeinsame Wände passen genau). *(meine Entscheidung)*

### Raum bearbeiten (Raum in der Liste oder im Plan antippen → „Bearbeiten“)
- **Eckpunkt ziehen** = verschieben; die Wand bleibt dieselbe, Fotos bleiben dran.
- **„+“ in der Mitte einer Linie** antippen = neuer Eckpunkt; die Linie wird geteilt. Die erste Hälfte behält Kennung und Fotos, die zweite ist eine neue, leere Wand.
- **Eckpunkt antippen → „Punkt löschen“** (mindestens 3 bleiben): Die beiden angrenzenden Linien werden eine; die Fotos der wegfallenden Wand wandern auf die zusammengelegte Wand.
- Umbenennen, Löschen (wie bisher: Fotos in den Eingang, mit Rückfrage).
- Alles wird erst mit **Speichern** übernommen; **Abbrechen** verwirft.

### Grundriss
- Übersicht: unverändert ein schlichter Punkt je Raum. Er sitzt an der Stelle, die am weitesten von allen Wänden entfernt ist (liegt auch bei L-/U-Formen sicher im Raum). *(meine Entscheidung)*
- Raum antippen (Punkt oder irgendwo in der Fläche) → Zoom auf den Raum, Umriss hervorgehoben.
- **Wandknöpfe sitzen auf ihrer Linie** (Mitte, leicht nach innen versetzt), Boden und Decke darunter.

### Wandnamen *(meine Entscheidung)*
- Name nach Blickrichtung der Wand nach außen: Nord-, Ost-, Süd-, Westwand (schräge Wände → nächstliegende Richtung).
- Mehrere Wände in dieselbe Richtung: im Uhrzeigersinn nummeriert, z. B. „Nordwand 1“, „Nordwand 2“.
- Namen werden immer aus Nordpfeil und Form berechnet (nicht gespeichert); Tagebuch, Wandansicht und Archiv zeigen dasselbe.

## Daten

- `raeume.ecken jsonb`: `[{ id, x, y }]` im Uhrzeigersinn, Prozent des Planbilds. `id` ist kurz und fest.
- `stellen`: neue Spalte **`kante text`** (Eckpunkt-`id`, an dem die Wand beginnt); `seite` wird `'wand' | 'boden' | 'decke'`. Eindeutig je `(raum_id, seite, kante)` unter nicht gelöschten Stellen.
- **Umstellung bestehender Räume (Migration 0007):**
  - Raum mit einem Rechteck → vier Eckpunkte; bisherige Wände `oben/rechts/unten/links` werden der passenden Linie zugeordnet – Fotos bleiben an ihrer Wand.
  - Raum aus mehreren Rechtecken → Umriss des umschließenden Rechtecks, als **„bitte prüfen“** markiert; Fotos bleiben an der entsprechenden Seite, danach Punkte anpassen.
  - `flaechen` bleibt zur Sicherheit erhalten, wird aber nicht mehr verwendet.

## Dem Builder überlassen

- Darstellung der Griffe und der Plus-Punkte.
- Einrast-Abstand (Vorschlag ≈ 1,5 % der Planbreite).
