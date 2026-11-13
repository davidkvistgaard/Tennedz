import test from 'node:test';
import assert from 'node:assert/strict';
import {nextTeamRace} from '../../lib/calendar/next-race.mjs';

const start=Date.parse('2026-11-15T18:00:00Z');
const race={id:'sunday',kind:'one_day',gender:'M',status:'OPEN',
  deadline:'2026-11-15T17:00:00Z',
  scheduled_at:'2026-11-15T18:00:00Z'};

test('next race remains visible after its orders lock and recording finishes',()=>{
  assert.equal(nextTeamRace([race],'M',start-30_000)?.id,'sunday');
  assert.equal(nextTeamRace([{...race,status:'FINISHED'}],
    'M',start-30_000)?.id,'sunday');
  assert.equal(nextTeamRace([{...race,status:'FINISHED'}],
    'M',start+1),null);
  assert.equal(nextTeamRace([race],'F',start-30_000),null);
});
