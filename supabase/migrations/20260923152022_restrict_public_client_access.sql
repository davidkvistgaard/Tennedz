-- Approved by product owner on 2026-09-23. Permission changes only; no row changes.
-- No row changes. Existing RLS policies remain. Service-role privileges remain.
BEGIN;
SET LOCAL lock_timeout = '5s';
REVOKE ALL PRIVILEGES ON TABLE public."auth_sessions" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."countries" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."event_division_runs" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."event_divisions" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."event_rider_results" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."event_runs" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."event_stages" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."event_team_results" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."event_teams" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."events" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."first_names" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."game_state" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."last_names" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."login_accounts" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."race_feed" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."race_results" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."race_snapshots" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."races" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."riders" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."stage_orders" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."stage_points" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."stage_profiles" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."stage_results" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."stages" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."tactic_presets" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."team_riders" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."team_stage_points" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."teams" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."tactic_presets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."stages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."races" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."stage_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."race_feed" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."countries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."first_names" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."race_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."last_names" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."login_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."auth_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."stage_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_team_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_divisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_division_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_rider_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."game_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."riders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."event_stages" ENABLE ROW LEVEL SECURITY;
REVOKE EXECUTE ON FUNCTION public."grant_starter_pack"(p_count integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public."_pick_random_text_from_any"(candidate_tables text[], candidate_cols text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public."pick_first_name"() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public."pick_last_name"() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public."pick_nationality"() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public."pick_weighted_country"() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public."pick_weighted_name"(p_table text, p_country text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public."generate_riders"(p_count integer) FROM PUBLIC, anon, authenticated;
DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND (
      NOT c.relrowsecurity
      OR has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR NOT has_table_privilege('service_role',c.oid,'SELECT')
      OR NOT has_table_privilege('service_role',c.oid,'INSERT')
      OR NOT has_table_privilege('service_role',c.oid,'UPDATE')
      OR NOT has_table_privilege('service_role',c.oid,'DELETE')
    )
  ) THEN RAISE EXCEPTION 'Table access verification failed'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND (
      has_function_privilege('anon',p.oid,'EXECUTE')
      OR has_function_privilege('authenticated',p.oid,'EXECUTE')
      OR NOT has_function_privilege('service_role',p.oid,'EXECUTE')
    )
  ) THEN RAISE EXCEPTION 'Function access verification failed'; END IF;
END;
$verify$;
COMMIT;
