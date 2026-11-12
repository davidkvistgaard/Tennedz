import test from 'node:test';
import assert from 'node:assert/strict';
import {runWinterAgentTacticsV1,WINTER_AGENT_EVENT_ID} from
  '../../lib/race/winter-agent-runner-v1.mjs';

const ids=Array.from({length:8},(_,i)=>`r${i}`);
const environment={PELOTONIA_WINTER_AGENT_TACTICS_ENABLED:'true',
  PELOTONIA_PHYSICAL_ENTRY_ENABLED:'true',
  PELOTONIA_PHYSICAL_ENTRY_EVENT_ID:WINTER_AGENT_EVENT_ID};

function fixture({already=false,tag='winter-2026',closed=false}={}){
  const teamId='00000000-0000-4000-8000-000000000001';
  const humanId='00000000-0000-4000-8000-000000000002';
  const data={events:{id:WINTER_AGENT_EVENT_ID,gender:'M',
    status:'OPEN',deadline:closed?'2020-01-01T00:00:00Z':
      '2030-01-01T00:00:00Z',stage_profile_id:'stage'},
  stage_profiles:{distance_km:298,tags:['FLAT'],keypoints:[]},
  event_teams:[{team_id:teamId,selected_riders:ids,
    captain_id:ids[0]},{team_id:humanId,
    selected_riders:ids,captain_id:ids[0]}],
  recovery_physical_entry_inputs:already?[{team_id:teamId}]:[],
  teams:{[teamId]:{id:teamId,user_id:'agent-user',name:'Agent'},
    [humanId]:{id:humanId,user_id:'human-user',name:'Human'}},
  riders:ids.map((id,i)=>({id,sprint:i?30:48,hills:28,
    flat:40,endurance:40,leadership:40,strength:40})),
  club_identities:null};
  const calls=[];
  const db={from(table){const query={filters:[],select(){return this;},
    eq(field,value){this.filters.push([field,value]);return this;},
    in(){return this;},order(){return Promise.resolve({
      data:data[table],error:null});},
    maybeSingle(){const key=this.filters.find(([field])=>
      field==='id'||field==='team_id')?.[1];
      return Promise.resolve({data:table==='teams'?data.teams[key]:
        data[table],error:null});},
    then(resolve){return Promise.resolve({data:data[table],
      error:null}).then(resolve);}};return query;},
  auth:{admin:{async getUserById(id){return {data:{user:{id,
    app_metadata:id==='agent-user'?{pelotonia_agent:tag}:{} }},
    error:null};}}}};
  const rpc=async(dbArg,name,args)=>{
    assert.equal(dbArg,db);calls.push({name,args});
    return {ok:true};};
  return {db,rpc,calls,teamId};
}

test('submits only tagged agent and preserves its entered lineup',async()=>{
  const {db,rpc,calls,teamId}=fixture();
  const result=await runWinterAgentTacticsV1({db,rpc,environment,
    now:new Date('2026-11-12T12:00:00Z')});
  assert.equal(result.committed,1);
  assert.equal(calls.length,1);
  assert.equal(calls[0].name,
    'recovery_join_winter_agent_event_physical_v1');
  assert.deepEqual(calls[0].args.p_riders,ids);
  assert.equal(calls[0].args.p_captain,ids[0]);
  assert.equal(calls[0].args.p_policy_version,
    'winter-agent-tactics-v1');
  assert.equal(result.results[0].team_id,teamId);
});

test('idempotent existing entry, foreign tag and closed event never write',
  async()=>{
    for(const options of [{already:true},{tag:'other'},
      {closed:true}]){
      const {db,rpc,calls}=fixture(options);
      if(options.closed)await assert.rejects(()=>
        runWinterAgentTacticsV1({db,rpc,environment,
          now:new Date('2026-11-12T12:00:00Z')}),{status:409});
      else await runWinterAgentTacticsV1({db,rpc,environment,
        now:new Date('2026-11-12T12:00:00Z')});
      assert.equal(calls.length,0);
    }
  });
