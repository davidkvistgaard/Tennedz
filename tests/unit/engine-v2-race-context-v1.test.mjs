import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRaceContext,projectedCatchKm,breakSituationForTeam} from
  '../../lib/engine/v2/race-context-v1.mjs';

test('race format is explicit and stage number cannot leak into a one-day race',()=>{
  assert.deepEqual(normalizeRaceContext({format:'one_day'}),{format:'one_day'});
  assert.deepEqual(normalizeRaceContext({format:'stage',stageNumber:12}),
    {format:'stage',stageNumber:12});
  assert.throws(()=>normalizeRaceContext({format:'stage'}),/Invalid race context/);
  assert.throws(()=>normalizeRaceContext({format:'one_day',stageNumber:1}),
    /Invalid race context/);
});

test('catch estimate is a consequence of paid relative road speed',()=>{
  assert.equal(projectedCatchKm({gapSeconds:300,remainingKm:60,
    frontSecondsPerKm:95,bunchSecondsPerKm:89}),50);
  assert.equal(projectedCatchKm({gapSeconds:300,remainingKm:40,
    frontSecondsPerKm:95,bunchSecondsPerKm:89}),null);
  assert.equal(projectedCatchKm({gapSeconds:300,remainingKm:60,
    frontSecondsPerKm:89,bunchSecondsPerKm:95}),null);
});

test('break composition records whose interests are affected without declaring a chase',()=>{
  const situation=breakSituationForTeam({teamId:'team-a',
    frontTeamIds:['team-a','team-c'],frontRiderIds:['a-2','c-7'],
    protectedLeaderIds:['c-7'],gcThreatRiderIds:['c-7']});
  assert.deepEqual(situation,{ownRiderAhead:true,protectedLeaderAhead:true,
    gcThreatAhead:true});
  assert.equal('contentWithComposition' in situation,false);
});
