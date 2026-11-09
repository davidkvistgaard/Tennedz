import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=readFileSync(new URL(
  '../../supabase/migrations/20261109131922_committed_physical_entry_inputs.sql',
  import.meta.url),'utf8');
const user='11111111-1111-4111-8111-111111111111';
const team='22222222-2222-4222-8222-222222222222';
const event='33333333-3333-4333-8333-333333333333';
const riders=Array.from({length:8},(_,index)=>
  `44444444-4444-4444-8444-${String(index+1).padStart(12,'0')}`);
const orders={captainId:riders[6],roadCaptainId:riders[0],
  helperIds:riders.filter(id=>id!==riders[6]&&id!==riders[0]),
  baseline:{effort:'steady',attack:'none',
    chase:'selective',frontWork:'rotate'}};
const stake={sportingGoal:'sprint_finish',
  sportingCaptainId:riders[6]};
const style={id:team,name:'Test team',color:'#224466',
  accent:'#ffffff',pattern:'band'};

async function database(){
  const db=new PGlite();
  await db.exec(`create role anon;
    create role authenticated;
    create role service_role;
    create table public.event_teams(
      event_id uuid not null, team_id uuid not null,
      selected_riders uuid[] not null, captain_id uuid not null,
      unique(event_id,team_id));
    create function public.recovery_join_event(
      p_user uuid,p_event uuid,p_riders uuid[],p_captain uuid)
    returns jsonb language plpgsql as $$ begin
      if p_user <> '${user}' then raise exception 'Wrong owner'; end if;
      insert into public.event_teams values(
        p_event,'${team}',p_riders,p_captain)
      on conflict(event_id,team_id) do update set
        selected_riders=excluded.selected_riders,
        captain_id=excluded.captain_id;
      return jsonb_build_object('ok',true,'team_id','${team}');
    end $$;`);
  await db.exec(migration);
  return db;
}

async function submit(db,values={}){
  const input={orders,stake,style,...values};
  return db.query(`select public.recovery_join_event_physical_v1(
    $1::uuid,$2::uuid,$3::uuid[],$4::uuid,
    $5::jsonb,$6::jsonb,$7::jsonb) as receipt`,
  [user,event,riders,riders[6],JSON.stringify(input.orders),
    JSON.stringify(input.stake),JSON.stringify(input.style)]);
}

test('physical entry commits roster and actual inputs atomically',
  async()=>{
    const db=await database();
    try{
      const receipt=await submit(db);
      assert.equal(receipt.rows[0].receipt.physical_input_version,
        'physical-entry-input-v1');
      const saved=await db.query(`select selected_riders,orders,
        stake,team_style,rider_numbers from
        public.recovery_physical_entry_inputs`);
      assert.deepEqual(saved.rows[0].selected_riders,riders);
      assert.deepEqual(saved.rows[0].orders,orders);
      assert.deepEqual(saved.rows[0].stake,stake);
      assert.deepEqual(saved.rows[0].team_style,style);
      const bibs=saved.rows[0].rider_numbers;
      assert.deepEqual(Object.keys(bibs).sort(),[...riders].sort());
      assert.equal(new Set(Object.values(bibs)).size,8);
      assert.ok(Object.values(bibs).every(value=>
        Number.isInteger(value)&&value>0));
      const again=await submit(db);
      assert.deepEqual(again.rows[0].receipt.rider_numbers,bibs);
      const security=await db.query(`select relrowsecurity from pg_class
        where oid='public.recovery_physical_entry_inputs'::regclass`);
      assert.equal(security.rows[0].relrowsecurity,true);
      const grants=await db.query(`select
        has_table_privilege('anon',
          'public.recovery_physical_entry_inputs','SELECT') as anon_read,
        has_table_privilege('service_role',
          'public.recovery_physical_entry_inputs','SELECT') as service_read,
        has_function_privilege('anon',
          'public.recovery_join_event_physical_v1(uuid,uuid,uuid[],uuid,jsonb,jsonb,jsonb)',
          'EXECUTE') as anon_execute`);
      assert.equal(grants.rows[0].anon_read,false);
      assert.equal(grants.rows[0].service_read,true);
      assert.equal(grants.rows[0].anon_execute,false);
    }finally{await db.close();}
  });

test('invalid sporting stake rolls back both entry and physical input',
  async()=>{
    const db=await database();
    try{
      await assert.rejects(submit(db,{stake:{...stake,
        sportingCaptainId:'not-in-lineup'}}),
      /complete committed inputs/);
      const entries=await db.query(
        'select count(*)::int as total from public.event_teams');
      const inputs=await db.query(`select count(*)::int as total
        from public.recovery_physical_entry_inputs`);
      assert.equal(entries.rows[0].total,0);
      assert.equal(inputs.rows[0].total,0);
    }finally{await db.close();}
  });
