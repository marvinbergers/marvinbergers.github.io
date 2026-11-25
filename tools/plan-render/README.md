# Grundriss als Bild für die App

Die App zeigt pro Etage ein Bild des Grundrisses. Aus der PDF-Genehmigungsplanung erzeugst du es so
(Seite und Dateinamen anpassen):

```bash
pdftoppm -r 150 -png -f 1 -l 1 "Plan Bauantrag.pdf" eg
```

Das erzeugt `eg-1.png`. Am besten zuschneiden, sodass nur der Grundriss des Geschosses zu sehen ist
(Ränder, Schriftfeld und Ansichten weg), und dann in der App unter **Einrichtung → Etage → Grundriss** hochladen.

**Wichtig:** Pläne gehören nicht ins Repository – das Repository ist öffentlich. Die Bilder liegen nur
im privaten Speicher (R2) und sind nur nach Anmeldung sichtbar.
