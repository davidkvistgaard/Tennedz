-- Disposable project fixture: pre-repository signatures required by the first
-- access-hardening migration. These inert functions are never used for gameplay.
CREATE FUNCTION public._pick_random_text_from_any(candidate_tables text[], candidate_cols text[]) RETURNS text LANGUAGE sql AS $$ SELECT NULL::text $$;
CREATE FUNCTION public.generate_riders(p_count integer) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
CREATE FUNCTION public.grant_starter_pack(p_count integer) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
CREATE FUNCTION public.pick_first_name() RETURNS text LANGUAGE sql AS $$ SELECT NULL::text $$;
CREATE FUNCTION public.pick_last_name() RETURNS text LANGUAGE sql AS $$ SELECT NULL::text $$;
CREATE FUNCTION public.pick_nationality() RETURNS text LANGUAGE sql AS $$ SELECT NULL::text $$;
CREATE FUNCTION public.pick_weighted_country() RETURNS text LANGUAGE sql AS $$ SELECT NULL::text $$;
CREATE FUNCTION public.pick_weighted_name(p_table text, p_country text) RETURNS text LANGUAGE sql AS $$ SELECT NULL::text $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
