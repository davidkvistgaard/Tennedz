import test from 'node:test';
import assert from 'node:assert/strict';
import {commitMissingDefaultPhysicalEntriesV1} from
  '../../lib/race/default-physical-runner-v1.mjs';

const teamId='22222222-2222-4222-8222-222222222222';
const eventId='11111111-1111-4111-8111-111111111111';
const ids=Array.from({length:8},(_,index)=>
  `44444444-4444-4444-8444-${String(index+1).padStart(12,'0')}`);
const riders=ids.map((id,index)=>({id,gender:'M',
  flat:70+index,sprint:70+index,hills:70,
  mountain:70,cobbles:70,endurance:70,
  leadership:70,form:70,fatigue:10,injury_until:null}));
const snapshot={event:{id:eventId,gender:'M',
  deadline:'2026-11-15T18:00:00Z'},
stage:{distance_km:180,tags:['FLAT'],keypoints:[]},
game_date:'2026-02-19',teams:[{id:teamId,name:'Test team',
  entry:{selected_riders:ids,captain_id:ids[0]},riders}]};

function fixture(existing=[]){
  const db={from(name){
    const query={select(){return this;},eq(){return this;},
      in(){return this;},lte(){return this;},
      then(resolve){return Promise.resolve({data:name===
        'recovery_physical_entry_inputs'?existing:[],
      error:null}).then(resolve);}};
    return query;}};
  const calls=[];
  const rpc=async(_db,name,args)=>{
    calls.push({name,args});return {ok:true,
      default_entries_committed:1};};
  return {db,rpc,calls};
}

test('prepares a missing tactic from the entered lineup and commits it once',async()=>{
  const {db,rpc,calls}=fixture();
  await commitMissingDefaultPhysicalEntriesV1({db,rpc,snapshot});
  assert.equal(calls.length,1);
  assert.equal(calls[0].name,
    'recovery_commit_default_physical_entries_v1');
  const item=calls[0].args.p_defaults[0];
  assert.equal(item.teamId,teamId);
  assert.deepEqual(item.selectedRiders,ids);
  assert.equal(item.lineupSource,'entered');
  assert.equal(item.tacticsSource,'game_ai');
  assert.equal(item.orders.baseline.attack,'none');
  assert.equal(item.teamStyle.id,teamId);
});

test('keeps every existing manager entry without a default write',async()=>{
  const {db,rpc,calls}=fixture([{team_id:teamId}]);
  const result=await commitMissingDefaultPhysicalEntriesV1({
    db,rpc,snapshot});
  assert.equal(result.default_entries_committed,0);
  assert.equal(calls.length,0);
});
