import test from 'node:test';
import assert from 'node:assert/strict';
import {agentPhysicalEntryTokenV1,assertAgentPhysicalEntryTokenV1,
  submitAgentPhysicalEntryV1} from
  '../../lib/race/agent-physical-entry-v1.mjs';

const eventId='109a9235-44e6-d390-1fa9-aec19b65cf3b';
const teamId='00000000-0000-4000-8000-000000000001';
const otherTeam='00000000-0000-4000-8000-000000000002';
const userId='00000000-0000-4000-8000-000000000003';
const riderIds=Array.from({length:8},(_,index)=>
  `00000000-0000-4000-8000-${String(index+10).padStart(12,'0')}`);
const secret='a-long-secret-that-is-kept-on-the-server-only-2026';
const environment={PELOTONIA_PHYSICAL_ENTRY_ENABLED:'true',
  PELOTONIA_PHYSICAL_ENTRY_EVENT_ID:eventId,
  PELOTONIA_AGENT_ENTRY_SIGNING_KEY:secret};

function body(){return {version:'physical-entry-request-v1',
  event_id:eventId,team_id:teamId,
  selected_riders:[...riderIds],captain_id:riderIds[0],
  orders:{version:2,captainId:riderIds[0],
    roadCaptainId:riderIds[1],helperIds:riderIds.slice(2),
    baseline:{effort:'steady',attack:'none',chase:'selective',
      frontWork:'rotate',frontWorkRiderId:riderIds[2]}},
  stake:{sportingGoal:'sprint_finish',
    sportingCaptainId:riderIds[0]}};}

function fixture({tag='winter-2026',lineup=riderIds}={}){
  const tables={teams:{id:teamId,user_id:userId,name:'Agent club'},
    event_teams:{selected_riders:lineup,captain_id:riderIds[0]},
    events:{stage_profile_id:'stage-id'},
    club_identities:null,
    stage_profiles:{distance_km:120,keypoints:[]}};
  const calls=[];
  const db={from(name){return {select(){return this;},eq(){return this;},
    async maybeSingle(){return {data:tables[name],error:null};}};},
  auth:{admin:{async getUserById(id){assert.equal(id,userId);
    return {data:{user:{id:userId,
      app_metadata:{pelotonia_agent:tag}}},error:null};}}}};
  const rpc=async(dbArg,name,args)=>{
    assert.equal(dbArg,db);calls.push({name,args});
    return {ok:true,team_id:teamId};};
  return {db,rpc,calls};
}

test('tokens are scoped to the exact event and team',()=>{
  const token=agentPhysicalEntryTokenV1(secret,eventId,teamId);
  assert.doesNotThrow(()=>assertAgentPhysicalEntryTokenV1(
    `Bearer ${token}`,secret,eventId,teamId));
  for(const [event,team] of [[eventId,otherTeam],
    ['00000000-0000-4000-8000-000000000004',teamId]])
    assert.throws(()=>assertAgentPhysicalEntryTokenV1(
      `Bearer ${token}`,secret,event,team),{status:401});
  assert.throws(()=>assertAgentPhysicalEntryTokenV1(
    `Bearer ${token}`,'short',eventId,teamId),{status:503});
});

test('tagged agent submits its own existing lineup and explicit orders',
  async()=>{
    const {db,rpc,calls}=fixture();
    const result=await submitAgentPhysicalEntryV1({body:body(),
      authorization:`Bearer ${agentPhysicalEntryTokenV1(
        secret,eventId,teamId)}`,environment,db,rpc});
    assert.equal(result.team_id,teamId);
    assert.equal(calls.length,1);
    assert.equal(calls[0].name,
      'recovery_join_agent_event_physical_v1');
    assert.equal(calls[0].args.p_user,userId);
    assert.equal(calls[0].args.p_event,eventId);
    assert.deepEqual(calls[0].args.p_riders,riderIds);
    assert.equal(calls[0].args.p_orders.baseline.effort,'steady');
  });

test('foreign, untagged, changed lineup and missing tactics never write',
  async()=>{
    const token=`Bearer ${agentPhysicalEntryTokenV1(
      secret,eventId,teamId)}`;
    const attempts=[
      {change:input=>{input.team_id=otherTeam;},expected:401},
      {fixtureOptions:{tag:'other'},expected:403},
      {fixtureOptions:{lineup:riderIds.slice().reverse()},
        expected:403},
      {change:input=>{delete input.orders.baseline.chase;},
        expected:400},
      {change:input=>{input.event_id=otherTeam;},
        expected:404},
    ];
    for(const attempt of attempts){
      const input=body(),{db,rpc,calls}=fixture(
        attempt.fixtureOptions);
      attempt.change?.(input);
      await assert.rejects(()=>submitAgentPhysicalEntryV1({
        body:input,authorization:token,environment,db,rpc}),
      {status:attempt.expected});
      assert.equal(calls.length,0);
    }
  });
