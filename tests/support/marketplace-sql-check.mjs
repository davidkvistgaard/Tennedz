import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import assert from 'node:assert/strict';

const db=new PGlite();
await db.exec(`
create role service_role; create role anon; create role authenticated;
create table public.teams(id uuid primary key,user_id uuid not null,coins integer,name text);
create table public.riders(id uuid primary key,name text not null,display_name text,
  gender text,nationality text,age integer,sprint integer,flat integer,hills integer,
  mountain integer,cobbles integer,timetrial integer,endurance integer,strength integer,wind integer);
create table public.team_riders(id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id),rider_id uuid references public.riders(id),
  created_at timestamptz default now(),unique(team_id,rider_id));
create table public.events(id uuid primary key,status text);
create table public.event_teams(event_id uuid references public.events(id),
  team_id uuid references public.teams(id),selected_riders uuid[],captain_id uuid);
create table public.recovery_default_lineups(team_id uuid references public.teams(id),
  selected_riders uuid[],captain_id uuid);
`);
const migration=readFileSync(new URL('../../supabase/migrations/20261029153000_rider_marketplace.sql',import.meta.url),'utf8');
await db.exec(migration);
const seller='11111111-1111-4111-8111-111111111111';
const buyer='22222222-2222-4222-8222-222222222222';
const userSeller='33333333-3333-4333-8333-333333333333';
const userBuyer='44444444-4444-4444-8444-444444444444';
const rider='55555555-5555-4555-8555-555555555555';
const second='66666666-6666-4666-8666-666666666666';
await db.query('insert into public.teams values ($1,$2,100,$3),($4,$5,200,$6)',
  [seller,userSeller,'Seller',buyer,userBuyer,'Buyer']);
await db.query(`insert into public.riders
  (id,name,display_name,gender,nationality,age,sprint,flat,hills,mountain,cobbles,timetrial,endurance,strength,wind)
  values ($1,'Nora Voss','Nora Voss','F','DEN',26,44,61,57,72,39,51,70,56,47),
         ($2,'Emil Berg','Emil Berg','M','DEN',24,75,48,40,30,40,50,60,52,55)`,[rider,second]);
await db.query('insert into public.team_riders(team_id,rider_id) values ($1,$2),($1,$3)',
  [seller,rider,second]);
const listing=(await db.query('select public.rider_market_list($1,$2,$3) id',
  [userSeller,rider,50])).rows[0].id;
assert.ok(listing);
await assert.rejects(db.query('select public.rider_market_list($1,$2,$3)',
  [userSeller,rider,50]));
const found=(await db.query(`select * from public.rider_market_search(
  p_gender=>'F',p_skill=>'mountain',p_min_skill=>70,p_max_price=>50)`)).rows;
assert.equal(found.length,1);
assert.equal(found[0].rider_id,rider);
const hidden=(await db.query(`select * from public.rider_market_search(
  p_gender=>'M',p_skill=>'mountain',p_min_skill=>70)`)).rows;
assert.equal(hidden.length,0);
await db.query('select public.rider_market_buy($1,$2)',[userBuyer,listing]);
const moved=(await db.query('select team_id from public.team_riders where rider_id=$1',[rider])).rows;
assert.deepEqual(moved.map(x=>x.team_id),[buyer]);
const balances=(await db.query('select id,coins from public.teams order by id')).rows;
assert.deepEqual(balances.map(x=>x.coins),[150,150]);
const sold=(await db.query('select status,buyer_team_id from public.rider_market_listings where id=$1',[listing])).rows[0];
assert.equal(sold.status,'sold');assert.equal(sold.buyer_team_id,buyer);
await assert.rejects(db.query('select public.rider_market_buy($1,$2)',[userBuyer,listing]));
await assert.rejects(db.query('insert into public.team_riders(team_id,rider_id) values ($1,$2)',[seller,rider]));
const secondListing=(await db.query('select public.rider_market_list($1,$2,$3) id',
  [userSeller,second,75])).rows[0].id;
await assert.rejects(db.query('select public.rider_market_buy($1,$2)',[userSeller,secondListing]));
await db.query('select public.rider_market_cancel($1,$2)',[userSeller,secondListing]);
assert.equal((await db.query('select status from public.rider_market_listings where id=$1',[secondListing])).rows[0].status,'cancelled');
assert.equal((await db.query('select count(*)::integer n from public.rider_market_search()')).rows[0].n,0);
await db.query(`insert into public.events values ('77777777-7777-4777-8777-777777777777','OPEN')`);
await db.query(`insert into public.event_teams values
  ('77777777-7777-4777-8777-777777777777',$1,array[$2]::uuid[],$2)`,[seller,second]);
await assert.rejects(db.query('select public.rider_market_list($1,$2,$3)',[userSeller,second,75]));
await db.query('delete from public.event_teams');
await db.query('insert into public.recovery_default_lineups values ($1,array[$2]::uuid[],$2)',
  [seller,second]);
await assert.rejects(db.query('select public.rider_market_list($1,$2,$3)',[userSeller,second,75]));
await db.query('delete from public.recovery_default_lineups');
const costly=(await db.query('select public.rider_market_list($1,$2,$3) id',
  [userSeller,second,200])).rows[0].id;
await assert.rejects(db.query('select public.rider_market_buy($1,$2)',[userBuyer,costly]));
assert.equal((await db.query('select status from public.rider_market_listings where id=$1',[costly])).rows[0].status,'active');
assert.equal((await db.query('select team_id from public.team_riders where rider_id=$1',[second])).rows[0].team_id,seller);
const acl=(await db.query(`select c.relrowsecurity as rls,
  has_table_privilege('anon','public.rider_market_listings','SELECT') as anon_select,
  has_table_privilege('authenticated','public.rider_market_listings','INSERT') as authenticated_insert
  from pg_class c where c.oid='public.rider_market_listings'::regclass`)).rows[0];
assert.deepEqual(acl,{rls:true,anon_select:false,authenticated_insert:false});
assert.equal((await db.query(`select has_function_privilege(
  'anon','public.rider_market_buy(uuid,uuid)','EXECUTE') allowed`)).rows[0].allowed,false);
console.log('Migration and local fixed-price listing/search/buy/cancel/ownership tests passed.');
await db.close();
