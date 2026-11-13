begin;
create view public.directory_managers as
select t.id, coalesce(
  case when strpos(u.raw_user_meta_data->>'username', '@') = 0
    then nullif(btrim(u.raw_user_meta_data->>'username'), '') end,
  t.name || ' manager'
) as name, t.id as club_id, t.name as club_name
from public.teams t left join auth.users u on u.id = t.user_id;

create view public.directory_riders with (security_invoker = true) as
select r.id, coalesce(nullif(r.display_name, ''), r.name) as name,
  t.id as club_id, t.name as club_name
from public.riders r left join public.team_riders tr on tr.rider_id = r.id
left join public.teams t on t.id = tr.team_id;

revoke all on public.directory_managers, public.directory_riders from public, anon, authenticated;
grant select on public.directory_managers, public.directory_riders to service_role;

create table public.directory_manager_favorites (
  owner_team_id uuid not null references public.teams(id) on delete cascade,
  target_id uuid not null references public.teams(id) on delete cascade,
  primary key (owner_team_id, target_id)
);
create index on public.directory_manager_favorites(target_id);
alter table public.directory_manager_favorites enable row level security;
revoke all on public.directory_manager_favorites from public, anon, authenticated;
grant select, insert, delete on public.directory_manager_favorites to service_role;

create function public.find_directory_managers(p_owner uuid, p_query text, p_offset integer, p_limit integer)
returns table(id uuid, name text, club_id uuid, club_name text, favorite boolean)
language sql stable security invoker set search_path = ''
as $$
  select d.id, d.name, d.club_id, d.club_name, f.target_id is not null
  from public.directory_managers d
  left join public.directory_manager_favorites f
    on f.target_id = d.id and f.owner_team_id = p_owner
  where case when p_query = '' then f.target_id is not null
    else strpos(lower(d.name), lower(p_query)) > 0 end
  order by d.name, d.id
  offset p_offset limit p_limit
$$;
revoke all on function public.find_directory_managers(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.find_directory_managers(uuid, text, integer, integer) to service_role;

create table public.directory_rider_favorites (
  owner_team_id uuid not null references public.teams(id) on delete cascade,
  target_id uuid not null references public.riders(id) on delete cascade,
  primary key (owner_team_id, target_id)
);
create index on public.directory_rider_favorites(target_id);
alter table public.directory_rider_favorites enable row level security;
revoke all on public.directory_rider_favorites from public, anon, authenticated;
grant select, insert, delete on public.directory_rider_favorites to service_role;

create function public.find_directory_riders(p_owner uuid, p_query text, p_offset integer, p_limit integer)
returns table(id uuid, name text, club_id uuid, club_name text, favorite boolean)
language sql stable security invoker set search_path = ''
as $$
  select d.id, d.name, d.club_id, d.club_name, f.target_id is not null
  from public.directory_riders d
  left join public.directory_rider_favorites f
    on f.target_id = d.id and f.owner_team_id = p_owner
  where case when p_query = '' then f.target_id is not null
    else strpos(lower(d.name), lower(p_query)) > 0 end
  order by d.name, d.id
  offset p_offset limit p_limit
$$;
revoke all on function public.find_directory_riders(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.find_directory_riders(uuid, text, integer, integer) to service_role;
commit;
