-- Personen mit ihrem Login verknüpfen, damit bei Einträgen der Name des Verfassers steht.
alter table personen add column nutzer_id uuid unique;
drop view personen_aktiv;
create view personen_aktiv with (security_invoker = true) as select * from personen where geloescht_am is null;
grant select on personen_aktiv to authenticated;

create function verknuepfe_mich() returns void language sql security definer set search_path = public as $$
  update personen set nutzer_id = auth.uid()
  where ist_familie() and nutzer_id is null and lower(email) = lower(auth.jwt()->>'email')
    and not exists (select 1 from personen where nutzer_id = auth.uid())
$$;
revoke all on function verknuepfe_mich() from public;
grant execute on function verknuepfe_mich() to authenticated;
