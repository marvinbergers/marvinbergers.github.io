# Bautagebuch-App – Design

Stand: 24.11.2026 · Ergebnis des Brainstormings

## 1. Worum es geht und warum

Eine Familien-App fürs Handy, die den Umbau des gemeinsamen Hauses (Bestand mit zwei Anbauten, KG/EG/DG) als **klassisches Bautagebuch** festhält. Vier Familienmitglieder nutzen sie gleichberechtigt.

Die App soll vier Dinge leisten:

1. **Private Dokumentation** des Baus, Tag für Tag.
2. **Fotos für den Statiker** zu bestimmten Bauzuständen, die der Bauherr dann selbst per Mail verschickt.
3. **Wissen für später:** Auch in 30 Jahren noch sehen können, wo Leitungen, Rohre und Kabel hinter Putz und Estrich liegen.
4. **Erinnerung:** den Bau als Geschichte nachvollziehen, Vorher und Nachher.

Später kommt dazu:

5. **Kosten** (Stufe 2). Das ersetzt die heutige Excel-Kostenliste.

Warum jetzt: Der Bestand muss fotografiert sein, **bevor der Abriss beginnt**. Die Fertigstellung ist in gut zwei Jahren geplant, die App muss also gut zwei Jahre Bauzeit tragen.

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Ein Foto in **5–6 Tipps** an einer Stelle im Grundriss ablegen, inklusive bewusster Wahl von Gewerk und Phase. Ein Schnellfoto in **2–3 Tipps**.
- **Einmal anmelden pro Handy**, danach nie wieder.
- Alle vier sehen alles und dürfen alles eintragen.
- Ein Archiv, das **ohne die App** lesbar bleibt (Fotodateien plus PDF).
- Möglichst **0 € laufende Kosten**.

**Nicht-Ziele**
- Leitungen im Grundriss einzeichnen. Das gehört in die Fachpläne, die Fotos zeigen die Realität.
- Zugang für Außenstehende, z. B. den Statiker.
- Rollen und Rechte.
- Native App im App Store.
- Beweissicherung gegenüber Handwerkern im juristischen Sinn.

**Anti-Ziele** (das hieße, die App ist gescheitert, auch wenn sie technisch funktioniert)
- Die anderen Familienmitglieder schicken Fotos lieber per WhatsApp, weil die App nervt: wiederholte Anmeldung, zu viele Tipps, lange Formulare.
- Ein Foto ist da, aber niemand weiß mehr, welche Wand es zeigt.
- Ein falscher Tipp löscht etwas unwiederbringlich.
- In 10 Jahren ist das Archiv weg, weil ein Anbieter eingestellt wurde.
- Unvollständige Stundenerfassung wird als vollständige Summe ausgewiesen.

## 3. Rahmenbedingungen

- **Geräte:** Der Admin nutzt ein iPhone, die anderen drei Android. Beide Plattformen müssen voll funktionieren; die iOS-Einschränkungen von Web-Apps (Anmeldung, Kamera, kein Teilen-Ziel) betreffen nur ein Gerät, Android ist der Hauptfall.
- **Kein VPN, keine App-Store-Installation.** Installiert wird über „Zum Startbildschirm hinzufügen“.
- **Empfang:** Im Keller und auf der Baustelle ist der Empfang schlecht. Erfassen muss auch offline gehen.
- **Pläne:** Sie liegen als PDF (Genehmigungsplanung) und DXF je Geschoss vor, dazu ein älterer Bestandsplan und ein eigenes 3D-Modell mit Wandgeometrie in Metern. Alles liegt in der privaten Ablage, nicht im Repository.
- **Öffentliches Repository:** Die App wird über `marvinbergers.github.io` (GitHub Pages) ausgeliefert, der Code ist öffentlich. **Keine Pläne, Fotos oder Familiendaten ins Repository.** Alles Inhaltliche liegt hinter der Anmeldung.
- **Fotomenge:** geschätzt 5.000–10.000 Fotos, also 5–15 GB.

## 4. Lösungswege

