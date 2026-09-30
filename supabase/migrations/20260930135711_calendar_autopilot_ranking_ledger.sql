-- Additive product model only. No existing event, entry, result, or ranking is rewritten.
begin;

alter table public.events
  add column if not exists calendar_source text,
  add column if not exists race_tier smallint,
  add column if not exists race_team_size smallint,
  add column if not exists scheduled_at timestamptz,
  add column if not exists source_date date,
  add column if not exists source_url text,
  add column if not exists calendar_pair_id uuid;
alter table public.events
  add constraint events_calendar_source_check check (calendar_source in ('UCI', 'PELOTONIA')),
  add constraint events_race_tier_check check (race_tier between 1 and 6),
  add constraint events_race_team_size_check check (race_team_size between 1 and 20),
  add constraint events_calendar_pair_gender_check check (calendar_pair_id is null or gender in ('M', 'F'));
create unique index events_calendar_pair_gender_unique
  on public.events(calendar_pair_id, gender) where calendar_pair_id is not null;
create index events_scheduled_at_idx on public.events(scheduled_at) where scheduled_at is not null;

create table public.recovery_default_lineups (
  team_id uuid not null references public.teams(id) on delete restrict,
  gender text not null check (gender in ('M', 'F')),
  event_format text not null check (event_format in ('ONE_DAY', 'STAGE_RACE')),
  selected_riders uuid[] not null,
  captain_id uuid not null references public.riders(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (team_id, gender, event_format),
  check (cardinality(selected_riders) between 1 and 20),
  check (captain_id = any(selected_riders))
);
create index recovery_default_lineups_team_idx on public.recovery_default_lineups(team_id);

create table public.recovery_team_lifecycle (
  team_id uuid primary key references public.teams(id) on delete restrict,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'DORMANT')),
  last_manager_seen_at timestamptz,
  status_changed_at timestamptz not null default now(),
  closure_eligible_at timestamptz,
  check (status <> 'DORMANT' or closure_eligible_at is not null)
);

-- One sporting award is one row. Filtered rankings aggregate these rows;
-- corrections are new, signed transactions rather than historical erasure.
create table public.recovery_ranking_awards (
  id uuid primary key default gen_random_uuid(),
  award_key text not null unique,
  rider_id uuid not null references public.riders(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  season_year integer not null check (season_year between 2000 and 3000),
  gender text not null check (gender in ('M', 'F')),
  calendar_source text not null check (calendar_source in ('UCI', 'PELOTONIA')),
  event_format text not null check (event_format in ('ONE_DAY', 'STAGE_RACE')),
  race_tier smallint not null check (race_tier between 1 and 6),
  result_type text not null check (result_type in ('ONE_DAY', 'GC', 'STAGE', 'POINTS_CLASSIFICATION', 'KOM', 'YOUTH')),
  result_place integer not null check (result_place > 0),
  points integer not null check (points <> 0),
  points_policy_version text not null,
  awarded_at timestamptz not null default now(),
  reverses_award_id uuid unique references public.recovery_ranking_awards(id) on delete restrict,
  check ((reverses_award_id is null and points > 0) or
         (reverses_award_id is not null and points < 0))
);
create index recovery_ranking_awards_season_idx on public.recovery_ranking_awards(season_year, gender);
create index recovery_ranking_awards_team_idx on public.recovery_ranking_awards(team_id, season_year);
create index recovery_ranking_awards_rider_idx on public.recovery_ranking_awards(rider_id, season_year);

alter table public.recovery_default_lineups enable row level security;
alter table public.recovery_team_lifecycle enable row level security;
alter table public.recovery_ranking_awards enable row level security;
revoke all on public.recovery_default_lineups, public.recovery_team_lifecycle,
  public.recovery_ranking_awards from public, anon, authenticated;
grant select, insert, update on public.recovery_default_lineups to service_role;
grant select, insert, update on public.recovery_team_lifecycle to service_role;
grant select, insert on public.recovery_ranking_awards to service_role;

create function public.recovery_points_rankings(
  p_entity text, p_gender text default null, p_source text default null,
  p_format text default null, p_season_year integer default null)
returns table(entity_id uuid, points bigint)
language sql stable security invoker set search_path = '' as $$
  select case when p_entity = 'rider' then awards.rider_id else awards.team_id end as entity_id,
    sum(awards.points)::bigint as points
  from public.recovery_ranking_awards awards
  where p_entity in ('rider', 'team')
    and (p_gender is null or awards.gender = p_gender)
    and (p_source is null or awards.calendar_source = p_source)
    and (p_format is null or awards.event_format = p_format)
    and (p_season_year is null or awards.season_year = p_season_year)
  group by 1
  having sum(awards.points) > 0
  order by 2 desc, 1
  limit 100;
$$;
revoke all on function public.recovery_points_rankings(text,text,text,text,integer)
  from public, anon, authenticated;
grant execute on function public.recovery_points_rankings(text,text,text,text,integer)
  to service_role;

create function public.recovery_ranking_seasons()
returns table(season_year integer)
language sql stable security invoker set search_path = '' as $$
  select distinct awards.season_year
  from public.recovery_ranking_awards awards
  order by awards.season_year desc;
$$;
revoke all on function public.recovery_ranking_seasons() from public, anon, authenticated;
grant execute on function public.recovery_ranking_seasons() to service_role;

commit;
