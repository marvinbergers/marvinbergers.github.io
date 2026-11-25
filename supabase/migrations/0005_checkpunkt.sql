-- Foto-Checkliste: ein Foto kann einen Kontrollpunkt belegen, z. B. „Bodenplatte: vor dem Betonieren“.
alter table fotos add column checkpunkt text;
drop view fotos_aktiv;
create view fotos_aktiv with (security_invoker = true) as select * from fotos where geloescht_am is null;
grant select on fotos_aktiv to authenticated;
