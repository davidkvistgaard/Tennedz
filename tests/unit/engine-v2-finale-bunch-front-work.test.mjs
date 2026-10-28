import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {finaleSnapshotFromTour} from
  '../../lib/engine/v2/finale-snapshot.mjs';
import {planFinaleBunchFrontWork} from
  '../../lib/engine/v2/finale-bunch-front-work.mjs';
import {generatePlaytestStageProfile} from
  '../../lib/engine/v2/playtest-stage-generator.mjs';
import {resolveRandomRivalTactics} from
  '../../lib/engine/v2/playtest-rival-random.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  validateFinaleSeparatedGroupsFromTour,
  FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_VERSION,
  FINALE_COAST_NO_FRONT_PAID_BUNCH_VERSION} from
  '../../lib/engine/v2/finale-multi-run.mjs';

function seededRandom(label){
  let state=2166136261;
  for(const character of label)
    state=Math.imul(state^character.charCodeAt(0),16777619)>>>0;
  return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
}

test('candidate final-kilometre front pair pays a named worker without substitution',()=>{
  const prepared=prepareV91Playtest({distanceKm:40,terrain:'flat',
    teamCount:4,attack:'none',chase:'ignore',seed:'named-final-front',
    defaultRivalPlan:'passive',managerTacticalOrdersV8:[
      {teamId:'you',atKm:5,frontWork:'rotate',
        frontWorkRiderId:'you-5'}]});
  const tour=simulateTacticalTour({...prepared,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  const snapshot=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  const energies=new Map(snapshot.riders.map(row=>[row.riderId,row.energy]));
  const input={teams:tour.committedInputs.teams,
    pelotonRiderIds:snapshot.peloton.riderIds,energies,
    segment:tour.route.kilometres[39],sourceKm:40,sliceLengthKm:.25};
  const plan=planFinaleBunchFrontWork(input);
  assert.equal(plan.teamId,'you');
  assert.equal(plan.riderIds.length,2);
  assert(plan.riderIds.includes('you-5'));
  assert(plan.workers.every(row=>row.energySpent>0&&
    row.energySpent<row.energyBefore));
  assert(plan.speedKph>0);
  energies.set('you-5',0);
  assert.equal(planFinaleBunchFrontWork(input),null);
});

test('opt-in no-front finale pays named front pair and replays the source',()=>{
  const seed='guided-finish-coverage-1',terrain='rolling',fatigue=30;
  const prepared=prepareV91Playtest({distanceKm:260,terrain:'custom',
    profileHeightsM:generatePlaytestStageProfile({distanceKm:260,
      style:terrain,seed}),teamCount:20,fatigue,attack:'none',
    chase:'selective',seed,managerTactics:resolveRandomRivalTactics({
      teamCount:20,random:seededRandom(`${seed}:${terrain}:${fatigue}`)}),
    managerTacticalOrdersV8:[{teamId:'you',atKm:5,
      attack:'selective',attackRiderId:'you-2',
      chaseTarget:'rival-1-2',frontWork:'rotate',
      frontWorkRiderId:'you-5'},
    {teamId:'you',atKm:25,attack:'none'}]});
  const tour=simulateTacticalTour({...prepared,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  assert.equal(validateRecordedTour(tour),true);
  const source=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  assert.equal(source.roadGroups.length,0);
  assert(source.droppedRiderIds.length>0);
  assert.throws(()=>probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_VERSION}),
  /needs recorded response or front rotation/);
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_NO_FRONT_PAID_BUNCH_VERSION});
  assert.equal(validateFinaleSeparatedGroupsFromTour(tour,trace),true);
  assert.equal(trace.frames.length,7);
  assert(trace.frames.every(frame=>frame.bunchFrontWork?.teamId==='you'&&
    frame.bunchFrontWork.riderIds.includes('you-5')));
  const sourceEnergy=source.riders.find(row=>row.riderId==='you-5').energy;
  const finalEnergy=trace.finalRiderEnergy.find(row=>
    row.riderId==='you-5').energy;
  const spent=trace.frames.reduce((sum,frame)=>sum+
    frame.bunchFrontWork.workers.find(row=>
      row.riderId==='you-5').energySpent,0);
  assert(Math.abs(sourceEnergy-finalEnergy-spent)<1e-8);
  const forged=structuredClone(trace);
  forged.frames[0].bunchFrontWork.riderIds[0]='you-0';
  assert.throws(()=>validateFinaleSeparatedGroupsFromTour(tour,forged),
    /differs from its locked tour and work/);
});
