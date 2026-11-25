-- Änderungsverlauf: jede Änderung an einer Fachtabelle wird mit Vorher/Nachher protokolliert.
create function protokolliere() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into aenderungen(tabelle, datensatz_id, aktion, vorher, nachher, von)
  values (tg_table_name,
          coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id',
                   (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'schluessel'),
          lower(tg_op),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end,
          auth.uid());
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['personen','gewerke','firmen','phasen','etagen','raeume','stellen','fotos','tage',
                           'tag_abschnitte','anwesenheit','dokumente','einstellungen'] loop
    execute format('create trigger %1$s_verlauf after insert or update or delete on %1$s for each row execute function protokolliere()', t);
  end loop;
end $$;
