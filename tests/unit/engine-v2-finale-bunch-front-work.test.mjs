import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {finaleSnapshotFromTour} from
  '../../lib/engine/v2/finale-snapshot.mjs';
import {finaleDistanceGrid} from '../../lib/engine/v2/finale-grid.mjs';
import {advanceFinaleDroppedStep,
  FINALE_FRONT_DROP_CONTACT_STEP_VERSION,
  FINALE_OPTIONAL_FRONT_DROP_CONTACT_STEP_VERSION} from
  '../../lib/engine/v2/finale-dropped-step.mjs';
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
  FINALE_COAST_DROPPED_LAST_KM_VERSION,
  FINALE_COAST_NO_FRONT_PAID_BUNCH_VERSION,
  FINALE_COAST_ONE_FRONT_PAID_BUNCH_VERSION,
  FINALE_COAST_UNAVAILABLE_FRONT_CATCH_VERSION,
  FINALE_COAST_TWO_FRONT_PAID_BUNCH_VERSION,
  FINALE_COAST_THREE_FRONT_PAID_BUNCH_VERSION} from
  '../../lib/engine/v2/finale-multi-run.mjs';
import {recordFinaleCoastNoFrontPaidBunchClock,
  validateFinaleCoastNoFrontPaidBunchClock,
  recordFinaleCoastOneFrontPaidBunchClock,
  validateFinaleCoastOneFrontPaidBunchClock,
  recordFinaleCoastTwoFrontPaidBunchClock,
  validateFinaleCoastTwoFrontPaidBunchClock,
  recordFinaleCoastUnavailableFrontCatchClock,
  validateFinaleCoastUnavailableFrontCatchClock,
  recordFinaleCoastThreeFrontPaidBunchClock,
  validateFinaleCoastThreeFrontPaidBunchClock} from
  '../../lib/engine/v2/finale-separated-last-km.mjs';

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

test('opt-in one-front finale pays named bunch workers and refuses forged work',()=>{
  const seed='guided-finish-coverage-1',terrain='rolling',fatigue=0;
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
  assert.equal(finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true}).roadGroups.length,1);
  assert.throws(()=>probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_DROPPED_LAST_KM_VERSION}),
  /needs recorded response or front rotation/);
  assert.throws(()=>probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_NO_FRONT_PAID_BUNCH_VERSION}),
  /needs a bunch and dropped rider only/);
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_ONE_FRONT_PAID_BUNCH_VERSION});
  assert.throws(()=>probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_UNAVAILABLE_FRONT_CATCH_VERSION}),
  /has payable bunch-front work/);
  assert.equal(validateFinaleSeparatedGroupsFromTour(tour,trace),true);
  const clock=recordFinaleCoastOneFrontPaidBunchClock(tour);
  assert.equal(validateFinaleCoastOneFrontPaidBunchClock(tour,clock),true);
  assert.equal(clock.canCommitAwards,false);
  assert.equal(clock.pointsStatus,'withheld');
  assert.equal(clock.line.bands.at(-1).lastPossiblePlace,160);
  assert.equal(trace.frames.length,7);
  assert(trace.frames.every(frame=>frame.bunchFrontWork?.teamId==='you'&&
    frame.bunchFrontWork.riderIds.includes('you-5')));
  assert(trace.frames.some(frame=>frame.bunchPullRiderId));
  for(const frame of trace.frames)
    for(const worker of frame.bunchFrontWork.workers){
      const paid=frame.riders.find(row=>row.riderId===worker.riderId);
      assert.equal(paid.role,'pull');
      assert(Math.abs(paid.energySpent-worker.energySpent)<1e-8);
    }
  const forged=structuredClone(trace);
  forged.frames[0].bunchFrontWork.riderIds[0]='you-0';
  assert.throws(()=>validateFinaleSeparatedGroupsFromTour(tour,forged),
    /differs from its locked tour and work/);
  const forgedClock=structuredClone(clock);
  forgedClock.trace.frames[0].bunchFrontWork.riderIds[0]='you-0';
  assert.throws(()=>validateFinaleCoastOneFrontPaidBunchClock(tour,
    forgedClock),/paid one-front bunch clock does not replay/);
});

