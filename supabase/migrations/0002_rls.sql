-- Zugriff: nur die vier freigeschalteten Adressen, alle mit denselben Rechten.
create function ist_familie() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from erlaubte_nutzer where lower(email) = lower(auth.jwt()->>'email'))
$$;
revoke all on function ist_familie() from public;
grant execute on function ist_familie() to authenticated;

do $$ declare t text; begin
  foreach t in array array['erlaubte_nutzer','personen','gewerke','firmen','phasen','etagen','raeume','stellen','fotos',
                           'tage','tag_abschnitte','anwesenheit','dokumente','einstellungen','aenderungen'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('create policy familie on %I for all to authenticated using (ist_familie()) with check (ist_familie())', t);
  end loop;
  foreach t in array array['personen','gewerke','firmen','phasen','etagen','raeume','stellen','fotos','tage',
                           'tag_abschnitte','anwesenheit','dokumente'] loop
    execute format('revoke all on %I from anon', t || '_aktiv');
    execute format('grant select on %I to authenticated', t || '_aktiv');
  end loop;
end $$;
-- Liste der Freigaben darf in der App nur gelesen werden; gepflegt wird sie im Supabase-Dashboard.
revoke insert, update, delete on erlaubte_nutzer from authenticated;
-- Verlauf ist nur lesbar, geschrieben wird er ausschließlich vom Trigger.
revoke insert, update, delete on aenderungen from authenticated;
