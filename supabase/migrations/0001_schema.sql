-- Bautagebuch: Grundschema. Alle Fachtabellen haben Autor, Zeitstempel und Papierkorb-Feld.

create table erlaubte_nutzer (email text primary key);

create function setze_standardfelder() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.erstellt_am := coalesce(new.erstellt_am, now());
    new.erstellt_von := coalesce(new.erstellt_von, auth.uid());
  end if;
  new.geaendert_am := now();
  new.geaendert_von := coalesce(auth.uid(), new.geaendert_von);
  return new;
end $$;

-- Hilfsmakro: Standardspalten werden in jeder Tabelle gleich angelegt.
create table personen (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text, ist_nutzer boolean not null default false,
  erstellt_am timestamptz, erstellt_von uuid, geaendert_am timestamptz, geaendert_von uuid, geloescht_am timestamptz);

create table gewerke (
  id uuid primary key default gen_random_uuid(),
  bereich text not null, name text not null, din276 text, eigenleistung boolean not null default false,
  sortierung int not null default 0,
  erstellt_am timestamptz, erstellt_von uuid, geaendert_am timestamptz, geaendert_von uuid, geloescht_am timestamptz);

create table firmen (
  id uuid primary key default gen_random_uuid(),
  name text not null, gewerk_id uuid references gewerke(id), kontakt text,
  erstellt_am timestamptz, erstellt_von uuid, geaendert_am timestamptz, geaendert_von uuid, geloescht_am timestamptz);

create table phasen (
  id uuid primary key default gen_random_uuid(),
  name text not null, sortierung int not null default 0,
  erstellt_am timestamptz, erstellt_von uuid, geaendert_am timestamptz, geaendert_von uuid, geloescht_am timestamptz);

create table etagen (
  id uuid primary key default gen_random_uuid(),
  name text not null, sortierung int not null default 0,
  plan_key text, plan_breite int, plan_hoehe int, nord_grad numeric not null default 0,
  bestand_key text, bestand_passpunkte jsonb,
  erstellt_am timestamptz, erstellt_von uuid, geaendert_am timestamptz, geaendert_von uuid, geloescht_am timestamptz);

create table raeume (
  id uuid primary key default gen_random_uuid(),
  etage_id uuid not null references etagen(id), name text not null, x numeric not null, y numeric not null,
  erstellt_am timestamptz, erstellt_von uuid, geaendert_am timestamptz, geaendert_von uuid, geloescht_am timestamptz);

create table stellen (
  id uuid primary key default gen_random_uuid(),
  etage_id uuid not null references etagen(id), name text not null,
  x numeric not null, y numeric not null, richtung_grad numeric not null,
  erstellt_am timestamptz, erstellt_von uuid, geaendert_am timestamptz, geaendert_von uuid, geloescht_am timestamptz);

create table fotos (
  id uuid primary key default gen_random_uuid(),
  stelle_id uuid references stellen(id), gewerk_id uuid references gewerke(id), phase_id uuid references phasen(id),
  aufgenommen_am timestamptz not null, datum_geschaetzt boolean not null default false, tag date not null,
  notiz text, key_bild text, key_vorschau text, sha256 text not null unique, breite int, hoehe int,
  erstellt_am timestamptz, erstellt_von uuid, geaendert_am timestamptz, geaendert_von uuid, geloescht_am timestamptz);
create index fotos_tag on fotos(tag);
create index fotos_stelle on fotos(stelle_id);

create table tage (
  id uuid primary key default gen_random_uuid(),
  datum date not null unique, wetter jsonb, wetter_manuell boolean not null default false,
  erstellt_am timestamptz, erstellt_von uuid, geaendert_am timestamptz, geaendert_von uuid, geloescht_am timestamptz);

create table tag_abschnitte (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references tage(id), typ text not null check (typ in ('arbeiten','lieferungen','probleme')),
  text text not null default '',
  erstellt_am timestamptz, erstellt_von uuid, geaendert_am timestamptz, geaendert_von uuid, geloescht_am timestamptz);

create table anwesenheit (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references tage(id), person_id uuid references personen(id), firma_id uuid references firmen(id),
  stunden numeric check (stunden is null or (stunden > 0 and stunden <= 24)), gewerk_id uuid references gewerke(id),
  check (person_id is not null or firma_id is not null),
  erstellt_am timestamptz, erstellt_von uuid, geaendert_am timestamptz, geaendert_von uuid, geloescht_am timestamptz);

create table dokumente (
  id uuid primary key default gen_random_uuid(),
  titel text not null, key text not null, mime text, groesse bigint,
  erstellt_am timestamptz, erstellt_von uuid, geaendert_am timestamptz, geaendert_von uuid, geloescht_am timestamptz);

create table einstellungen (schluessel text primary key, wert jsonb,
  erstellt_am timestamptz, erstellt_von uuid, geaendert_am timestamptz, geaendert_von uuid);

create table aenderungen (
  id bigint generated always as identity primary key,
  tabelle text not null, datensatz_id text not null, aktion text not null,
  vorher jsonb, nachher jsonb, von uuid, am timestamptz not null default now());
create index aenderungen_datensatz on aenderungen(datensatz_id);

do $$ declare t text; begin
  foreach t in array array['personen','gewerke','firmen','phasen','etagen','raeume','stellen','fotos','tage',
                           'tag_abschnitte','anwesenheit','dokumente','einstellungen'] loop
    execute format('create trigger %1$s_standard before insert or update on %1$s for each row execute function setze_standardfelder()', t);
  end loop;
  foreach t in array array['personen','gewerke','firmen','phasen','etagen','raeume','stellen','fotos','tage',
                           'tag_abschnitte','anwesenheit','dokumente'] loop
    execute format('create view %1$s_aktiv with (security_invoker = true) as select * from %1$s where geloescht_am is null', t);
  end loop;
end $$;

insert into phasen(name, sortierung) values
  ('Bestand vor Umbau', 1), ('Abbruch', 2), ('Rohbau', 3), ('Installation', 4), ('Verschlossen', 5), ('Fertig', 6);
