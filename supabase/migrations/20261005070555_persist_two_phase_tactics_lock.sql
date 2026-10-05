-- Freeze a two-phase race's final entered lineups/orders after tactics close.
-- This is private storage only; the opt-in result-commit guard still blocks
-- all two-phase races from finishing until the runner consumes this snapshot.
begin;

create table public.recovery_tactics_commits (
  event_id uuid primary key references public.events(id) on delete restrict,
  input_snapshot jsonb not null,
  locked_at timestamptz not null default now()
);
alter table public.recovery_tactics_commits enable row level security;
revoke all on public.recovery_tactics_commits from public, anon, authenticated;
grant select, insert on public.recovery_tactics_commits to service_role;

create function public.recovery_commit_tactics_lock(p_event uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_event public.events;
  v_commit public.recovery_tactics_commits;
  v_reveal jsonb;
  v_snapshot jsonb;
  v_entries integer;
  v_revealed integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(73192026);
  select * into v_event from public.events e where e.id = p_event for update;
  if v_event.id is null then
    raise sqlstate 'PT404' using message = 'The scheduled race was not found.';
  end if;
  if v_event.registration_deadline is null then
    raise sqlstate 'PT409' using message = 'This race does not use a tactics lock.';
  end if;
  select * into v_commit from public.recovery_tactics_commits c
    where c.event_id = p_event;
  if v_commit.event_id is not null then
    return jsonb_build_object('eventId', p_event,
      'lockedAt', v_commit.locked_at,
      'inputSnapshot', v_commit.input_snapshot, 'alreadyLocked', true);
  end if;
  if v_event.status is distinct from 'OPEN'
    or v_event.tactics_deadline > pg_catalog.clock_timestamp()
    or exists(select 1 from public.recovery_race_commits c
      where c.event_id = p_event) then
    raise sqlstate 'PT409' using message = 'The tactics lock is outside its phase.';
  end if;
  if not exists(select 1 from public.recovery_division_reveals r
      where r.event_id = p_event) then
    raise sqlstate 'PT409' using message = 'The division reveal must finish before tactics lock.';
  end if;
  select count(*) into v_entries from public.event_teams et
    where et.event_id = p_event;
  select count(*) into v_revealed from public.recovery_division_reveal_entries r
    where r.event_id = p_event;
  if v_entries < 2 or v_entries > 400 or v_entries <> v_revealed
    or exists(select 1 from public.event_teams et
      where et.event_id = p_event and et.orders is null) then
    raise sqlstate 'PT409' using message = 'The revealed race entries are incomplete.';
  end if;

  v_reveal := public.recovery_commit_division_reveal(p_event);
  v_snapshot := public.recovery_race_snapshot(p_event)
    || jsonb_build_object('locked_division_reveal',
      v_reveal - 'alreadyRevealed');
  if jsonb_typeof(v_snapshot->'teams') is distinct from 'array'
    or jsonb_array_length(v_snapshot->'teams') <> v_revealed then
    raise sqlstate 'PT409' using message = 'The final race input is incomplete.';
  end if;
  insert into public.recovery_tactics_commits(event_id, input_snapshot)
    values(p_event, v_snapshot);
  select * into v_commit from public.recovery_tactics_commits c
    where c.event_id = p_event;
  return jsonb_build_object('eventId', p_event,
    'lockedAt', v_commit.locked_at,
    'inputSnapshot', v_commit.input_snapshot, 'alreadyLocked', false);
end;
$$;
revoke all on function public.recovery_commit_tactics_lock(uuid)
  from public, anon, authenticated;
grant execute on function public.recovery_commit_tactics_lock(uuid)
  to service_role;
commit;