| | Weg | Kosten | Abwägung |
|---|---|---|---|
| **A** ✅ | PWA auf GitHub Pages · **Supabase** (Datenbank, Login) · **Cloudflare R2** (Fotos) | ≈ 0 € (R2 bis 10 GB frei, danach ≈ 0,015 $/GB/Monat; Zahlungsmittel nötig) | Keine Hardware, keine Wartung, immer erreichbar. Dafür zwei Anbieter und deren Gratis-Bedingungen. Kostenlose Supabase-Projekte pausieren nach 7 Tagen ohne Nutzung. |
| B | Eigener Server zu Hause (Pi/Mini-PC, Flask + Docker, Cloudflare Tunnel) | ≈ 100 € Hardware + 10–15 €/Jahr Domain | Unbegrenzter Speicher, Daten bei uns. Aber man ist selbst der Admin, und ein Ausfall legt die App lahm. |
| C | Supabase komplett im Bezahltarif | ≈ 25 $/Monat | Am einfachsten, aber zu teuer. |

Verworfen wurden außerdem eine native App (Apple-Gebühr 99 €/Jahr) sowie Google Drive oder OneDrive als Fotospeicher (die Anmeldung für vier Personen über ein Privatkonto wäre unsauber).

**Entscheidung: Weg A.** Das Anbieter-Risiko fängt der regelmäßige Export (Abschnitt 6.10) ab. Ein späterer Umzug auf B bleibt möglich.

## 5. Ausbaustufen

1. **Stufe 1:** Tagebuch, Fotos, Grundriss mit Stellen, Eingang, Stunden, Export.
2. **Stufe 2:** Kosten. Bis dahin läuft die Excel-Kostenliste weiter. Danach werden Angebote und Belege importiert, nicht abgetippt.

Stufe 1 legt die **Gewerke-Liste** schon so an wie in der Excel-Datei (Bereich, Gewerk, DIN 276, Eigenleistung ja/nein). Dann dockt Stufe 2 ohne Umbau an.

## 6. Stufe 1 im Detail

### 6.1 Anmeldung
- Pro Person ein Konto mit E-Mail-Adresse. Freigeschaltet sind nur diese vier Adressen, neue Registrierungen sind gesperrt.
- Angemeldet wird **einmal pro Gerät** mit einem **6-stelligen Code per E-Mail** (Supabase E-Mail-OTP). Keinen Magic Link verwenden: Auf iOS öffnet der Link Safari statt der installierten Web-App, die Anmeldung käme also nicht in der App an.
- Die Sitzung bleibt dauerhaft bestehen, weil das Token automatisch erneuert wird. Abgemeldet wird nur, wenn man es selbst will.

### 6.2 Startbildschirm = Grundriss
```
┌──────────────────────────────┐
│ EG ▾                     📷  │  ← Etage wählen · Schnellfoto
│ ┌────────┬──────────┐        │
│ │ Bad    │ Küche    │        │
│ │  📍▶   │      📍↑ │        │
│ ├────────┼──────────┤        │
│ │ Flur   │ Wohnen   │        │
│ │   📍↓  │          │        │
│ └────────┴──────────┘        │
│ Filter: Gewerk ▾  Phase ▾     │
├──────────────────────────────┤
│ Grundriss │ Tagebuch │ Eingang (5) │
└──────────────────────────────┘
```
- Beim Öffnen erscheint die zuletzt benutzte Etage, man kann zoomen und verschieben.
- Mit **Filtern** nach Gewerk und Phase blendet man Stellen ohne passende Fotos aus.
- Optional lässt sich der **Bestandsplan einblenden**, halbtransparent über dem neuen Plan.