test('unavailable named front records only the actually paid catch',()=>{
  const seed='guided-finish-coverage-2',terrain='mountain',fatigue=0;
  const prepared=prepareV91Playtest({distanceKm:260,terrain:'custom',
    profileHeightsM:generatePlaytestStageProfile({distanceKm:260,
      style:terrain,seed}),teamCount:20,fatigue,attack:'none',
    chase:'selective',seed,managerTactics:resolveRandomRivalTactics({
      teamCount:20,random:seededRandom(`${seed}:${terrain}:${fatigue}`)}),
    managerTacticalOrdersV8:[{teamId:'you',atKm:5,
      attack:'selective',attackRiderId:'you-2',
      chaseTarget:'rival-1-2',frontWork:'rotate',
      frontWorkRiderId:'you-5',effort:'hard'},
    {teamId:'you',atKm:25,attack:'none'}]});
  const tour=simulateTacticalTour({...prepared,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  assert.equal(validateRecordedTour(tour),true);
  assert.throws(()=>probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_ONE_FRONT_PAID_BUNCH_VERSION}),
  /needs a recorded catch/);
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_UNAVAILABLE_FRONT_CATCH_VERSION});
  assert.equal(validateFinaleSeparatedGroupsFromTour(tour,trace),true);
  assert(trace.frames.every(frame=>frame.bunchFrontWork===null));
  assert(trace.frames.some(frame=>frame.bunchPullRiderId));
  const clock=recordFinaleCoastUnavailableFrontCatchClock(tour);
  assert.equal(validateFinaleCoastUnavailableFrontCatchClock(tour,clock),true);
  assert.equal(clock.contact.kind,'front_catch');
  assert.deepEqual(clock.line.bands.map(band=>band.kind),
    ['unresolved_contact']);
  assert.equal(clock.line.bands[0].lastPossiblePlace,160);
  assert.equal(clock.canCommitAwards,false);
  const forged=structuredClone(trace);
  forged.frames[0].bunchFrontWork={teamId:'you'};
  assert.throws(()=>validateFinaleSeparatedGroupsFromTour(tour,forged),
    /differs from its locked tour and work/);
  const forgedClock=structuredClone(clock);
  forgedClock.contact.atDistanceM+=1;
  assert.throws(()=>validateFinaleCoastUnavailableFrontCatchClock(tour,
    forgedClock),/unavailable-front catch clock does not replay/);
});

test('late unavailable-front catch remains provisional',()=>{
  const seed='guided-finish-coverage-8',terrain='mountain',fatigue=0;
  const prepared=prepareV91Playtest({distanceKm:260,terrain:'custom',
    profileHeightsM:generatePlaytestStageProfile({distanceKm:260,
      style:terrain,seed}),teamCount:20,fatigue,attack:'none',
    chase:'selective',seed,managerTactics:resolveRandomRivalTactics({
      teamCount:20,random:seededRandom(`${seed}:${terrain}:${fatigue}`)}),
    managerTacticalOrdersV8:[{teamId:'you',atKm:5,
      attack:'selective',attackRiderId:'you-2',
      chaseTarget:'rival-1-2',frontWork:'rotate',
      frontWorkRiderId:'you-5',effort:'hard'},
    {teamId:'you',atKm:25,attack:'none'}]});
  const tour=simulateTacticalTour({...prepared,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  assert.equal(validateRecordedTour(tour),true);
  const clock=recordFinaleCoastUnavailableFrontCatchClock(tour);
  assert.equal(validateFinaleCoastUnavailableFrontCatchClock(tour,clock),true);
  assert(clock.contact.atDistanceM>259500);
  assert.equal(clock.line.bands.length,1);
  assert.equal(clock.classifiedResults,null);
  assert.equal(clock.pointsStatus,'withheld');
});

test('three-front front-order continuation preserves all source groups',()=>{
  const seed='guided-finish-coverage-3',terrain='rolling',fatigue=0;
  const prepared=prepareV91Playtest({distanceKm:260,terrain:'custom',
    profileHeightsM:generatePlaytestStageProfile({distanceKm:260,
      style:terrain,seed}),teamCount:20,fatigue,attack:'none',
    chase:'selective',seed,managerTactics:resolveRandomRivalTactics({
      teamCount:20,random:seededRandom(`${seed}:${terrain}:${fatigue}`)}),
    managerTacticalOrdersV8:[{teamId:'you',atKm:5,
      attack:'selective',attackRiderId:'you-2',
      chaseTarget:'rival-1-2',frontWork:'rotate',
      frontWorkRiderId:'you-5',effort:'hard'},
    {teamId:'you',atKm:25,attack:'none'}]});
  const tour=simulateTacticalTour({...prepared,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  assert.equal(validateRecordedTour(tour),true);
  assert.equal(finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true}).roadGroups.length,3);
  assert.throws(()=>probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_TWO_FRONT_PAID_BUNCH_VERSION}),
  /needs exactly two leading groups/);
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_THREE_FRONT_PAID_BUNCH_VERSION});
  assert.equal(trace.frames.filter(frame=>frame.bunchFrontWork).length,0);
  assert.equal(validateFinaleSeparatedGroupsFromTour(tour,trace),true);
  const clock=recordFinaleCoastThreeFrontPaidBunchClock(tour);
  assert.equal(validateFinaleCoastThreeFrontPaidBunchClock(tour,clock),true);
  assert.deepEqual(clock.line.bands.map(band=>band.kind),
    ['road_group','road_group','road_group','peloton',
      'unresolved_dropped']);
  assert.equal(clock.line.bands.at(-1).lastPossiblePlace,160);
  assert.equal(clock.canCommitAwards,false);
  const forged=structuredClone(clock);
  forged.trace.frames[0].bunchFrontWork={teamId:'you'};
  assert.throws(()=>validateFinaleCoastThreeFrontPaidBunchClock(tour,
    forged),/paid three-front bunch clock does not replay/);
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
  const clock=recordFinaleCoastNoFrontPaidBunchClock(tour);
  assert.equal(validateFinaleCoastNoFrontPaidBunchClock(tour,clock),true);
  assert.deepEqual(clock.line.bands.map(band=>band.kind),
    ['peloton','unresolved_dropped']);
  assert.equal(clock.pointsStatus,'withheld');
  assert.equal(clock.canCommitAwards,false);
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
  const forgedClock=structuredClone(clock);
  forgedClock.trace.frames[0].bunchFrontWork.riderIds[0]='you-0';
  assert.throws(()=>validateFinaleCoastNoFrontPaidBunchClock(tour,
    forgedClock),/paid no-front bunch clock does not replay/);
});

