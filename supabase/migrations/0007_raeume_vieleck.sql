-- Räume als Vieleck mit festen Eckpunkt-Kennungen; jede Wandlinie ist eine eigene Wand.
alter table raeume add column ecken jsonb;
alter table raeume add column pruefen boolean not null default false;
alter table stellen add column kante text;

-- Bisherige Rechteck-Räume umstellen: Ecken a (oben links), b, c, d im Uhrzeigersinn.
update raeume set
  ecken = jsonb_build_array(
    jsonb_build_object('id', 'a', 'x', b.x1, 'y', b.y1),
    jsonb_build_object('id', 'b', 'x', b.x2, 'y', b.y1),
    jsonb_build_object('id', 'c', 'x', b.x2, 'y', b.y2),
    jsonb_build_object('id', 'd', 'x', b.x1, 'y', b.y2)),
  pruefen = jsonb_array_length(flaechen) > 1
from (
  select r.id,
         min((f->>'x1')::numeric) x1, min((f->>'y1')::numeric) y1,
         max((f->>'x2')::numeric) x2, max((f->>'y2')::numeric) y2
  from raeume r, jsonb_array_elements(r.flaechen) f
  where r.flaechen is not null and jsonb_array_length(r.flaechen) > 0
  group by r.id
) b
where raeume.id = b.id;

-- Wände: oben → Linie ab a, rechts → ab b, unten → ab c, links → ab d.
alter table stellen drop constraint if exists stellen_seite_check;
drop index if exists stellen_raum_seite;
update stellen set kante = case seite when 'oben' then 'a' when 'rechts' then 'b' when 'unten' then 'c' when 'links' then 'd' end,
                   seite = 'wand'
  where seite in ('oben', 'rechts', 'unten', 'links');
alter table stellen add constraint stellen_seite_check check (seite in ('wand', 'boden', 'decke'));
alter table stellen add constraint stellen_kante_check check ((seite = 'wand') = (kante is not null) or seite is null);
create unique index stellen_raum_seite_kante on stellen(raum_id, seite, coalesce(kante, ''))
  where geloescht_am is null and raum_id is not null;

drop view raeume_aktiv;
create view raeume_aktiv with (security_invoker = true) as select * from raeume where geloescht_am is null;
drop view stellen_aktiv;
create view stellen_aktiv with (security_invoker = true) as select * from stellen where geloescht_am is null;
revoke all on raeume_aktiv, stellen_aktiv from anon;
grant select on raeume_aktiv, stellen_aktiv to authenticated;
