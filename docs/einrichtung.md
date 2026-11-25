# Bautagebuch einrichten

Diese Anleitung bringt die App von der Vorschau in den echten Betrieb. Rechne mit etwa einer Stunde.
Nichts davon kostet Geld; für Cloudflare R2 muss aber ein Zahlungsmittel hinterlegt werden.

> Solange `bautagebuch/js/config.js` leer ist, läuft die App im **Vorschau-Modus**: alles funktioniert,
> aber nur im Speicher des Browsers. So kannst du sie vorher ausprobieren.

## 1. Supabase (Datenbank und Anmeldung)

1. Auf [supabase.com](https://supabase.com) ein kostenloses Konto und ein **neues Projekt** anlegen.
   Region: **Frankfurt (eu-central-1)**. Das Datenbank-Passwort sicher ablegen.
2. **Datenbank anlegen:** *SQL Editor* öffnen und nacheinander den Inhalt dieser Dateien ausführen:
   `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_verlauf.sql`, `0004_personen_nutzer.sql`, `0005_checkpunkt.sql`.
3. **Freischalten:** im SQL Editor die vier Adressen eintragen:
   ```sql
   insert into erlaubte_nutzer(email) values
     ('adresse1@…'), ('adresse2@…'), ('adresse3@…'), ('adresse4@…');
   ```
4. **Anmeldung einstellen** (*Authentication*):
   - *Sign In / Providers → Email*: aktiv lassen. **„Allow new users to sign up“ ausschalten.**
   - *Users → Add user → Create new user*: die vier Adressen anlegen, „Auto Confirm User“ anhaken
     (ein Passwort ist egal, es wird nie benutzt).
   - *Emails → Templates → Magic Link*: den Text so ändern, dass er den **Code** enthält, z. B.
     ```
     <h2>Dein Code fürs Bautagebuch</h2><p style="font-size:28px"><b>{{ .Token }}</b></p>
     ```
     Ohne `{{ .Token }}` käme ein Link statt eines Codes – der funktioniert auf dem iPhone nicht in der App.
   - *Sessions*: die Standardwerte lassen (Sitzungen laufen nicht ab, das Token erneuert sich selbst).
5. **E-Mail-Versand (wichtig):** Der eingebaute Mailversand von Supabase schickt nur an Mitglieder des
   Supabase-Teams und nur wenige Mails pro Stunde. Für die Familie einen eigenen SMTP-Dienst eintragen
   (*Authentication → Emails → SMTP Settings*), z. B. den Mailversand deines E-Mail-Anbieters oder einen
   kostenlosen Dienst wie Brevo. Danach mit einer Adresse testen.
6. *Project Settings → API Keys*: **Project URL** und den **Publishable key** (`sb_publishable_…`) notieren.
   Den **Secret key** (`sb_secret_…`) nur für den Export auf dem PC verwenden (siehe `tools/export/README.md`).
   Die alten „Legacy API keys“ (anon/service_role) werden Anfang 2027 abgeschaltet – nicht verwenden.

## 2. Cloudflare R2 (Fotos und Pläne)

1. Auf [cloudflare.com](https://dash.cloudflare.com) ein Konto anlegen, **R2** aktivieren (Zahlungsmittel nötig,
   bis 10 GB kostenlos).
2. **Bucket anlegen:** Name `bautagebuch`, Standort automatisch. **Nicht öffentlich** machen.
3. *Bucket → Settings → CORS Policy*:
   ```json
   [{ "AllowedOrigins": ["https://marvinbergers.github.io"],
      "AllowedMethods": ["GET", "PUT"],
      "AllowedHeaders": ["content-type"],
      "MaxAgeSeconds": 3600 }]
   ```
4. *R2 → Manage R2 API Tokens → Create API Token*: Berechtigung **Object Read & Write**, nur für den Bucket
   `bautagebuch`. **Access Key ID**, **Secret Access Key** und die **Account ID** notieren.

## 3. Edge Function (Zugang zu den Fotos)

Mit der [Supabase CLI](https://supabase.com/docs/guides/cli) im Repository-Ordner:

```bash
supabase login
supabase link --project-ref <projekt-ref>
supabase secrets set R2_ENDPOINT=https://<konto-id>[.eu].r2.cloudflarestorage.com R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=bautagebuch \
  APP_ORIGIN=https://marvinbergers.github.io APP_PUBLISHABLE_KEY=sb_publishable_…
supabase functions deploy r2-sign
```

`SUPABASE_URL` stellt Supabase der Funktion automatisch bereit. In den Funktions-Einstellungen
**„Verify JWT with legacy secret“ ausschalten** – die Funktion prüft die Anmeldung selbst.

## 4. App verbinden und veröffentlichen

1. In `bautagebuch/js/config.js` **Project URL** und **Publishable key** eintragen. Beide dürfen öffentlich sein –
   ohne Freischaltung sieht man nichts (Zugriffsregeln in der Datenbank).
2. Den Branch nach `main` übernehmen. GitHub Pages veröffentlicht die App dann unter
   **https://marvinbergers.github.io/bautagebuch/**.
3. Mit dem eigenen Handy öffnen, anmelden, dann unter **⚙︎ Einrichtung**:
   - Etagen anlegen (KG, EG, DG), Grundriss je Etage hochladen (siehe `tools/plan-render/README.md`),
     Nordrichtung einstellen, Räume antippen und benennen.
   - Gewerke anlegen (wie in der Kostenliste), Personen mit ihren E-Mail-Adressen, Firmen.
   - Haus-Koordinaten fürs Wetter eintragen.
4. Wöchentlichen Export auf dem PC einrichten: `tools/export/README.md`.

## 5. Installieren auf den Handys

- **Android (Chrome):** Link öffnen → Menü ⋮ → **App installieren** bzw. „Zum Startbildschirm hinzufügen“.
  Danach erscheint „Bautagebuch“ auch im **Teilen-Menü** der Galerie.
- **iPhone (Safari):** Link öffnen → Teilen-Symbol → **Zum Home-Bildschirm**. Wichtig: in Safari öffnen,
  nicht in einem anderen Browser.

Danach einmal mit der eigenen E-Mail-Adresse anmelden, Code eingeben – fertig. Die Anmeldung bleibt bestehen.

## 6. Abnahme (einmal durchspielen)

- [ ] iPhone und ein Android-Handy: installieren, anmelden, Handy neu starten → App öffnen: noch angemeldet.
- [ ] Foto an einer Stelle: Stelle antippen → 📷 Foto → Auslösen → Gewerk → Phase (5–6 Tipps).
- [ ] Schnellfoto über 📷 oben: landet im Eingang, dort einsortieren.
- [ ] Flugmodus an, Foto machen, App schließen, Flugmodus aus, App öffnen: Foto wird hochgeladen.
- [ ] Android: in der Galerie ein Foto **teilen → Bautagebuch**: landet im Eingang.
- [ ] Tagebuch: Eintrag schreiben, Wetter erscheint, Name des Verfassers steht dabei.
- [ ] Ein Foto per **Teilen…** an die eigene Mail-Adresse schicken.
- [ ] Export auf dem PC laufen lassen und `Tagebuch.pdf` ansehen.
