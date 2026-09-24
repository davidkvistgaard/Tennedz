-- Run only on pelotonia-recovery-auth-test. All fixture writes roll back.
begin;
do $$
begin
  if not (select relrowsecurity from pg_class where oid='public.club_identities'::regclass) then raise exception 'RLS missing'; end if;
  if has_table_privilege('anon','public.club_identities','SELECT') or has_table_privilege('authenticated','public.club_identities','UPDATE') or has_table_privilege('authenticated','public.club_identities','SELECT') then raise exception 'Unexpected client grants'; end if;
end $$;
set local role service_role;
do $$
declare fixture_team uuid; stored text;
begin
  select id into fixture_team from public.teams order by id limit 1;
  if fixture_team is null then raise exception 'Test team required'; end if;
  insert into public.club_identities(team_id,palette,pattern) values(fixture_team,'forest','plain') on conflict(team_id) do update set palette=excluded.palette,pattern=excluded.pattern;
  insert into public.club_identities(team_id,palette,pattern) values(fixture_team,'forest','band') on conflict(team_id) do update set palette=excluded.palette,pattern=excluded.pattern;
  select pattern into stored from public.club_identities where team_id=fixture_team;
  if stored is distinct from 'band' then raise exception 'Upsert failed'; end if;
end $$;
rollback;
