begin;
create table public.club_favorites (
  owner_team_id uuid not null references public.teams(id) on delete cascade,
  favorite_team_id uuid not null references public.teams(id) on delete cascade,
  primary key (owner_team_id, favorite_team_id)
);
create index on public.club_favorites (favorite_team_id);
alter table public.club_favorites enable row level security;
revoke all on public.club_favorites from public, anon, authenticated;
grant select, insert, delete on public.club_favorites to service_role;

create function public.search_clubs(p_query text, p_offset integer, p_limit integer)
returns table(id uuid, name text)
language sql stable security invoker set search_path = ''
as $$
  select t.id, t.name from public.teams t
  where strpos(lower(t.name), lower(p_query)) > 0
  order by t.name, t.id
  offset p_offset limit p_limit
$$;
revoke all on function public.search_clubs(text, integer, integer) from public, anon, authenticated;
grant execute on function public.search_clubs(text, integer, integer) to service_role;
commit;