### 6.3 Stellen
- Eine **Stelle** ist ein Punkt im Grundriss mit **Blickrichtung**, z. B. „Bad – Ostwand“. Dort sammeln sich beliebig viele Fotos, sortiert nach Datum und Phase.
- **Eine neue Stelle setzen:** auf den Grundriss drücken und in Blickrichtung ziehen. Beim Loslassen ist die Stelle mit Pfeil gesetzt.
- **Namensvorschlag automatisch:** Er setzt sich aus dem nächstgelegenen Raumnamen und der Himmelsrichtung des Pfeils zusammen. Der Name lässt sich ändern.
- **Einmalige Einrichtung pro Etage** (macht der Admin): Plan hochladen, Nordrichtung festlegen und Räume antippen und benennen.
- Stellen kann man verschieben, umbenennen und zusammenlegen.
- Die Ansicht einer Stelle ist eine Zeitleiste nach Phase. Ein Vorher-nachher-Vergleich zweier Fotos ist ein Wunsch für später.

### 6.4 Foto aufnehmen
**Weg 1 – an einer Stelle (Standard):**
1. Stelle antippen (oder neu setzen).
2. 📷 antippen. Es öffnet sich die **eingebaute Kamera des Handys** (`<input type="file" accept="image/*" capture="environment">`).
3. Auslösen, auf iOS noch „Foto verwenden“.
4. **Gewerk antippen** und **Phase antippen**: zwei Reihen großer Knöpfe, nichts ist vorausgewählt.
5. Sobald beides gewählt ist, wird gespeichert, ohne extra Speichern-Knopf. Mit „noch eins“ geht es zum nächsten Foto an derselben Stelle, auch dort werden Gewerk und Phase wieder neu gewählt.

```
┌─ Bad – Ostwand ──────────────┐
│ [Foto-Vorschau]              │
│ Gewerk:                      │
│ [Elektro] [Sanitär] [Heizung]│
│ [Trockenbau] [Statik] [mehr…]│
│ Phase:                       │
│ [Bestand] [Abbruch] [Rohbau] │
│ [Installation] [Verschlossen]│
│ [Fertig]                     │
└──────────────────────────────┘
```

**Weg 2 – Schnellfoto:** 📷 oben rechts antippen und auslösen. Das Foto landet im **Eingang**.

**Weg 3 – aus der Galerie:** Im Eingang auf „Fotos importieren“ tippen und mehrere Fotos auswählen. Das Aufnahmedatum (EXIF) bleibt erhalten. Auf Android geht es zusätzlich über „Teilen → Bautagebuch“ (Web Share Target); das ist für drei der vier Nutzer der bequemste Weg und gehört deshalb fest in Stufe 1. Auf iOS gibt es das nicht.

**Regeln dazu:**
- **Gewerk und Phase werden immer bewusst gewählt**, nie vorausgewählt. Damit stimmen die Filter und das Archiv. Beim Schnellfoto entfällt die Wahl zunächst; sie wird beim Sortieren im Eingang nachgeholt. Ein Foto gilt erst als einsortiert, wenn Stelle, Gewerk und Phase gesetzt sind. Die Gewerke-Knöpfe sind nach Häufigkeit sortiert, damit die üblichen oben stehen.
- Eine kurze Notiz pro Foto ist möglich, aber nicht nötig.
- Bewusst **keine eigene Kamera im Browser** (getUserMedia): In iOS-Web-Apps wird die Kameraerlaubnis sonst immer wieder abgefragt.

### 6.5 Eingang
- Hier liegen alle Fotos, die noch keiner Stelle zugeordnet sind, mit einer Zahl im Menü.
- **Sortieren:** mehrere Fotos markieren, Stelle im Grundriss antippen, dann Gewerk und Phase für die markierten Fotos wählen, fertig.
- Fotos aus dem Eingang erscheinen trotzdem schon im Tagebuch des Aufnahmetags.

### 6.6 Tagebuch
- **Ein Eintrag pro Kalendertag**, den alle gemeinsam füllen. Bei jedem Abschnitt steht, wer ihn verfasst hat.
- Abschnitte, alle optional:
  - **Wetter:** wird automatisch eingetragen (Open-Meteo, kostenlos und ohne Schlüssel, Standort des Hauses). Man kann es überschreiben.
  - **Anwesend:** Firmen und Personen aus einer Liste antippen, dazu optional Stunden (6.7).
  - **Arbeiten:** Freitext.
  - **Lieferungen:** Freitext.
  - **Probleme / Entscheidungen / Absprachen:** Freitext.
  - **Fotos:** werden automatisch nach Aufnahmedatum zugeordnet, gruppiert nach Stelle.
