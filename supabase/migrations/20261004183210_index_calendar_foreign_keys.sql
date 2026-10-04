-- Cover the two new foreign keys flagged by the isolated database advisor.
begin;
create index if not exists recovery_default_lineups_captain_idx
  on public.recovery_default_lineups(captain_id);
create index if not exists recovery_ranking_awards_event_idx
  on public.recovery_ranking_awards(event_id);
commit;
