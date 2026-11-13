import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=readFileSync(new URL(
  '../../supabase/migrations/20261112140000_default_physical_entry_v1.sql',
  import.meta.url),'utf8');
const joinMigration=readFileSync(new URL(
  '../../supabase/migrations/20261112141000_default_physical_join_v1.sql',
  import.meta.url),'utf8');
const event='11111111-1111-4111-8111-111111111111';
const teamA='22222222-2222-4222-8222-222222222222';
const teamB='33333333-3333-4333-8333-333333333333';
const userB='66666666-6666-4666-8666-666666666666';
const riders=Array.from({length:16},(_,index)=>
  `44444444-4444-4444-8444-${String(index+1).padStart(12,'0')}`);
const lineupA=riders.slice(0,8),lineupB=riders.slice(8);
const orders={version:2,captainId:lineupB[0],
  roadCaptainId:lineupB[1],helperIds:lineupB.slice(2),
  baseline:{effort:'conserve',chase:'selective',
    attack:'none',frontWork:'rotate'},phases:[]};
const stake={sportingGoal:'none',sportingCaptainId:lineupB[0]};
const style={id:teamB,name:'Team B',color:'#224466',
  accent:'#ffffff',pattern:'band'};
const plan={teamId:teamB,policyVersion:'default-physical-entry-v1',
  lineupSource:'entered',tacticsSource:'game_ai',
  selectedRiders:lineupB,captainId:lineupB[0],
  orders,stake,teamStyle:style};

async function database(){
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;
    create role service_role;
    create table public.teams(id uuid primary key,user_id uuid);
    create table public.riders(id uuid primary key,
      gender text,injury_until date);
    create table public.team_riders(team_id uuid,rider_id uuid);
    create table public.events(id uuid primary key,kind text,
      status text,deadline timestamptz,race_team_size integer,
      gender text);
    create table public.game_state(id integer,game_date date);
    create table public.event_teams(event_id uuid,team_id uuid,
      selected_riders uuid[],captain_id uuid,orders jsonb,
      primary key(event_id,team_id));
    create table public.recovery_physical_entry_inputs(
      event_id uuid,team_id uuid,schema_version text,
      selected_riders uuid[],captain_id uuid,orders jsonb,
      stake jsonb,team_style jsonb,rider_numbers jsonb,
      primary key(event_id,team_id),
      foreign key(event_id,team_id)
        references public.event_teams(event_id,team_id));
    create table public.recovery_race_commits(event_id uuid);
    create table public.recovery_position_race_recordings(event_id uuid);
    create table public.event_division_runs(event_id uuid);
    create table public.event_team_results(event_id uuid);
    create table public.event_rider_results(event_id uuid);
    create table public.event_runs(event_id uuid);
    create table public.event_stages(event_id uuid);
    create sequence public.recovery_physical_bib_numbers;
    create function public.recovery_join_event_physical_v1(
      p_user uuid,p_event uuid,p_riders uuid[],p_captain uuid,
      p_orders jsonb,p_stake jsonb,p_team_style jsonb)
    returns jsonb language plpgsql as $$
    declare tid uuid;
    begin
      select id into tid from public.teams where user_id=p_user;
      insert into public.recovery_physical_entry_inputs values(
        p_event,tid,'physical-entry-input-v1',p_riders,p_captain,
        p_orders,p_stake,p_team_style,'{}'::jsonb);
      return jsonb_build_object('ok',true,'team_id',tid);
    end $$;`);
  await db.exec(migration);
  await db.exec(joinMigration);
  await db.query(`insert into public.events values(
    $1,'one_day','OPEN',now()-interval '1 minute',8,'M')`,
  [event]);
  await db.exec(`insert into public.game_state values
    (1,'2026-02-19');`);
  await db.query('insert into public.teams values($1,null)',[teamA]);
  await db.query('insert into public.teams values($1,$2)',
    [teamB,userB]);
  for(const [index,id] of riders.entries()){
    await db.query(`insert into public.riders values($1,'M',null)`,[id]);
    await db.query('insert into public.team_riders values($1,$2)',
      [index<8?teamA:teamB,id]);
  }
  await db.query(`insert into public.event_teams values
    ($1,$2,$3::uuid[],$4,null),
    ($1,$5,$6::uuid[],$7,null)`,
  [event,teamA,lineupA,lineupA[0],teamB,lineupB,lineupB[0]]);
  await db.query(`insert into public.recovery_physical_entry_inputs
    values($1,$2,'physical-entry-input-v1',$3::uuid[],$4,
      '{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb)`,
  [event,teamA,lineupA,lineupA[0]]);
  return db;
}