- Ein Tag mit nur einem Satz ist ein gültiger Eintrag. Tage ohne Eintrag werden in der Liste übersprungen und nicht als „fehlt“ markiert.
- Firmen und Personen (Name, Gewerk, Kontakt) legt man einmal an.

### 6.7 Stunden (optional)
- Bei „Anwesend“ reicht ein Haken. Wer mag, wählt eine Dauer (`2 h`, `4 h`, `ganzer Tag` oder frei) und optional ein Gewerk.
- **Keine Erinnerungen, keine Warnungen, keine Pflicht.**
- Auswertung nach Person, Monat und Gewerk, immer mit dem Hinweis „an X von Y Tagen erfasst“.

### 6.8 Gewerke und Phasen
- **Gewerk (was?):** Die Liste entspricht der bestehenden Excel-Kostenliste, mit Bereich, Gewerk, DIN 276 und Eigenleistung. Für den Innenausbau kommen Feingewerke dazu (Trockenbau, Malern, Boden, Fliesen …). Die Liste ist editierbar.
- **Phase (wann?):** Bestand vor Umbau → Abbruch → Rohbau → Installation → Verschlossen → Fertig. Die Liste ist editierbar.
- Beides sind zwei unabhängige Merkmale pro Foto.

### 6.9 Pläne und Dokumente
- Pro Etage **ein Grundriss als Anzeigebild**. Er wird aus der PDF-Genehmigungsplanung erzeugt, alternativ aus der DXF oder dem 3D-Modell, falls das sauberer wird (Entscheidung beim Bau).
- Ein **Bestandsplan** pro Etage kann optional überlagert werden. Er wird über zwei Passpunkte am neuen Plan ausgerichtet.
- **Dokumentenablage** für Fachpläne (Elektro, Sanitär, Statik, DXF) zum Ansehen und Herunterladen.
- **Statiker:** In der Ansicht einer Stelle oder eines Tages Fotos markieren und auf „Teilen“ tippen. Dann öffnet sich das Teilen-Menü des Handys (Web Share API mit Dateien), und man wählt die Mail-App. Optional gibt es eine **Foto-Checkliste** nach den Kontrollpunkten aus der eigenen Bodenplatten-Anleitung (nach dem Aushub, vor dem Betonieren, vor dem Verdecken, nach der Herstellung).

### 6.10 Sicherheit der Daten und Archiv
- **Änderungsverlauf:** Wer hat was wann angelegt oder geändert. Frühere Fassungen von Texten bleiben einsehbar.
- **Papierkorb:** Gelöschtes bleibt 90 Tage wiederherstellbar, danach wird es endgültig gelöscht.
- **Offline:** Fotos und Texte werden auf dem Gerät zwischengespeichert (IndexedDB) und übertragen, sobald wieder Netz da ist. Was noch nicht übertragen ist, zeigt die App sichtbar an.
- **Archiv-Export:** Er erzeugt eine Ordnerstruktur, die ohne die App lesbar ist:
  ```
  Bautagebuch-Archiv/
  ├─ Tagebuch.pdf                 (Tag für Tag, mit Fotos und Grundriss-Ausschnitt)
  ├─ Stellen/EG/Bad – Ostwand/2027-03-17_Elektro_Installation_01.jpg
  ├─ Grundrisse/EG.png  (mit allen Stellen eingezeichnet)
  └─ daten.json                   (vollständiger Datenbestand, maschinenlesbar)
  ```
  Ein Export lässt sich jederzeit in der App auslösen und herunterladen. Außerdem läuft er **wöchentlich automatisch** (siehe 7, „Meine Entscheidungen“).

## 7. Technik (Weg A)

