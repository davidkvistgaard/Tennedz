import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91ConditionalRaceFinal} from
  '../../lib/engine/v2/playtest-race-final.mjs';
import {validateFinaleGroupResultBounds} from
  '../../lib/engine/v2/finale-group-result-bounds.mjs';
import {projectV2ConditionalGroupPointBounds,
  validateV2ConditionalGroupPointBounds} from
  '../../lib/race/v2-conditional-group-point-bounds.mjs';
import {POINT_POLICY_VERSION} from '../../lib/calendar/points.mjs';

const input={distanceKm:40,terrain:'flat',fatigue:0,gender:'M',
  teamCount:4,seed:'conditional-coverage-1',
  defaultRivalPlan:'attack',attack:'repeated',chase:'ignore'};
const context={tier:3,divisionIndex:1,divisionCount:3};

test('a surviving group bounds places and policy points without awards',()=>{
  const trial=createV91ConditionalRaceFinal(input);
  const bounds=trial.roadPlaceBounds;
  const front=bounds.riders.filter(row=>row.roadBand==='front');
  const bunch=bounds.riders.filter(row=>row.roadBand==='bunch');
  assert.equal(bounds.version,'v2-finale-group-result-bounds-1');
  assert.equal(bounds.outcome,'survived');
  assert.ok(front.length>1);
  assert.equal(front.length+bunch.length,32);
  assert.ok(front.every(row=>row.firstPossiblePlace===1&&
    row.lastPossiblePlace===front.length));
  assert.ok(bunch.every(row=>row.firstPossiblePlace===front.length+1&&
    row.lastPossiblePlace===32));
  assert.equal(validateFinaleGroupResultBounds(trial.recording,
    trial.paidFinale,bounds),true);
  const forgedBounds=structuredClone(bounds);
  forgedBounds.riders[0].firstPossiblePlace=2;
  assert.throws(()=>validateFinaleGroupResultBounds(trial.recording,
    trial.paidFinale,forgedBounds),/do not replay/);
  const points=projectV2ConditionalGroupPointBounds(trial.recording,
    trial.paidFinale,context);
  assert.equal(points.pointsPolicyVersion,POINT_POLICY_VERSION);
  assert.equal(points.riders.length,32);
  assert.equal(points.riders.find(row=>row.roadBand==='front')
    .maxPossiblePoints,250);
  assert.ok(points.riders.every(row=>row.minPossiblePoints<=
    row.maxPossiblePoints));
  assert.deepEqual(points.awardRows,[]);
  assert.equal(points.pointsStatus,'withheld');
  assert.equal(points.canCommitAwards,false);
  assert.equal(validateV2ConditionalGroupPointBounds(trial.recording,
    trial.paidFinale,context,points),true);
  const laterDivision=projectV2ConditionalGroupPointBounds(
    trial.recording,trial.paidFinale,{...context,divisionIndex:3});
  assert.ok(laterDivision.riders.find(row=>row.roadBand==='front')
    .maxPossiblePoints<250);
  assert.deepEqual(laterDivision.awardRows,[]);
  const forgedPoints=structuredClone(points);
  forgedPoints.riders[0].maxPossiblePoints++;
  assert.throws(()=>validateV2ConditionalGroupPointBounds(
    trial.recording,trial.paidFinale,context,forgedPoints),
  /do not replay/);
  const altered=structuredClone(trial.paidFinale);
  altered.frontLineTime+=10;
  assert.throws(()=>projectV2ConditionalGroupPointBounds(trial.recording,
    altered,context),/does not replay/);
});

test('a recorded all-out chase keeps place and point bounds tied to paid work',()=>{
  const settings={...input,managerTactics:[
    {effort:'steady',attack:'none',chase:'all'}]};
  const trial=createV91ConditionalRaceFinal(settings);
  const chasePullRiderId=trial.paidFinale.line.chasePullRiderId;
  assert.equal(trial.roadPlaceBounds.version,
    'v2-finale-group-result-bounds-2');
  assert.equal(validateFinaleGroupResultBounds(trial.recording,
    trial.paidFinale,trial.roadPlaceBounds,{chasePullRiderId}),true);
  assert.throws(()=>validateFinaleGroupResultBounds(trial.recording,
    trial.paidFinale,trial.roadPlaceBounds),/does not replay/);
  const pointInput={...context,chasePullRiderId};
  const points=projectV2ConditionalGroupPointBounds(trial.recording,
    trial.paidFinale,pointInput);
  assert.equal(points.version,'v2-conditional-group-point-bounds-2');
  assert.equal(points.sourceBoundsVersion,
    'v2-finale-group-result-bounds-2');
  assert.deepEqual(points.awardRows,[]);
  assert.equal(points.pointsStatus,'withheld');
  assert.equal(validateV2ConditionalGroupPointBounds(trial.recording,
    trial.paidFinale,pointInput,points),true);
  const altered=structuredClone(trial.paidFinale);
  altered.bunchLineTime++;
  assert.throws(()=>projectV2ConditionalGroupPointBounds(trial.recording,
    altered,pointInput),/does not replay/);
});
