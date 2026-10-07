import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';
import {validateFinaleGroupToLine} from '../../lib/engine/v2/finale-group-run.mjs';
import {probeFinaleOrderedGroupToLineFromTour,
  validateFinaleOrderedGroupToLineFromTour} from
  '../../lib/engine/v2/finale-ordered-run.mjs';

const stage={distance_km:40,profile_points:[[0,100],[40,100]]};
function team(id,attack,gender='M'){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:60,strength:60,endurance:60,
    timetrial:attack&&index===2?85:60,sprint:50,leadership:50,
  })),orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    preset:attack?'aggressive':'protect',
    baseline:{attack:'none',chase:attack?'ignore':'selective',
      breakWork:'cooperate'},
    phases:attack?[{atKm:30,attack:'selective',
      attackRiderId:`${id}-2`}]:[]}};
}
function source(orders={},gender='M'){
  const teams=['a','b','c','d'].map(id=>
    team(id,id==='a'||id==='b',gender));
  for(const [id,phase] of Object.entries(orders))
    teams.find(team=>team.id===id).orders.phases.push(phase);
  return simulateTacticalTour({stage,teams,seed:'ordered-finale',
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
}

test('locked independent teams supply recorded short-step pulls',()=>{
  for(const gender of ['M','F']){
    const tour=source({},gender);
    const original=structuredClone(tour);
    const probe=probeFinaleOrderedGroupToLineFromTour(tour);
    assert.equal(probe.version,'v2-finale-ordered-run-1');
    assert.equal(probe.sourceTuningVersion,MOTOR_ATTACK_TRACE_VERSION);
    assert.equal(probe.schedule.frontPullRiderIds.length,11);
    assert.equal(probe.schedule.chasePullRiderIds.length,11);
    assert.deepEqual(probe.schedule.frontPullRiderIds.slice(0,4),
      ['a-2','b-2','a-2','b-2']);
    assert.deepEqual(probe.schedule.chasePullRiderIds.slice(0,4)
      .map(id=>id.split('-')[0]),['c','d','c','d']);
    assert.equal(probe.recording.version,'v2-finale-group-to-line-5');
    assert.equal(validateFinaleGroupToLine(probe.input,probe.recording),true);
    assert.equal(validateFinaleOrderedGroupToLineFromTour(tour,probe),true);
    const forged=structuredClone(probe);
    forged.schedule.frontPullRiderIds[1]='a-2';
    assert.throws(()=>validateFinaleOrderedGroupToLineFromTour(tour,forged),
      /differs/);
    assert.deepEqual(tour,original);
  }
});

test('a final-phase sit-on or ignored chase cannot nominate unpaid work',()=>{
  const oneSitter=probeFinaleOrderedGroupToLineFromTour(source({
    a:{atKm:35,breakWork:'sit_on'}}));
  assert.ok(oneSitter.schedule.frontPullRiderIds.every(id=>id==='b-2'));
  const oneIgnore=probeFinaleOrderedGroupToLineFromTour(source({
    c:{atKm:35,chase:'ignore'}}));
  assert.ok(oneIgnore.schedule.chasePullRiderIds.every(id=>
    id.startsWith('d-')));
  const sitOn=source({a:{atKm:35,breakWork:'sit_on'},
    b:{atKm:35,breakWork:'sit_on'}});
  assert.throws(()=>probeFinaleOrderedGroupToLineFromTour(sitOn),
    /no eligible finale puller/);
  const noChase=source({c:{atKm:35,chase:'ignore'},
    d:{atKm:35,chase:'ignore'}});
  assert.throws(()=>probeFinaleOrderedGroupToLineFromTour(noChase),
    /no eligible finale puller/);
});

test('a long recorded race supplies depleted workers without free finale energy',()=>{
  const teams=['a','b','c','d'].map(id=>team(id,id==='a'||id==='b'));
  for(const candidate of teams){
    candidate.orders.baseline.effort='conserve';
    candidate.orders.baseline.chase='ignore';
    candidate.orders.phases=candidate.id==='a'||candidate.id==='b'?
      [{atKm:240,attack:'selective',attackRiderId:`${candidate.id}-2`,
        effort:'hard',breakWork:'drive'}]:
      [{atKm:250,chase:'all',effort:'steady'}];
  }
  const tour=simulateTacticalTour({stage:{distance_km:260,
    profile_points:[[0,100],[260,100]]},teams,seed:'long-ordered-finale',
  motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const probe=probeFinaleOrderedGroupToLineFromTour(tour);
  assert.equal(probe.input.snapshot.sourceKm,255);
  assert.equal(probe.recording.endDistanceM,260000);
  for(const row of probe.recording.finalRiderEnergy){
    const atFive=probe.input.snapshot.riders.find(candidate=>
      candidate.riderId===row.riderId);
    assert.ok(row.energy<=atFive.energy);
  }
  assert.equal(validateFinaleOrderedGroupToLineFromTour(tour,probe),true);
  const waiting=structuredClone(teams);
  for(const candidate of waiting.filter(team=>team.id==='c'||team.id==='d'))
    candidate.orders.phases[0].chase='selective';
  const waitingTour=simulateTacticalTour({stage:{distance_km:260,
    profile_points:[[0,100],[260,100]]},teams:waiting,
  seed:'long-ordered-finale',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  assert.deepEqual(waitingTour.frames[254].engagedChaseTeamIds,[]);
  assert.throws(()=>probeFinaleOrderedGroupToLineFromTour(waitingTour),
    /no eligible finale puller: chase/);
});