- **Oberfläche:** Eine PWA unter `marvinbergers.github.io/bautagebuch/`, mit Manifest, Service Worker und eigenem Symbol. Das Framework entscheidet der Builder. Ziel ist eine kleine, schnelle App ohne aufwendigen Build.
- **Supabase (kostenlos):** Postgres, Auth mit E-Mail-OTP und Row Level Security (Zugriff nur für die vier freigeschalteten Nutzer).
- **Cloudflare R2:** Fotos und Pläne. Hochladen und Abrufen nur über **kurzlebige signierte URLs**. Die URLs stellt eine Supabase Edge Function oder ein Cloudflare Worker aus, nachdem das Supabase-Token geprüft wurde. Der Bucket ist nicht öffentlich.
- **Fotos:** werden auf dem Handy auf 2560 px Kantenlänge verkleinert, JPEG mit Qualität ≈ 0,85, also ≈ 1 MB. Dazu kommt ein Vorschaubild mit ≈ 400 px.
- **Grobes Datenmodell:** `personen`, `etagen` (Plan, Nordrichtung, Bestandsplan, Passpunkte), `raeume` (Name, Position), `stellen` (Etage, x/y in Planprozent, Richtung, Name), `fotos` (Stelle oder Eingang, Aufnahmezeit, Gewerk, Phase, Notiz, Pfade, Autor), `tage` (Datum, Wetter), `tag_abschnitte` (Typ, Text, Autor), `anwesenheit` (Tag, Person oder Firma, Stunden, Gewerk), `firmen`, `gewerke`, `phasen`, `dokumente`, `aenderungen`, dazu ein Feld `geloescht_am` für den Papierkorb.

**Meine Entscheidungen** (bitte prüfen):
- **Fotos werden auf ≈ 1 MB verkleinert, Originale nicht aufbewahrt.** Das hält den Speicher im kostenlosen Rahmen. Wer unbedingt das Original braucht, hat es noch in der Handy-Galerie.
- **Der wöchentliche Export läuft als geplantes Skript auf dem PC des Admins** und schreibt in dessen Cloud-Ablage. So landet das Archiv automatisch im bestehenden Backup. Nebeneffekt: Der regelmäßige Zugriff verhindert, dass Supabase pausiert.
- **Nach der Bauphase** ist das Archiv die Hauptquelle. Wird die App dann jahrelang kaum benutzt und Supabase pausiert, ist nichts verloren.

## 8. Stufe 2: Kosten (nur Rahmen, wird später eigens ausgearbeitet)

- Die Logik übernimmt die bestehende Excel-Kostenliste: mehrere Töpfe (zwei Parteien plus Erwerb) plus Reserve, Umlage gemeinsamer Kosten nach Wohnfläche, Budget pro Gewerk, Prognose (= Auftrag, sonst Angebot, sonst Budget, mindestens das Abgerechnete), Ampel, Angebote mit Status, Belege mit Fälligkeit, Skonto, „bezahlt von“, Lohnanteil (§ 35a) und „förderfähig“, dazu eine vereinbarte Ausbauverpflichtung für einen der Anbauten.
- Ein Beleg-Foto aus dem Tagebuch oder Eingang kann direkt zu einem Kostenbeleg werden.
- Angebote und Belege werden einmalig aus der Excel-Datei importiert.
- Alle vier sehen und bearbeiten alles, mit Änderungsverlauf.

## 9. Dem Builder überlassen

- Framework und Bibliotheken der Oberfläche, Zoom und Verschieben des Grundrisses.
- Wie die Grundrissbilder erzeugt werden (PDF, DXF oder 3D-Modell).
- Ob die signierten URLs über eine Supabase Edge Function oder einen Cloudflare Worker laufen.
- Wie die Offline-Synchronisierung umgesetzt wird und wie Konflikte gelöst werden. Bei Texten gewinnt die letzte Änderung, ältere Fassungen bleiben im Verlauf.
- Aufbau der Tagebuch-PDF.
- Anleitung für den Admin zum Einrichten von Supabase und Cloudflare.
