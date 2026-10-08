-- Disposable Supabase test project ONLY. Not a production migration or full backup.
-- Columns and constraints observed 2026-09-23. No production rows, functions or triggers.
BEGIN;
SET LOCAL search_path = public, extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SEQUENCE public."first_names_id_seq";
CREATE SEQUENCE public."last_names_id_seq";
CREATE TABLE public."teams" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "budget" integer DEFAULT 1000000 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "coins" integer DEFAULT 100000,
  "gems" integer DEFAULT 0,
  "has_claimed_starter_pack" boolean DEFAULT false,
  "rating" integer DEFAULT 0 NOT NULL
);
CREATE TABLE public."team_stage_points" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_stage_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "classification" text NOT NULL,
  "points" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."team_riders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "team_id" uuid,
  "rider_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."stages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "distance_km" integer NOT NULL,
  "profile" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."race_results" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "race_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "rider_id" uuid NOT NULL,
  "time_sec" numeric NOT NULL,
  "position" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "engine_version" text,
  "seed" text
);
CREATE TABLE public."stage_profiles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "country_code" text DEFAULT 'FR'::text NOT NULL,
  "distance_km" integer NOT NULL,
  "profile_points" jsonb NOT NULL,
  "keypoints" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "tags" text[] DEFAULT '{}'::text[] NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."event_rider_results" (
  "event_id" uuid NOT NULL,
  "rider_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "division_index" integer NOT NULL,
  "total_divisions" integer NOT NULL,
  "position" integer NOT NULL,
  "time_sec" numeric NOT NULL,
  "points" integer DEFAULT 0 NOT NULL,
  "multiplier" numeric DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."event_team_results" (
  "event_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "division_index" integer NOT NULL,
  "total_divisions" integer NOT NULL,
  "captain_id" uuid,
  "position" integer NOT NULL,
  "time_sec" numeric NOT NULL,
  "points" integer DEFAULT 0 NOT NULL,
  "multiplier" numeric DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."event_divisions" (
  "event_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "division_index" integer NOT NULL,
  "total_divisions" integer NOT NULL,
  "team_rating" numeric DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."event_division_runs" (
  "event_id" uuid NOT NULL,
  "division_index" integer NOT NULL,
  "seed" text NOT NULL,
  "engine_version" text NOT NULL,
  "stage_snapshot" jsonb NOT NULL,
  "feed" jsonb NOT NULL,
  "results" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."game_state" (
  "id" integer DEFAULT 1 NOT NULL,
  "game_date" date NOT NULL
);
CREATE TABLE public."countries" (
  "code" text NOT NULL,
  "name" text NOT NULL,
  "weight" integer DEFAULT 1 NOT NULL
);
CREATE TABLE public."first_names" (
  "id" bigint DEFAULT nextval('first_names_id_seq'::regclass) NOT NULL,
  "country_code" text NOT NULL,
  "name" text NOT NULL,
  "weight" integer DEFAULT 1 NOT NULL
);
CREATE TABLE public."race_snapshots" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_stage_id" uuid NOT NULL,
  "km" integer NOT NULL,
  "state" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."last_names" (
  "id" bigint DEFAULT nextval('last_names_id_seq'::regclass) NOT NULL,
  "country_code" text NOT NULL,
  "name" text NOT NULL,
  "weight" integer DEFAULT 1 NOT NULL
);
CREATE TABLE public."event_teams" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid,
  "team_id" uuid,
  "captain_id" uuid,
  "selected_riders" uuid[]
);
CREATE TABLE public."login_accounts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "team_id" uuid NOT NULL,
  "login_name" text NOT NULL,
  "password_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."auth_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "login_account_id" uuid NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."event_runs" (
  "event_id" uuid NOT NULL,
  "created_at" timestamp without time zone DEFAULT now(),
  "seed" text,
  "engine_version" text,
  "stage_snapshot" jsonb,
  "feed" jsonb,
  "results" jsonb
);
CREATE TABLE public."tactic_presets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."races" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "stage_id" uuid NOT NULL,
  "start_at" timestamp with time zone DEFAULT now() NOT NULL,
  "lock_at" timestamp with time zone DEFAULT now() NOT NULL,
  "wind_speed_ms" numeric DEFAULT 8 NOT NULL,
  "rain" boolean DEFAULT false NOT NULL,
  "seed" text DEFAULT encode(gen_random_bytes(16), 'hex'::text) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."stage_orders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_stage_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."race_feed" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_stage_id" uuid NOT NULL,
  "km" integer NOT NULL,
  "type" text NOT NULL,
  "message" text NOT NULL,
  "payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deadline" timestamp with time zone NOT NULL,
  "type" text,
  "gender" text,
  "entry_fee" integer DEFAULT 0,
  "prize_pool" integer DEFAULT 0,
  "rake_percent" numeric DEFAULT 0.03,
  "status" text DEFAULT 'OPEN'::text,
  "engine_version" text DEFAULT '2.1'::text,
  "seed" text,
  "country_code" text,
  "weather_locked" jsonb,
  "weather_locked_at" timestamp with time zone,
  "weather_source" text,
  "stage_profile_id" uuid
);
CREATE TABLE public."riders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "sprint" integer NOT NULL,
  "flat" integer NOT NULL,
  "hills" integer NOT NULL,
  "mountain" integer NOT NULL,
  "cobbles" integer NOT NULL,
  "leadership" integer NOT NULL,
  "endurance" integer NOT NULL,
  "moral" integer NOT NULL,
  "luck" integer NOT NULL,
  "wind" integer NOT NULL,
  "form" integer NOT NULL,
  "timetrial" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "nationality" text,
  "first_name" text,
  "last_name" text,
  "display_name" text,
  "age" integer,
  "strength" integer DEFAULT 25 NOT NULL,
  "gender" text,
  "birth_date" date,
  "fatigue" integer DEFAULT 0,
  "injury_until" date,
  "sprint_cap" integer,
  "flat_cap" integer,
  "hills_cap" integer,
  "mountain_cap" integer,
  "cobbles_cap" integer,
  "timetrial_cap" integer,
  "strength_cap" integer,
  "endurance_cap" integer,
  "wind_cap" integer,
  "last_raced_on" date,
  "rating" integer DEFAULT 0 NOT NULL
);
CREATE TABLE public."event_stages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL,
  "stage_no" integer NOT NULL,
  "stage_template_id" uuid NOT NULL,
  "wind_speed_ms" numeric DEFAULT 8 NOT NULL,
  "rain" boolean DEFAULT false NOT NULL,
  "seed" text DEFAULT encode(gen_random_bytes(16), 'hex'::text) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."stage_results" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_stage_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "rider_id" uuid NOT NULL,
  "time_sec" numeric NOT NULL,
  "position" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."stage_points" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_stage_id" uuid NOT NULL,
  "rider_id" uuid NOT NULL,
  "classification" text NOT NULL,
  "points" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."teams" ADD CONSTRAINT "teams_pkey" PRIMARY KEY (id);
ALTER TABLE public."team_stage_points" ADD CONSTRAINT "team_stage_points_classification_check" CHECK ((classification = ANY (ARRAY['points'::text, 'kom'::text])));
ALTER TABLE public."team_stage_points" ADD CONSTRAINT "team_stage_points_event_stage_id_team_id_classification_key" UNIQUE (event_stage_id, team_id, classification);
ALTER TABLE public."team_stage_points" ADD CONSTRAINT "team_stage_points_pkey" PRIMARY KEY (id);
ALTER TABLE public."team_riders" ADD CONSTRAINT "team_riders_pkey" PRIMARY KEY (id);
ALTER TABLE public."team_riders" ADD CONSTRAINT "team_riders_team_id_rider_id_key" UNIQUE (team_id, rider_id);
ALTER TABLE public."stages" ADD CONSTRAINT "stages_pkey" PRIMARY KEY (id);
ALTER TABLE public."race_results" ADD CONSTRAINT "race_results_pkey" PRIMARY KEY (id);
ALTER TABLE public."race_results" ADD CONSTRAINT "race_results_race_id_rider_id_key" UNIQUE (race_id, rider_id);
ALTER TABLE public."stage_profiles" ADD CONSTRAINT "stage_profiles_pkey" PRIMARY KEY (id);
ALTER TABLE public."event_rider_results" ADD CONSTRAINT "event_rider_results_pkey" PRIMARY KEY (event_id, rider_id);
ALTER TABLE public."event_team_results" ADD CONSTRAINT "event_team_results_pkey" PRIMARY KEY (event_id, team_id);
ALTER TABLE public."event_divisions" ADD CONSTRAINT "event_divisions_pkey" PRIMARY KEY (event_id, team_id);
ALTER TABLE public."event_division_runs" ADD CONSTRAINT "event_division_runs_pkey" PRIMARY KEY (event_id, division_index);
ALTER TABLE public."game_state" ADD CONSTRAINT "game_state_pkey" PRIMARY KEY (id);
ALTER TABLE public."countries" ADD CONSTRAINT "countries_pkey" PRIMARY KEY (code);
ALTER TABLE public."first_names" ADD CONSTRAINT "first_names_pkey" PRIMARY KEY (id);
ALTER TABLE public."race_snapshots" ADD CONSTRAINT "race_snapshots_event_stage_id_km_key" UNIQUE (event_stage_id, km);
ALTER TABLE public."race_snapshots" ADD CONSTRAINT "race_snapshots_pkey" PRIMARY KEY (id);
ALTER TABLE public."last_names" ADD CONSTRAINT "last_names_pkey" PRIMARY KEY (id);
ALTER TABLE public."event_teams" ADD CONSTRAINT "event_teams_event_id_team_id_key" UNIQUE (event_id, team_id);
ALTER TABLE public."event_teams" ADD CONSTRAINT "event_teams_pkey" PRIMARY KEY (id);
ALTER TABLE public."login_accounts" ADD CONSTRAINT "login_accounts_login_name_key" UNIQUE (login_name);
ALTER TABLE public."login_accounts" ADD CONSTRAINT "login_accounts_pkey" PRIMARY KEY (id);
ALTER TABLE public."login_accounts" ADD CONSTRAINT "login_accounts_team_id_key" UNIQUE (team_id);
ALTER TABLE public."auth_sessions" ADD CONSTRAINT "auth_sessions_pkey" PRIMARY KEY (id);
ALTER TABLE public."event_runs" ADD CONSTRAINT "event_runs_pkey" PRIMARY KEY (event_id);
ALTER TABLE public."tactic_presets" ADD CONSTRAINT "tactic_presets_pkey" PRIMARY KEY (id);
ALTER TABLE public."races" ADD CONSTRAINT "races_pkey" PRIMARY KEY (id);
ALTER TABLE public."stage_orders" ADD CONSTRAINT "stage_orders_event_stage_id_team_id_key" UNIQUE (event_stage_id, team_id);
ALTER TABLE public."stage_orders" ADD CONSTRAINT "stage_orders_pkey" PRIMARY KEY (id);
ALTER TABLE public."race_feed" ADD CONSTRAINT "race_feed_pkey" PRIMARY KEY (id);
ALTER TABLE public."events" ADD CONSTRAINT "events_kind_check" CHECK ((kind = ANY (ARRAY['one_day'::text, 'stage_race'::text])));
ALTER TABLE public."events" ADD CONSTRAINT "events_pkey" PRIMARY KEY (id);
ALTER TABLE public."riders" ADD CONSTRAINT "riders_gender_check" CHECK ((gender = ANY (ARRAY['M'::text, 'F'::text])));
ALTER TABLE public."riders" ADD CONSTRAINT "riders_pkey" PRIMARY KEY (id);
ALTER TABLE public."event_stages" ADD CONSTRAINT "event_stages_event_id_stage_no_key" UNIQUE (event_id, stage_no);
ALTER TABLE public."event_stages" ADD CONSTRAINT "event_stages_pkey" PRIMARY KEY (id);
ALTER TABLE public."stage_results" ADD CONSTRAINT "stage_results_event_stage_id_rider_id_key" UNIQUE (event_stage_id, rider_id);
ALTER TABLE public."stage_results" ADD CONSTRAINT "stage_results_pkey" PRIMARY KEY (id);
ALTER TABLE public."stage_points" ADD CONSTRAINT "stage_points_classification_check" CHECK ((classification = ANY (ARRAY['gc'::text, 'points'::text, 'kom'::text, 'youth'::text])));
ALTER TABLE public."stage_points" ADD CONSTRAINT "stage_points_event_stage_id_rider_id_classification_key" UNIQUE (event_stage_id, rider_id, classification);
ALTER TABLE public."stage_points" ADD CONSTRAINT "stage_points_pkey" PRIMARY KEY (id);
ALTER TABLE public."teams" ADD CONSTRAINT "teams_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."team_stage_points" ADD CONSTRAINT "team_stage_points_event_stage_id_fkey" FOREIGN KEY (event_stage_id) REFERENCES event_stages(id) ON DELETE CASCADE;
ALTER TABLE public."team_stage_points" ADD CONSTRAINT "team_stage_points_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public."team_riders" ADD CONSTRAINT "team_riders_rider_id_fkey" FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE;
ALTER TABLE public."team_riders" ADD CONSTRAINT "team_riders_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public."race_results" ADD CONSTRAINT "race_results_race_id_fkey" FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE;
ALTER TABLE public."race_results" ADD CONSTRAINT "race_results_rider_id_fkey" FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE;
ALTER TABLE public."race_results" ADD CONSTRAINT "race_results_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public."event_rider_results" ADD CONSTRAINT "event_rider_results_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public."event_rider_results" ADD CONSTRAINT "event_rider_results_rider_id_fkey" FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE;
ALTER TABLE public."event_rider_results" ADD CONSTRAINT "event_rider_results_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public."event_team_results" ADD CONSTRAINT "event_team_results_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public."event_team_results" ADD CONSTRAINT "event_team_results_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public."event_divisions" ADD CONSTRAINT "event_divisions_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public."event_divisions" ADD CONSTRAINT "event_divisions_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public."event_division_runs" ADD CONSTRAINT "event_division_runs_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public."first_names" ADD CONSTRAINT "first_names_country_code_fkey" FOREIGN KEY (country_code) REFERENCES countries(code) ON DELETE CASCADE;
ALTER TABLE public."race_snapshots" ADD CONSTRAINT "race_snapshots_event_stage_id_fkey" FOREIGN KEY (event_stage_id) REFERENCES event_stages(id) ON DELETE CASCADE;
ALTER TABLE public."last_names" ADD CONSTRAINT "last_names_country_code_fkey" FOREIGN KEY (country_code) REFERENCES countries(code) ON DELETE CASCADE;
ALTER TABLE public."event_teams" ADD CONSTRAINT "event_teams_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public."event_teams" ADD CONSTRAINT "event_teams_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public."login_accounts" ADD CONSTRAINT "login_accounts_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public."auth_sessions" ADD CONSTRAINT "auth_sessions_login_account_id_fkey" FOREIGN KEY (login_account_id) REFERENCES login_accounts(id) ON DELETE CASCADE;
ALTER TABLE public."event_runs" ADD CONSTRAINT "event_runs_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public."races" ADD CONSTRAINT "races_stage_id_fkey" FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE RESTRICT;
ALTER TABLE public."stage_orders" ADD CONSTRAINT "stage_orders_event_stage_id_fkey" FOREIGN KEY (event_stage_id) REFERENCES event_stages(id) ON DELETE CASCADE;
ALTER TABLE public."stage_orders" ADD CONSTRAINT "stage_orders_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public."race_feed" ADD CONSTRAINT "race_feed_event_stage_id_fkey" FOREIGN KEY (event_stage_id) REFERENCES event_stages(id) ON DELETE CASCADE;
ALTER TABLE public."events" ADD CONSTRAINT "events_stage_profile_id_fkey" FOREIGN KEY (stage_profile_id) REFERENCES stage_profiles(id);
ALTER TABLE public."event_stages" ADD CONSTRAINT "event_stages_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE public."event_stages" ADD CONSTRAINT "event_stages_stage_template_id_fkey" FOREIGN KEY (stage_template_id) REFERENCES stages(id) ON DELETE RESTRICT;
ALTER TABLE public."stage_results" ADD CONSTRAINT "stage_results_event_stage_id_fkey" FOREIGN KEY (event_stage_id) REFERENCES event_stages(id) ON DELETE CASCADE;
ALTER TABLE public."stage_results" ADD CONSTRAINT "stage_results_rider_id_fkey" FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE;
ALTER TABLE public."stage_results" ADD CONSTRAINT "stage_results_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public."stage_points" ADD CONSTRAINT "stage_points_event_stage_id_fkey" FOREIGN KEY (event_stage_id) REFERENCES event_stages(id) ON DELETE CASCADE;
ALTER TABLE public."stage_points" ADD CONSTRAINT "stage_points_rider_id_fkey" FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE;
ALTER TABLE public."teams" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."teams" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."teams" TO service_role;
ALTER TABLE public."team_stage_points" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."team_stage_points" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."team_stage_points" TO service_role;
ALTER TABLE public."team_riders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."team_riders" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."team_riders" TO service_role;
ALTER TABLE public."stages" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."stages" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."stages" TO service_role;
ALTER TABLE public."race_results" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."race_results" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."race_results" TO service_role;
ALTER TABLE public."stage_profiles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."stage_profiles" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."stage_profiles" TO service_role;
ALTER TABLE public."event_rider_results" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."event_rider_results" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."event_rider_results" TO service_role;
ALTER TABLE public."event_team_results" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."event_team_results" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."event_team_results" TO service_role;
ALTER TABLE public."event_divisions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."event_divisions" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."event_divisions" TO service_role;
ALTER TABLE public."event_division_runs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."event_division_runs" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."event_division_runs" TO service_role;
ALTER TABLE public."game_state" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."game_state" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."game_state" TO service_role;
ALTER TABLE public."countries" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."countries" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."countries" TO service_role;
ALTER TABLE public."first_names" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."first_names" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."first_names" TO service_role;
ALTER TABLE public."race_snapshots" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."race_snapshots" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."race_snapshots" TO service_role;
ALTER TABLE public."last_names" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."last_names" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."last_names" TO service_role;
ALTER TABLE public."event_teams" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."event_teams" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."event_teams" TO service_role;
ALTER TABLE public."login_accounts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."login_accounts" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."login_accounts" TO service_role;
ALTER TABLE public."auth_sessions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."auth_sessions" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."auth_sessions" TO service_role;
ALTER TABLE public."event_runs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."event_runs" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."event_runs" TO service_role;
ALTER TABLE public."tactic_presets" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."tactic_presets" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."tactic_presets" TO service_role;
ALTER TABLE public."races" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."races" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."races" TO service_role;
ALTER TABLE public."stage_orders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."stage_orders" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."stage_orders" TO service_role;
ALTER TABLE public."race_feed" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."race_feed" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."race_feed" TO service_role;
ALTER TABLE public."events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."events" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."events" TO service_role;
ALTER TABLE public."riders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."riders" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."riders" TO service_role;
ALTER TABLE public."event_stages" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."event_stages" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."event_stages" TO service_role;
ALTER TABLE public."stage_results" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."stage_results" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."stage_results" TO service_role;
ALTER TABLE public."stage_points" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."stage_points" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."stage_points" TO service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
COMMIT;

