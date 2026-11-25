# Wöchentlicher Archiv-Export

Das Skript holt alle Daten und Fotos aus Supabase und R2 und legt sie als normale Dateien ab – lesbar ohne die App:

```
Bautagebuch-Archiv/
├─ Tagebuch.pdf                 Tag für Tag mit Wetter, Anwesenheit, Texten und Vorschaubildern
├─ Stellen/EG/Bad – Ostwand/2027-03-17_Elektro_Installation_01.jpg
├─ Eingang/…                    noch nicht einsortierte Fotos
├─ Grundrisse/EG.svg            Grundriss mit allen Stellen (im Browser öffnen)
└─ daten.json                   vollständiger Datenbestand
```

Bereits vorhandene Fotos werden nicht erneut geladen. Außerdem löscht das Skript endgültig, was länger als
**90 Tage im Papierkorb** liegt (Datensätze und Dateien in R2).

## Einmalig einrichten (Windows)

1. [Node.js](https://nodejs.org) (LTS) installieren.
2. Repository auf den PC holen und im Ordner einmal `npm install` ausführen.
3. Datei `tools/export/.env` anlegen (**nie ins Repository**, steht in `.gitignore`):
   ```
   SUPABASE_URL=https://<projekt>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service_role-Schlüssel aus Supabase → Project Settings → API>
   R2_ACCOUNT_ID=<Cloudflare-Konto-ID>
   R2_ACCESS_KEY_ID=<R2-API-Token: Access Key ID>
   R2_SECRET_ACCESS_KEY=<R2-API-Token: Secret Access Key>
   R2_BUCKET=bautagebuch
   ```
   Der Service-Role-Schlüssel umgeht alle Zugriffsregeln – er gehört nur auf diesen PC.
4. Testlauf:
   ```
   node tools/export/export.mjs --ziel "C:\Users\<du>\OneDrive\Dokumente\Haus Umbau\Bautagebuch-Archiv"
   ```

## Wöchentlich automatisch (Aufgabenplanung)

Aufgabenplanung öffnen → **Einfache Aufgabe erstellen**:

- Name: `Bautagebuch-Export`
- Trigger: **Wöchentlich**, Sonntag, 20:00
- Aktion: **Programm starten**
  - Programm: `node`
  - Argumente: `tools\export\export.mjs --ziel "C:\Users\<du>\OneDrive\Dokumente\Haus Umbau\Bautagebuch-Archiv"`
  - Starten in: Pfad zum Repository-Ordner
- In den Eigenschaften: „Aufgabe so schnell wie möglich nach einem verpassten Start ausführen“ anhaken.

Nebeneffekt: Der wöchentliche Zugriff verhindert, dass das kostenlose Supabase-Projekt pausiert.
