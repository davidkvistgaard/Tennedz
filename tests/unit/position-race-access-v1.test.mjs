import test from 'node:test';
import assert from 'node:assert/strict';
import {requirePositionRaceParticipantV1} from
  '../../lib/race/position-race-access-v1.mjs';

const eventId='109a9235-44e6-d390-1fa9-aec19b65cf3b';
const teamId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const v8='physical-first-position-general-race-8';

function db({entry={team_id:teamId},
  event={status:'FINISHED',engine_version:v8},
  entryError=null,eventError=null}={}){
  return {from(table){
    let query={select(){return query;},eq(){return query;},
      async maybeSingle(){
        return table==='event_teams'?
          {data:entry,error:entryError}:
          {data:event,error:eventError};
      }};
    return query;
  }};
}

test('only a participant in a finished V8 race may read its recording',
  async()=>{
    assert.equal((await requirePositionRaceParticipantV1(
      db(),eventId,teamId)).engine_version,v8);
    await assert.rejects(()=>requirePositionRaceParticipantV1(
      db({entry:null}),eventId,teamId),
    error=>error.status===403);
    await assert.rejects(()=>requirePositionRaceParticipantV1(
      db({event:{status:'OPEN',engine_version:v8}}),
      eventId,teamId),error=>error.status===404);
    await assert.rejects(()=>requirePositionRaceParticipantV1(
      db({event:{status:'FINISHED',engine_version:'2.1'}}),
      eventId,teamId),error=>error.status===404);
    await assert.rejects(()=>requirePositionRaceParticipantV1(
      db({entryError:{message:'read failed'}}),eventId,teamId),
    error=>error.status===503);
  });
