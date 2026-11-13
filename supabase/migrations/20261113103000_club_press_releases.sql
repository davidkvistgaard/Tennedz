begin;
create table public.club_press_releases (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  published_at timestamptz not null default now()
);
create index club_press_releases_team_date_idx
  on public.club_press_releases (team_id, published_at desc, id);
alter table public.club_press_releases enable row level security;
revoke all on public.club_press_releases from public, anon, authenticated;
grant select, insert, delete on public.club_press_releases to service_role;
commit;