test('paid front versions keep source group counts separate',()=>{
  for(const {index,fatigue,groups,dropped} of [
    {index:3,fatigue:0,groups:2,dropped:36},
    {index:11,fatigue:30,groups:1,dropped:0}]){
    const seed=`guided-finish-coverage-${index}`,terrain='rolling';
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
    const snapshot=finaleSnapshotFromTour(tour,{remainingKm:1,
      includeAttackLoad:true});
    assert.equal(snapshot.roadGroups.length,groups);
    assert.equal(snapshot.droppedRiderIds.length,dropped);
    if(groups!==1){
      assert.throws(()=>probeFinaleSeparatedGroupsFromTour(tour,{
        version:FINALE_COAST_ONE_FRONT_PAID_BUNCH_VERSION}),
      /needs exactly one leading group/);
      const clock=recordFinaleCoastTwoFrontPaidBunchClock(tour);
      assert.equal(validateFinaleCoastTwoFrontPaidBunchClock(tour,clock),
        true);
      assert.deepEqual(clock.line.bands.map(band=>band.kind),
        ['road_group','road_group','peloton','unresolved_dropped']);
      assert.equal(clock.canCommitAwards,false);
      assert.equal(clock.line.bands.at(-1).lastPossiblePlace,160);
      const forged=structuredClone(clock);
      forged.trace.frames[0].bunchFrontWork.riderIds[0]='you-0';
      assert.throws(()=>validateFinaleCoastTwoFrontPaidBunchClock(tour,
        forged),/paid two-front bunch clock does not replay/);
    }else{
      const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[0];
      const droppedInput={slice,
        segment:tour.route.kilometres[slice.sourceKm-1],
        bunchElapsedSeconds:20,droppedRiders:[],
        ridersById:new Map(tour.committedInputs.teams.flatMap(team=>
          team.riders.map(rider=>[rider.id,rider])))};
      assert.throws(()=>advanceFinaleDroppedStep({...droppedInput,
        version:FINALE_FRONT_DROP_CONTACT_STEP_VERSION}),
      /needs complete source riders and bunch travel/);
      assert.deepEqual(advanceFinaleDroppedStep({...droppedInput,
        version:FINALE_OPTIONAL_FRONT_DROP_CONTACT_STEP_VERSION}).riders,[]);
      const clock=recordFinaleCoastOneFrontPaidBunchClock(tour);
      assert.equal(validateFinaleCoastOneFrontPaidBunchClock(tour,clock),
        true);
      assert.deepEqual(clock.line.bands.map(band=>band.kind),
        ['road_group','peloton']);
      assert.equal(clock.line.bands.at(-1).lastPossiblePlace,160);
      assert.equal(clock.canCommitAwards,false);
    }
  }
});
