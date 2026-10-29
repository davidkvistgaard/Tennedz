-- Fixed-price rider market. Apply to an isolated project and verify before production.
-- The existing race-cycle advisory lock also serializes transfers with race snapshots.
begin;

create unique index team_riders_one_current_owner
  on public.team_riders(rider_id) where rider_id is not null;

create table public.rider_market_listings (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders(id) on delete restrict,
  seller_team_id uuid not null references public.teams(id) on delete restrict,
  buyer_team_id uuid references public.teams(id) on delete restrict,
  price integer not null check (price between 1 and 1000000000),
  status text not null default 'active' check (status in ('active','sold','cancelled')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint market_listing_close_check check (
    (status='active' and buyer_team_id is null and closed_at is null) or
    (status='cancelled' and buyer_team_id is null and closed_at is not null) or
    (status='sold' and buyer_team_id is not null and closed_at is not null
      and buyer_team_id<>seller_team_id)
  )
);
create unique index rider_market_one_active_listing
  on public.rider_market_listings(rider_id) where status='active';
create index rider_market_active_price
  on public.rider_market_listings(price,id) where status='active';
create index rider_market_seller_history
  on public.rider_market_listings(seller_team_id,created_at desc);
alter table public.rider_market_listings enable row level security;
revoke all on public.rider_market_listings from public,anon,authenticated;
grant select,insert,update on public.rider_market_listings to service_role;

create function public.rider_market_list(p_user uuid,p_rider uuid,p_price integer)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_team uuid; v_owner uuid; v_id uuid; v_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(73192026);
  if p_price is null or p_price<1 or p_price>1000000000 then
    raise exception using errcode='PT400',message='Choose a price between 1 and 1,000,000,000 coins.';
  end if;
  select count(*) into v_count from public.teams where user_id=p_user;
  if v_count<>1 then raise exception using errcode='PT409',message='Team ownership is not unambiguous.'; end if;
  select id into v_team from public.teams where user_id=p_user;
  select team_id into v_owner from public.team_riders where rider_id=p_rider for update;
  if v_owner is distinct from v_team then
    raise exception using errcode='PT403',message='This rider does not belong to your team.';
  end if;
  if exists(select 1 from public.event_teams et join public.events e on e.id=et.event_id
    where et.team_id=v_team and e.status is distinct from 'FINISHED' and
      (p_rider=any(et.selected_riders) or et.captain_id=p_rider))
    or exists(select 1 from public.recovery_default_lineups dl
      where dl.team_id=v_team and (p_rider=any(dl.selected_riders) or dl.captain_id=p_rider)) then
    raise exception using errcode='PT409',message='Remove this rider from unfinished race entries and saved lineups first.';
  end if;
  insert into public.rider_market_listings(rider_id,seller_team_id,price)
    values(p_rider,v_team,p_price) returning id into v_id;
  return v_id;
end $$;

create function public.rider_market_cancel(p_user uuid,p_listing uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare v_team uuid; v_listing public.rider_market_listings; v_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(73192026);
  select count(*) into v_count from public.teams where user_id=p_user;
  if v_count<>1 then raise exception using errcode='PT409',message='Team ownership is not unambiguous.'; end if;
  select id into v_team from public.teams where user_id=p_user;
  select * into v_listing from public.rider_market_listings where id=p_listing for update;
  if not found or v_listing.seller_team_id<>v_team then
    raise exception using errcode='PT404',message='Listing not found.';
  end if;
  if v_listing.status<>'active' then
    raise exception using errcode='PT409',message='This listing is already closed.';
  end if;
  update public.rider_market_listings set status='cancelled',closed_at=clock_timestamp()
    where id=p_listing;
end $$;

create function public.rider_market_buy(p_user uuid,p_listing uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_buyer public.teams; v_seller public.teams; v_listing public.rider_market_listings;
  v_owner uuid; v_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(73192026);
  select count(*) into v_count from public.teams where user_id=p_user;
  if v_count<>1 then raise exception using errcode='PT409',message='Team ownership is not unambiguous.'; end if;
  select * into v_listing from public.rider_market_listings where id=p_listing for update;
  if not found then raise exception using errcode='PT404',message='Listing not found.'; end if;
  if v_listing.status<>'active' then
    raise exception using errcode='PT409',message='This rider is no longer for sale.';
  end if;
  select * into v_buyer from public.teams where user_id=p_user for update;
  if v_buyer.id=v_listing.seller_team_id then
    raise exception using errcode='PT409',message='You cannot buy your own rider.';
  end if;
  select * into v_seller from public.teams where id=v_listing.seller_team_id for update;
  if coalesce(v_buyer.coins,0)<v_listing.price then
    raise exception using errcode='PT409',message='Your team does not have enough coins.';
  end if;
  if coalesce(v_seller.coins,0)::bigint+v_listing.price>2147483647 then
    raise exception using errcode='PT409',message='The seller cannot receive this amount of coins.';
  end if;
  select team_id into v_owner from public.team_riders
    where rider_id=v_listing.rider_id for update;
  if v_owner is distinct from v_listing.seller_team_id then
    raise exception using errcode='PT409',message='The seller no longer owns this rider.';
  end if;
  if exists(select 1 from public.event_teams et join public.events e on e.id=et.event_id
    where et.team_id=v_seller.id and e.status is distinct from 'FINISHED' and
      (v_listing.rider_id=any(et.selected_riders) or et.captain_id=v_listing.rider_id))
    or exists(select 1 from public.recovery_default_lineups dl
      where dl.team_id=v_seller.id and
        (v_listing.rider_id=any(dl.selected_riders) or dl.captain_id=v_listing.rider_id)) then
    raise exception using errcode='PT409',message='The seller has selected this rider for a race or saved lineup.';
  end if;
  update public.teams set coins=coins-v_listing.price where id=v_buyer.id;
  update public.teams set coins=coalesce(coins,0)+v_listing.price where id=v_seller.id;
  update public.team_riders set team_id=v_buyer.id,created_at=clock_timestamp()
    where rider_id=v_listing.rider_id and team_id=v_seller.id;
  if not found then raise exception using errcode='PT409',message='Rider transfer failed.'; end if;
  update public.rider_market_listings set status='sold',buyer_team_id=v_buyer.id,
    closed_at=clock_timestamp() where id=v_listing.id;
  return v_listing.rider_id;
end $$;

create function public.rider_market_search(
  p_query text default '',p_gender text default null,p_skill text default null,
  p_min_skill integer default null,p_min_price integer default null,
  p_max_price integer default null,p_min_age integer default null,
  p_max_age integer default null,p_country text default null,
  p_sort text default 'newest',
  p_limit integer default 50,p_offset integer default 0)
returns table(id uuid,rider_id uuid,seller_team_id uuid,seller_name text,
  price integer,created_at timestamptz,skill_value integer)
language sql stable security invoker set search_path='' as $$
  select l.id,l.rider_id,l.seller_team_id,t.name,l.price,l.created_at,
    case p_skill
      when 'sprint' then r.sprint when 'flat' then r.flat
      when 'hills' then r.hills when 'mountain' then r.mountain
      when 'cobbles' then r.cobbles when 'timetrial' then r.timetrial
      when 'endurance' then r.endurance when 'strength' then r.strength
      when 'wind' then r.wind else null end
  from public.rider_market_listings l
  join public.riders r on r.id=l.rider_id
  join public.teams t on t.id=l.seller_team_id
  where l.status='active'
    and (p_query='' or pg_catalog.strpos(
      pg_catalog.lower(coalesce(r.display_name,r.name)),pg_catalog.lower(p_query))>0)
    and (p_gender is null or r.gender=p_gender)
    and (p_min_price is null or l.price>=p_min_price)
    and (p_max_price is null or l.price<=p_max_price)
    and (p_min_age is null or r.age>=p_min_age)
    and (p_max_age is null or r.age<=p_max_age)
    and (p_country is null or r.nationality=p_country)
    and (p_min_skill is null or
      case p_skill when 'sprint' then r.sprint when 'flat' then r.flat
        when 'hills' then r.hills when 'mountain' then r.mountain
        when 'cobbles' then r.cobbles when 'timetrial' then r.timetrial
        when 'endurance' then r.endurance when 'strength' then r.strength
        when 'wind' then r.wind else null end >=p_min_skill)
  order by
    case when p_sort='price_asc' then l.price end asc nulls last,
    case when p_sort='price_desc' then l.price end desc nulls last,
    case when p_sort='skill_desc' then
      case p_skill when 'sprint' then r.sprint when 'flat' then r.flat
        when 'hills' then r.hills when 'mountain' then r.mountain
        when 'cobbles' then r.cobbles when 'timetrial' then r.timetrial
        when 'endurance' then r.endurance when 'strength' then r.strength
        when 'wind' then r.wind else null end end desc nulls last,
    l.created_at desc,l.id
  limit least(greatest(coalesce(p_limit,50),1),50)
  offset least(greatest(coalesce(p_offset,0),0),10000);
$$;

revoke all on function public.rider_market_list(uuid,uuid,integer),
  public.rider_market_cancel(uuid,uuid),public.rider_market_buy(uuid,uuid),
  public.rider_market_search(text,text,text,integer,integer,integer,integer,integer,text,text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.rider_market_list(uuid,uuid,integer),
  public.rider_market_cancel(uuid,uuid),public.rider_market_buy(uuid,uuid),
  public.rider_market_search(text,text,text,integer,integer,integer,integer,integer,text,text,integer,integer)
  to service_role;
commit;