async function commit(db,defaults=[plan]){
  return db.query(`select public.recovery_commit_default_physical_entries_v1(
    $1::uuid,$2::jsonb) as receipt`,[event,JSON.stringify(defaults)]);
}

test('defaults fill only missing entered teams, preserve manager input and replay idempotently',async()=>{
  const db=await database();
  try{
    const first=await commit(db);
    assert.equal(first.rows[0].receipt.default_entries_committed,1);
    assert.equal(first.rows[0].receipt.total_entries,2);
    const saved=await db.query(`select team_id,selected_riders,
      orders,rider_numbers from public.recovery_physical_entry_inputs
      order by team_id`);
    assert.equal(saved.rows.length,2);
    assert.deepEqual(saved.rows[0].orders,{});
    assert.deepEqual(saved.rows[1].selected_riders,lineupB);
    assert.deepEqual(saved.rows[1].orders,orders);
    assert.equal(Object.keys(saved.rows[1].rider_numbers).length,8);
    const audit=await db.query(`select policy_version,lineup_source,
      tactics_source from public.recovery_default_physical_entry_audit_v1`);
    assert.deepEqual(audit.rows,[{policy_version:
      'default-physical-entry-v1',lineup_source:'entered',
    tactics_source:'game_ai'}]);
    const again=await commit(db);
    assert.equal(again.rows[0].receipt.default_entries_committed,0);
    const grants=await db.query(`select
      has_function_privilege('anon',
        'public.recovery_commit_default_physical_entries_v1(uuid,jsonb)',
        'EXECUTE') as anon_execute,
      has_table_privilege('anon',
        'public.recovery_default_tactics_v1','SELECT') as anon_read`);
    assert.equal(grants.rows[0].anon_execute,false);
    assert.equal(grants.rows[0].anon_read,false);
  }finally{await db.close();}
});

test('refuses unentered teams without modifying the saved race',async()=>{
  const db=await database();
  try{
    const rogue={...plan,teamId:
      '55555555-5555-4555-8555-555555555555'};
    await assert.rejects(commit(db,[plan,rogue]),
      /Defaults may only be assigned to entered teams/);
    const saved=await db.query(`select count(*)::int total from
      public.recovery_physical_entry_inputs`);
    assert.equal(saved.rows[0].total,1);
  }finally{await db.close();}
});

test('refuses defaults before the deadline',async()=>{
  const db=await database();
  try{
    await db.query(`update public.events set deadline=now()+
      interval '1 hour' where id=$1`,[event]);
    await assert.rejects(commit(db),/not ready for default tactics/);
  }finally{await db.close();}
});

test('explicit default entry is audited and refuses to replace manager input',async()=>{
  const db=await database();
  try{
    const call=()=>db.query(`select
      public.recovery_join_default_event_physical_v1(
        $1::uuid,$2::uuid,$3::uuid[],$4::uuid,
        $5::jsonb,$6::jsonb,$7::jsonb,
        'entered','game_ai') as receipt`,
    [userB,event,lineupB,lineupB[0],JSON.stringify(orders),
      JSON.stringify(stake),JSON.stringify(style)]);
    const receipt=await call();
    assert.equal(receipt.rows[0].receipt.default_policy_version,
      'default-physical-entry-v1');
    await assert.rejects(call(),/already saved race tactics/);
    const audit=await db.query(`select count(*)::int total from
      public.recovery_default_physical_entry_audit_v1`);
    assert.equal(audit.rows[0].total,1);
  }finally{await db.close();}
});
