-- Read-only permission check for an isolated Supabase project.
do $$
declare relation_name text; function_name text; relation_id oid; function_id oid;
begin
  foreach relation_name in array array[
    'recovery_default_lineups', 'recovery_team_lifecycle',
    'recovery_ranking_awards', 'recovery_autopilot_jobs'] loop
    select c.oid into relation_id from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relname = relation_name;
    if relation_id is null then raise exception 'Missing table: %', relation_name; end if;
    if not (select c.relrowsecurity from pg_class c where c.oid = relation_id)
      or has_table_privilege('anon', relation_id, 'SELECT')
      or has_table_privilege('authenticated', relation_id, 'SELECT')
      or has_table_privilege('anon', relation_id, 'INSERT')
      or has_table_privilege('authenticated', relation_id, 'INSERT')
      or not has_table_privilege('service_role', relation_id, 'SELECT') then
      raise exception 'Unsafe table permissions: %', relation_name;
    end if;
  end loop;
  foreach function_name in array array[
    'recovery_autopilot_join_event', 'recovery_autopilot_claim_job',
    'recovery_autopilot_advance_job', 'recovery_create_scheduled_race_day',
    'recovery_points_rankings', 'recovery_ranking_seasons'] loop
    select p.oid into function_id from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.proname = function_name;
    if function_id is null then raise exception 'Missing function: %', function_name; end if;
    if has_function_privilege('anon', function_id, 'EXECUTE')
      or has_function_privilege('authenticated', function_id, 'EXECUTE')
      or not has_function_privilege('service_role', function_id, 'EXECUTE') then
      raise exception 'Unsafe function permissions: %', function_name;
    end if;
  end loop;
end $$;
select 'PASS: new tables use RLS; client roles cannot read/write them or call service functions' result;
