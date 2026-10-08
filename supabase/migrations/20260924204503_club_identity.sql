-- Additive cosmetic storage. No changes to teams, riders or race data.
begin;
create table public.club_identities (
  team_id uuid primary key references public.teams(id),
  palette text not null check (length(palette) between 1 and 40),
  pattern text not null check (length(pattern) between 1 and 40),
  updated_at timestamptz not null default now()
);
alter table public.club_identities enable row level security;
-- Access goes through the authenticated, ownership-checked application API.
revoke all on public.club_identities from public, anon, authenticated;
grant select, insert, update on public.club_identities to service_role;
comment on table public.club_identities is 'Account-saved cosmetic kit. Standard allocation validated by application; no sporting effect.';
commit;
