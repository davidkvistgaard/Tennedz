import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,V93_COAST_TAIL_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {FINALE_COASTED_TAIL_BAND_RUNNER_VERSION} from
  '../../lib/engine/v2/finale-paid-bunch-runner.mjs';
import {MOTOR_EXHAUSTION_COAST} from '../../lib/engine/v2/tuning.mjs';

const tactics=[
  {effort:'hard',attack:'none',chase:'all'},
  {effort:'steady',attack:'selective',chase:'ignore'},
  {effort:'conserve',attack:'none',chase:'selective'},
  {effort:'steady',attack:'repeated',chase:'selective'}];
const settings={distanceKm:260,teamCount:20,gender:'M',
  terrain:'exposed',fatigue:0,seed:'v93-broader-probe-83',
  defaultRivalPlan:'passive',effort:'hard',attack:'repeated',
  chase:'ignore',managerTactics:Array.from({length:19},(_,index)=>
    tactics[(index+83)%4])};
const input={pointContext:{tier:3,divisionCount:4,divisionIndex:2}};

test('an exhausted nominated rider coasts through a paid individual tail',()=>{
  const race=createV93PlayableTest(settings,input);
  assert.equal(race.version,V93_COAST_TAIL_PLAYTEST_VERSION);
  assert.equal(validateV93CoastedPlaytest(settings,input,race),true);
  const summary=summarizeV93CoastedPlaytest(race);
  assert.equal(summary.lineTimes.length,160);
  assert.equal(summary.lastKmRoad.at(-1).distanceM,260000);
  assert.equal(summary.pointPreview.status,'unavailable');
  assert.equal(summary.pointsStatus,'withheld');
  assert.equal(summary.canCommitAwards,false);
  assert.deepEqual(summary.exhaustedTail.map(row=>row.riderId),['you-7']);
  const band=race.individualLine.bandRunners.find(row=>
    row.roadBandId==='peloton');
  assert.equal(band.runner.version,FINALE_COASTED_TAIL_BAND_RUNNER_VERSION);
  const tail=band.runner.frames.at(-1).riders.find(row=>
    row.riderId==='you-7');
  const crossing=summary.lineTimes.find(row=>row.riderId==='you-7');
  assert.equal(tail.role,'exhausted_coast');
  assert.ok(tail.positionBeforeM>259900&&tail.positionBeforeM<260000);
  assert.equal(tail.positionM,260000);
  assert.equal(tail.energySpent,tail.energyAtDecision);
  assert.equal(tail.energyAfter,0);
  assert.ok(tail.curtailedEnergyDemand>0);
  assert.ok(Math.abs(tail.energyDemand-tail.energySpent-
    tail.curtailedEnergyDemand)<1e-9);
  assert.ok(Math.abs(tail.sustainableFraction-(1-
    MOTOR_EXHAUSTION_COAST.maxSpeedLoss*
      tail.curtailedEnergyDemand/tail.energyDemand))<1e-9);
  assert.equal(tail.elapsedToLineSeconds,
    crossing.elapsedSecondsFromLastKmStart);
  assert.equal(crossing.energyAtLine,0);
  const replayed=summary.bandReplays.flatMap(row=>
    row.frames.at(-1).riders.map(rider=>rider.riderId));
  assert.equal(new Set(replayed).size,160);
});
