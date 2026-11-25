-- Räume als Rechteck-Flächen, Fotos je Wand (Raum + Seite) statt frei gezogener Stellen.
alter table raeume add column flaechen jsonb;
alter table raeume alter column x drop not null, alter column y drop not null;

alter table stellen add column raum_id uuid references raeume(id);
alter table stellen add column seite text check (seite in ('oben', 'rechts', 'unten', 'links', 'boden', 'decke'));
alter table stellen alter column x drop not null, alter column y drop not null, alter column richtung_grad drop not null;
create unique index stellen_raum_seite on stellen(raum_id, seite) where geloescht_am is null and raum_id is not null;

-- Altbestand: Fotos an frei gezogenen Stellen zurück in den Eingang, die Stellen in den Papierkorb.
update fotos set stelle_id = null
  where stelle_id in (select id from stellen where raum_id is null and geloescht_am is null);
update stellen set geloescht_am = now() where raum_id is null and geloescht_am is null;

-- Sichten neu anlegen (neue Spalten)
drop view raeume_aktiv;
create view raeume_aktiv with (security_invoker = true) as select * from raeume where geloescht_am is null;
drop view stellen_aktiv;
create view stellen_aktiv with (security_invoker = true) as select * from stellen where geloescht_am is null;
revoke all on raeume_aktiv, stellen_aktiv from anon;
grant select on raeume_aktiv, stellen_aktiv to authenticated;
