-- A listing is available for exactly 345,600 elapsed seconds from creation.
-- Keep the deadline in the database so browser clocks and daylight saving cannot extend it.
begin;

alter table public.rider_market_listings add column expires_at timestamptz;
update public.rider_market_listings
  set expires_at=created_at + interval '345600 seconds';
alter table public.rider_market_listings alter column expires_at set not null;
alter table public.rider_market_listings add constraint rider_market_96_hour_check
  check (expires_at=created_at + interval '345600 seconds');
alter table public.rider_market_listings
  drop constraint rider_market_listings_status_check,
  drop constraint market_listing_close_check;
alter table public.rider_market_listings add constraint rider_market_listings_status_check
  check (status in ('active','sold','cancelled','expired'));
alter table public.rider_market_listings add constraint market_listing_close_check check (
  (status='active' and buyer_team_id is null and closed_at is null) or
  (status='expired' and buyer_team_id is null and closed_at=expires_at) or
  (status='cancelled' and buyer_team_id is null and closed_at is not null) or
  (status='sold' and buyer_team_id is not null and closed_at is not null
    and buyer_team_id<>seller_team_id)
);
create index rider_market_active_expiry
  on public.rider_market_listings(expires_at) where status='active';

create function public.rider_market_stamp_listing()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v_created timestamptz := pg_catalog.clock_timestamp();
begin
  -- The existing list RPC holds the race/transfer advisory lock before this trigger.
  update public.rider_market_listings
    set status='expired',closed_at=expires_at
    where rider_id=new.rider_id and status='active' and expires_at<=v_created;
  new.created_at := v_created;
  new.expires_at := v_created + interval '345600 seconds';
  return new;
end $$;
create trigger rider_market_stamp_listing_before_insert
  before insert on public.rider_market_listings
  for each row execute function public.rider_market_stamp_listing();

create function public.rider_market_guard_purchase_deadline()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if old.status='active' and new.status='sold'
    and pg_catalog.clock_timestamp()>=old.expires_at then
    raise exception using errcode='PT409',message='This listing has expired.';
  end if;
  return new;
end $$;
create trigger rider_market_guard_purchase_before_update
  before update on public.rider_market_listings
  for each row execute function public.rider_market_guard_purchase_deadline();

drop function public.rider_market_search(
  text,text,text,integer,integer,integer,integer,integer,text,text,integer,integer);
create function public.rider_market_search(
  p_query text default '',p_gender text default null,p_skill text default null,
  p_min_skill integer default null,p_min_price integer default null,
  p_max_price integer default null,p_min_age integer default null,
  p_max_age integer default null,p_country text default null,
  p_sort text default 'newest',
  p_limit integer default 50,p_offset integer default 0)
returns table(id uuid,rider_id uuid,seller_team_id uuid,seller_name text,
  price integer,created_at timestamptz,expires_at timestamptz,skill_value integer)
language sql volatile security invoker set search_path='' as $$
  select l.id,l.rider_id,l.seller_team_id,t.name,l.price,l.created_at,l.expires_at,
    case p_skill
      when 'sprint' then r.sprint when 'flat' then r.flat
      when 'hills' then r.hills when 'mountain' then r.mountain
      when 'cobbles' then r.cobbles when 'timetrial' then r.timetrial
      when 'endurance' then r.endurance when 'strength' then r.strength
      when 'wind' then r.wind else null end
  from public.rider_market_listings l
  join public.riders r on r.id=l.rider_id
  join public.teams t on t.id=l.seller_team_id
  where l.status='active' and l.expires_at>pg_catalog.clock_timestamp()
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

revoke all on function public.rider_market_stamp_listing(),
  public.rider_market_guard_purchase_deadline(),
  public.rider_market_search(text,text,text,integer,integer,integer,integer,integer,text,text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.rider_market_stamp_listing(),
  public.rider_market_guard_purchase_deadline(),
  public.rider_market_search(text,text,text,integer,integer,integer,integer,integer,text,text,integer,integer)
  to service_role;
notify pgrst, 'reload schema';
commit;
