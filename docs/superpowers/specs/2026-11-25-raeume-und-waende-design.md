# Räume und Wände statt gezogener Stellen – Design

Stand: 25.11.2026 · Änderung an Stufe 1 (`2026-11-24-bautagebuch-design.md`), Ergebnis des Brainstormings nach dem ersten Test auf dem Handy.

## Warum

Im Praxistest war das Anlegen einer Stelle durch Drücken und Ziehen umständlich und nicht intuitiv. Außerdem soll ein Foto auch ohne Gewerk und Phase gespeichert werden können.

## Ziele

- **Raum antippen → Raum wird groß angezeigt → Wand antippen → Kamera.** Keine Stelle selbst anlegen.
- Pro Wand **eine Sammlung** aller Fotos. Eine genauere Position auf der Wand wird nicht gebraucht.
- Neben den vier Wänden gibt es auch **Boden** und **Decke** (Fußbodenheizung, Leitungen im Estrich und in der Decke).
- **Gewerk und Phase sind freiwillig.** Gespeichert wird über einen eigenen Knopf. Weiterhin wird nichts vorausgewählt.

## Nicht-Ziele

- Keine Position auf der Wand, keine frei gesetzten Stellen mehr.
- Keine automatische Raumerkennung aus der DXF-Datei.

## Lösungswege

| | Weg | Abwägung |
|---|---|---|
| **A** ✅ | Räume einmalig in der Einrichtung als **Rechteck(e)** aufziehen; im Grundriss antippbare Flächen | Etwa 10–15 Minuten Einrichtung pro Etage; zuverlässig; der Raum lässt sich groß anzeigen und die Wände sind klar zugeordnet |
| B | Räume automatisch aus der DXF erkennen | Elegant, aber unsicher (die Pläne bestehen aus Einzellinien) – hohes Risiko viel Arbeit ohne Ergebnis |
| C | Räume bleiben Punkte, Wände nur als Liste | Am wenigsten Arbeit, aber ohne Raumansicht; ein kleiner Punkt ist auf dem Handy schwer zu treffen |

**Entscheidung: Weg A.**

## Abläufe

### Einrichtung: Raum aufziehen
- Einrichtung → Etage → **Räume**: zwei gegenüberliegende Ecken antippen, Raum benennen, **Hinzufügen**.
- Für einen L-förmigen Raum: nach dem ersten Rechteck **„+ weiteres Rechteck“** – beide gehören zum selben Raum.
- Räume lassen sich umbenennen und löschen (Papierkorb).
- Alte Räume, die nur als Punkt angelegt sind, werden als **„neu aufziehen“** markiert.

### Foto an einer Wand
```
Grundriss              Raum groß
┌────┬──────┐        ┌──── Nordwand (3) ────┐
│Bad │Küche │  tipp  │                      │
├────┼──────┤  ───▶  W│        Bad          │O
│Flur│Wohnen│        │                      │
└────┴──────┘        └──── Südwand (0) ─────┘
                       [Boden (1)] [Decke (0)]
```
1. Raum im Grundriss antippen. Die Ansicht zoomt auf den Raum, die übrigen Räume sind abgedunkelt.
2. Wand antippen (große Knöpfe an den vier Seiten, darunter Boden und Decke). Es öffnet sich die Ansicht der Wand mit ihren Fotos (Zeitleiste nach Phase wie bisher) und dem Knopf **📷 Foto**.
3. Auslösen. Das Foto ist sofort gesichert (wie bisher).
4. Auswahl: Gewerk und Phase **freiwillig**, Notiz freiwillig, dann **Speichern**.

Das sind 4 Tipps ohne Gewerk und Phase, 6 mit (Raum, Wand, 📷, Auslösen, [Gewerk, Phase], Speichern). Hinzu kommt auf dem iPhone „Foto verwenden“.

- Unter jeder Wand steht die Zahl der Fotos, im Grundriss trägt jeder Raum eine kleine Gesamtzahl.
- Die Filter nach Gewerk und Phase heben Räume mit passenden Fotos hervor und zählen nur diese.
- Das Schnellfoto 📷 oben bleibt unverändert: Das Foto landet im Eingang.
- Checkliste, Teilen, Verlauf und Löschen funktionieren in der Wand-Ansicht wie bisher in der Stellen-Ansicht.

### Eingang
- Ein Foto gilt als **einsortiert, sobald es einer Wand zugeordnet ist**. Gewerk und Phase sind dafür nicht mehr nötig.
- Einsortieren: Fotos markieren → Raum antippen → Wand antippen → Gewerk/Phase freiwillig → **Speichern**.

## Daten

- `raeume`: neue Spalte **`flaechen jsonb`** – Liste von Rechtecken `[{x1, y1, x2, y2}]` in Prozent des Planbilds. Die bisherigen `x`/`y` werden optional (für alte Punkt-Räume).
- `stellen`: neue Spalten **`raum_id`** und **`seite`** (`oben | rechts | unten | links | boden | decke`, bezogen auf das Planbild). Eindeutig je `(raum_id, seite)` unter den nicht gelöschten Stellen. `x`, `y` und `richtung_grad` werden optional.
  - Gespeichert wird die **Planseite**, nicht die Himmelsrichtung. Angezeigt wird „Nordwand“ usw. aus dem Nordpfeil der Etage – ändert man den Nordpfeil später, stimmen die Namen automatisch.
  - Bei einem schräg stehenden Plan, bei dem zwei Seiten dieselbe Himmelsrichtung ergeben würden, wird die Planseite angezeigt (z. B. „Wand oben“).
  - Die Wand-Stelle wird beim ersten Foto automatisch angelegt.
- **Bisherige Testdaten:** Fotos an alten, gezogenen Stellen kommen zurück in den Eingang (`stelle_id = null`), die alten Stellen in den Papierkorb.

## Für den Bau festgelegt

- Das Ziehen zum Anlegen einer Stelle wird entfernt.
- Der Zoom auf einen Raum passt das umschließende Rechteck seiner Flächen in den sichtbaren Ausschnitt (mit etwas Rand).
- Das Archiv legt Fotos ab unter `Stellen/<Etage>/<Raum> – <Wand>/…`, statt unter dem frei vergebenen Stellennamen.

## Dem Builder überlassen

- Darstellung der Raumflächen und Wand-Knöpfe im Detail.
- Wie das Abdunkeln der übrigen Räume umgesetzt wird.
