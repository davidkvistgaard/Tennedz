-- Additive storage for the future registration/reveal/tactics flow.
-- Existing races have null phase columns and keep the one-deadline path.
begin;

alter table public.events
  add column registration_deadline timestamptz,
  add column tactics_deadline timestamptz;

alter table public.events add constraint events_two_phase_deadlines_check check (
  (registration_deadline is null and tactics_deadline is null)
  or (
    registration_deadline is not null and tactics_deadline is not null
    and kind = 'one_day' and gender is not null and gender in ('M', 'F')
    and calendar_source is not null and calendar_source in ('UCI', 'PELOTONIA')
    and scheduled_at is not null
    and deadline = registration_deadline
    and registration_deadline < tactics_deadline
    and tactics_deadline < scheduled_at
  )
);

-- One immutable reveal per parent event. The child rows are both the locked
-- points snapshot and the saved division membership; no later ranking query
-- is needed to reproduce the assignment.
create table public.recovery_division_reveals (
  event_id uuid primary key references public.events(id) on delete restrict,
  season_year integer not null check (season_year between 2000 and 3000),
  gender text not null check (gender in ('M', 'F')),
  points_policy_version text not null check (length(btrim(points_policy_version)) > 0),
  revealed_at timestamptz not null default now()
);

create table public.recovery_division_reveal_entries (
  event_id uuid not null references public.recovery_division_reveals(event_id) on delete restrict,
  team_id uuid not null,
  earned_points_at_lock bigint not null check (earned_points_at_lock >= 0),
  division_index smallint not null check (division_index between 1 and 20),
  seed_rank smallint not null check (seed_rank between 1 and 400),
  primary key (event_id, team_id),
  unique (event_id, seed_rank),
  foreign key (event_id, team_id) references public.event_teams(event_id, team_id) on delete restrict
);
create index recovery_division_reveal_entries_team_idx
  on public.recovery_division_reveal_entries(team_id);

alter table public.recovery_division_reveals enable row level security;
alter table public.recovery_division_reveal_entries enable row level security;
revoke all on public.recovery_division_reveals,
  public.recovery_division_reveal_entries from public, anon, authenticated;
grant select, insert, delete on public.recovery_division_reveals,
  public.recovery_division_reveal_entries to service_role;

-- Phase-aware events are deliberately unrunnable until the reveal and final
-- tactics snapshot are integrated. The trigger guards every commit path,
-- including a direct call to the existing finish RPC; the failed transaction
-- rolls back any division/result/award writes made before its commit insert.
create function public.recovery_guard_unfinished_two_phase_commit()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists (
    select 1 from public.events e
    where e.id = new.event_id and e.registration_deadline is not null
  ) then
    raise sqlstate 'PT409' using message = 'Two-phase race input is not yet available.';
  end if;
  return new;
end;
$$;
revoke all on function public.recovery_guard_unfinished_two_phase_commit()
  from public, anon, authenticated;
grant execute on function public.recovery_guard_unfinished_two_phase_commit()
  to service_role;
create trigger recovery_guard_unfinished_two_phase_commit
  before insert on public.recovery_race_commits
  for each row execute function public.recovery_guard_unfinished_two_phase_commit();

commit;
