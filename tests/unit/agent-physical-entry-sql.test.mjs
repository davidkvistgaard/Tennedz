import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=readFileSync(new URL(
  '../../supabase/migrations/20261112090000_agent_physical_entry_existing_lineup_v1.sql',
  import.meta.url),'utf8');
const user='11111111-1111-4111-8111-111111111111';
const team='22222222-2222-4222-8222-222222222222';
const event='33333333-3333-4333-8333-333333333333';
const riders=Array.from({length:8},(_,index)=>
  `44444444-4444-4444-8444-${String(index+1).padStart(12,'0')}`);

test('agent RPC preserves the entered lineup under the join lock',
  async()=>{
    const db=new PGlite();
    try{
      await db.exec(`create role anon;
        create role authenticated;
        create role service_role;
        create table public.teams(id uuid primary key,user_id uuid unique);
        create table public.event_teams(event_id uuid,team_id uuid,
          selected_riders uuid[],captain_id uuid,
          primary key(event_id,team_id));
        create table public.agent_calls(n integer);
        create function public.recovery_join_event_physical_v1(
          p_user uuid,p_event uuid,p_riders uuid[],p_captain uuid,
          p_orders jsonb,p_stake jsonb,p_team_style jsonb)
        returns jsonb language plpgsql as $$ begin
          insert into public.agent_calls values(1);
          return jsonb_build_object('ok',true);
        end $$;`);
      await db.exec(migration);
      await db.query('insert into public.teams values($1,$2)',
        [team,user]);
      await db.query(`insert into public.event_teams values(
        $1,$2,$3,$4)`,[event,team,riders,riders[0]]);
      const submit=(owner,selection,captain)=>db.query(`select
        public.recovery_join_agent_event_physical_v1($1::uuid,
        $2::uuid,$3::uuid[],$4::uuid,'{}','{}','{}') as receipt`,
      [owner,event,selection,captain]);
      assert.equal((await submit(user,riders,riders[0]))
        .rows[0].receipt.ok,true);
      await assert.rejects(submit(user,riders.slice().reverse(),
        riders[0]),/preserve the entered lineup/);
      await assert.rejects(submit(user,riders,riders[1]),
        /preserve the entered lineup/);
      await assert.rejects(submit(team,riders,riders[0]),
        /no team/);
      const called=await db.query('select count(*)::int as n from public.agent_calls');
      assert.equal(called.rows[0].n,1);
      const grants=await db.query(`select
        has_function_privilege('anon',
          'public.recovery_join_agent_event_physical_v1(uuid,uuid,uuid[],uuid,jsonb,jsonb,jsonb)',
          'EXECUTE') as anon,
        has_function_privilege('service_role',
          'public.recovery_join_agent_event_physical_v1(uuid,uuid,uuid[],uuid,jsonb,jsonb,jsonb)',
          'EXECUTE') as service`);
      assert.deepEqual(grants.rows[0],{anon:false,service:true});
    }finally{await db.close();}
  });
