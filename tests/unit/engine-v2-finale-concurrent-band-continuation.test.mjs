import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91Playtest} from
  '../../lib/engine/v2/playtest.mjs';
import {recordFinaleConcurrentLateCatchLineFromTour,
  validateFinaleConcurrentLateCatchLineFromTour} from
  '../../lib/engine/v2/finale-concurrent-late-catch-line.mjs';
import {recordFinaleConcurrentBandContinuationFromTour,
  validateFinaleConcurrentBandContinuationFromTour,
  recordFinaleConcurrentRearCatchContinuationFromTour,
  validateFinaleConcurrentRearCatchContinuationFromTour,
  recordFinaleConcurrentFullCatchContinuationFromTour,
  validateFinaleConcurrentFullCatchContinuationFromTour,
  concurrentBandNextEvent} from
  '../../lib/engine/v2/finale-concurrent-band-continuation.mjs';

test('road event kernel stops at exact contact before the next grid mark',()=>{
  const bands=[
    {kind:'front',positionM:39620,nextBoundaryM:39700,
      speedMps:10,finishedAt:null},
    {kind:'rear_attack',positionM:39610,nextBoundaryM:39700,
      speedMps:12,finishedAt:null},
    {kind:'bunch',positionM:39600,nextBoundaryM:39700,
      speedMps:10,finishedAt:null}];
  const next=concurrentBandNextEvent(bands);
  assert.equal(next.seconds,5);
  assert.equal(next.contact.ahead.kind,'front');
  assert.equal(next.contact.behind.kind,'rear_attack');
  assert.deepEqual(next.boundaries,[]);
  const noCatch=concurrentBandNextEvent(bands.map(row=>({...row,
    speedMps:10})));
  assert.equal(noCatch.contact,null);
  assert.equal(noCatch.seconds,8);
  assert.deepEqual(noCatch.boundaries.map(row=>row.band.kind),['front']);
  assert.throws(()=>concurrentBandNextEvent(bands.map(row=>({...row,
    positionM:39600}))),/ordered positive travel/);
});

function pairedTour(gender='M',teamCount=15,youAttackerSlot=5,
  rivalAttackerSlot=5){
  const ids=['you',...Array.from({length:teamCount-1},(_,index)=>
    `rival-${index+1}`)];
  const managerFinaleOrders=ids.map(teamId=>({teamId,
    attack:['you','rival-2'].includes(teamId)?'selective':'none',
    ...(['you','rival-2'].includes(teamId)?{
      attackRiderId:`${teamId}-${teamId==='you'?youAttackerSlot:
        rivalAttackerSlot}`}:{}),
    chase:['rival-1','rival-4'].includes(teamId)?'selective':'ignore',
    frontWork:teamId==='rival-3'?'rotate':'sit_in'}));
  return createV91Playtest({distanceKm:40,teamCount,gender,
    terrain:'flat',seed:'paired-final-orders',attack:'none',
    chase:'ignore',defaultRivalPlan:'neutral',managerFinaleOrders,
    teamOverrides:ids.map(teamId=>({teamId,
      level:teamId==='rival-2'?81:teamId==='you'?80:85}))})
    .recording;
}

test('three paid road bands continue on one clock to a finish or exact contact',()=>{
  for(const [gender,teamCount] of [['M',15],['F',15],['M',20]]){
    const tour=pairedTour(gender,teamCount);
    const line=recordFinaleConcurrentBandContinuationFromTour(tour);
    assert.equal(line.status,'band_crossings_only');
    assert.equal(line.contact,null);
    assert.deepEqual(line.bandCrossings.map(row=>row.kind),
      ['front','rear_attack','bunch']);
    assert.ok(line.bandCrossings[0].elapsedSinceLaunchSeconds<
      line.bandCrossings[1].elapsedSinceLaunchSeconds);
    assert.ok(line.bandCrossings[1].elapsedSinceLaunchSeconds<
      line.bandCrossings[2].elapsedSinceLaunchSeconds);
    assert.equal(line.resultStatus,'unclassified');
    assert.equal(line.pointsStatus,'withheld');
    assert.equal(line.canCommitAwards,false);
    assert.equal(line.finalRiders.length,teamCount*8);
    assert.equal(new Set(line.finalRiders.map(row=>row.riderId)).size,
      teamCount*8);
    assert.ok(line.frames.length>1);
    assert.ok(line.frames.every(frame=>frame.elapsedSincePreviousSeconds>0));
    assert.ok(line.frames.every(frame=>frame.riders.every(row=>
      row.distanceM>0&&row.energySpent>=0&&
      Math.abs(row.energyBefore-row.energySpent-
        row.energyAtEvent)<1e-8)));
    assert.ok(line.frames.every(frame=>frame.roadBands.every((band,index)=>
      index===0||frame.roadBands[index-1].positionM>
        band.positionM||frame.roadBands[index-1].positionM===40000&&
        band.positionM===40000)));
    assert.ok(line.finalRiders.every(row=>row.positionM===40000));
    assert.ok(line.frames.every((frame,index)=>index===0||
      frame.elapsedSinceLaunchSeconds>
        line.frames[index-1].elapsedSinceLaunchSeconds));
    const debit=new Map();
    const distance=new Map();
    for(const frame of line.frames)for(const row of frame.riders){
      debit.set(row.riderId,(debit.get(row.riderId)??0)+
        row.energySpent);
      distance.set(row.riderId,(distance.get(row.riderId)??0)+
        row.distanceM);
    }
    assert.ok(line.finalRiders.every(row=>
      Math.abs(row.energyAtSource-debit.get(row.riderId)-
        row.energyAtStop)<1e-8&&
      Math.abs(row.distanceTravelledM-distance.get(row.riderId))<1e-8));
    assert.equal(validateFinaleConcurrentBandContinuationFromTour(tour,
      line),true);
    const rearCatchVersion=
      recordFinaleConcurrentRearCatchContinuationFromTour(tour);
    assert.equal(rearCatchVersion.status,'band_crossings_only');
    assert.deepEqual(rearCatchVersion.contactEvents,[]);
    assert.deepEqual(rearCatchVersion.frames,line.frames);
    assert.deepEqual(rearCatchVersion.bandCrossings,line.bandCrossings);
    assert.equal(validateFinaleConcurrentRearCatchContinuationFromTour(
      tour,rearCatchVersion),true);
    const changed=structuredClone(line);
    changed.finalRiders[0].energyAtStop+=.01;
    assert.throws(()=>validateFinaleConcurrentBandContinuationFromTour(
      tour,changed),/does not replay/);
  }
});

test('two measured catches produce one paid bunch band without a result',()=>{
  for(const [gender,teamCount] of [['M',15],['F',20]]){
    const tour=pairedTour(gender,teamCount,2,2);
    const previous=recordFinaleConcurrentRearCatchContinuationFromTour(tour);
    assert.equal(previous.status,'stopped_at_exact_contact');
    assert.equal(previous.contact.aheadKind,'front');
    assert.equal(previous.contact.behindKind,'bunch');
    assert.equal(validateFinaleConcurrentRearCatchContinuationFromTour(
      tour,previous),true);
    const line=recordFinaleConcurrentFullCatchContinuationFromTour(tour);
    assert.equal(line.status,'band_crossings_only');
    assert.equal(line.contact,null);
    assert.deepEqual(line.contactEvents.map(row=>row.kind),[
      'rear_attack_bunch_contact','front_bunch_contact']);
    assert.ok(line.contactEvents[0].positionM<
      line.contactEvents[1].positionM);
    assert.ok(Math.abs(line.contactEvents[1].positionM-
      previous.contact.positionM)<1e-8);
    assert.equal(line.bandCrossings.length,1);
    assert.equal(line.bandCrossings[0].kind,'bunch');
    assert.equal(line.bandCrossings[0].riderIds.length,teamCount*8);
    assert.equal(line.roadRelationshipStatus,'all_caught_band_crossing');
    assert.equal(line.resultStatus,'unclassified');
    assert.equal(line.pointsStatus,'withheld');
    assert.equal(line.finalRiders.length,teamCount*8);
    assert.ok(line.finalRiders.every(row=>row.positionM===40000));
    const debits=new Map();
    const distances=new Map();
    for(const frame of line.frames)for(const row of frame.riders){
      debits.set(row.riderId,(debits.get(row.riderId)??0)+
        row.energySpent);
      distances.set(row.riderId,(distances.get(row.riderId)??0)+
        row.distanceM);
    }
    assert.ok(line.finalRiders.every(row=>
      Math.abs(row.energyAtSource-debits.get(row.riderId)-
        row.energyAtStop)<1e-8&&
      Math.abs(row.distanceTravelledM-distances.get(row.riderId))<1e-8));
    assert.equal(validateFinaleConcurrentFullCatchContinuationFromTour(
      tour,line),true);
    const changed=structuredClone(line);
    changed.contactEvents[1].elapsedSinceLaunchSeconds+=.1;
    assert.throws(()=>validateFinaleConcurrentFullCatchContinuationFromTour(
      tour,changed),/does not replay/);
  }
});

test('two late catches hand off once to a conditional individual sprint',()=>{
  const tour=pairedTour('M',15,2,2);
  const line=recordFinaleConcurrentLateCatchLineFromTour(tour);
  assert.equal(line.roadPrefix.contactEvents.length,2);
  assert.equal(line.roadPrefix.handoffDistanceM,39800);
  assert.equal(line.roadPrefix.frames.at(-1).roadBands.length,1);
  assert.equal(line.roadPrefix.frames.at(-1).roadBands[0].riderIds.length,
    120);
  assert.equal(line.sprintPlan.decisionDistanceM,39800);
  assert.equal(line.runner.startDistanceM,39800);
  assert.equal(line.runner.lineDistanceM,40000);
  assert.equal(line.runner.frames[0].startDistanceM,39800);
  assert.equal(line.conditionalCrossings.length,120);
  assert.equal(new Set(line.conditionalCrossings.map(row=>row.riderId))
    .size,120);
  assert.ok(line.conditionalCrossings.every(row=>
    row.elapsedSecondsFromLastKmStart>
      line.roadPrefix.handoffElapsedSinceLaunchSeconds));
  assert.equal(line.classifiedResults,null);
  assert.equal(line.pointsStatus,'withheld');
  assert.equal(line.canCommitAwards,false);
  assert.equal(validateFinaleConcurrentLateCatchLineFromTour(tour,{},
    line),true);
  const changedFinisher=recordFinaleConcurrentLateCatchLineFromTour(tour,{
    plans:tour.committedInputs.teams.map(team=>({teamId:team.id,
      finisherId:team.id==='you'?'you-0':team.orders.captainId,
      leadOutRiderId:null}))});
  assert.deepEqual(changedFinisher.roadPrefix,line.roadPrefix);
  assert.deepEqual(changedFinisher.positionedSource.slots,
    line.positionedSource.slots);
  assert.ok(changedFinisher.runner.frames.some(frame=>frame.riders.some(
    row=>row.riderId==='you-0'&&row.role==='sprint')));
  assert.ok(changedFinisher.conditionalCrossings.find(row=>
    row.riderId==='you-0').energyAtLine<
  line.conditionalCrossings.find(row=>
    row.riderId==='you-0').energyAtLine);
  assert.equal(changedFinisher.pointsStatus,'withheld');
  const changed=structuredClone(line);
  changed.roadPrefix.riderEnergyAtHandoff[0].energy+=.1;
  assert.throws(()=>validateFinaleConcurrentLateCatchLineFromTour(
    tour,{},changed),/does not replay/);
  const unsupported=structuredClone(line.sprintPlan.decisions.map(row=>({
    teamId:row.teamId,finisherId:row.finisherId,
    leadOutRiderId:row.teamId==='you'?'you-4':null})));
  assert.throws(()=>recordFinaleConcurrentLateCatchLineFromTour(tour,{
    plans:unsupported}),/without a lead-out/);
});

test('exact rear catch joins the bunch with paid sheltered continuation',()=>{
  for(const gender of ['M','F']){
    const tour=pairedTour(gender,15,3);
    const oldLine=recordFinaleConcurrentBandContinuationFromTour(tour);
    assert.equal(oldLine.status,'stopped_at_exact_contact');
    assert.equal(oldLine.contact.aheadKind,'rear_attack');
    assert.equal(oldLine.contact.behindKind,'bunch');
    assert.equal(validateFinaleConcurrentBandContinuationFromTour(tour,
      oldLine),true);
    const line=recordFinaleConcurrentRearCatchContinuationFromTour(tour);
    assert.equal(line.status,'band_crossings_only');
    assert.equal(line.contact,null);
    assert.equal(line.contactEvents.length,1);
    assert.equal(line.contactEvents[0].riderId,'you-3');
    assert.ok(Math.abs(line.contactEvents[0].positionM-
      oldLine.contact.positionM)<1e-8);
    assert.equal(line.roadRelationshipStatus,
      'rear_caught_then_band_crossings');
    assert.deepEqual(line.bandCrossings.map(row=>row.kind),
      ['front','bunch']);
    assert.ok(line.bandCrossings[1].riderIds.includes('you-3'));
    assert.equal(line.finalRiders.length,120);
    assert.ok(line.finalRiders.every(row=>row.positionM===40000));
    const merged= line.frames.find(frame=>
      frame.event==='rear_attack_bunch_contact_merged');
    assert.ok(merged);
    assert.equal(merged.roadBands.length,2);
    assert.ok(merged.roadBands[1].riderIds.includes('you-3'));
    assert.ok(line.frames.slice(line.frames.indexOf(merged)+1)
      .some(frame=>frame.riders.some(row=>
        row.riderId==='you-3'&&row.role==='sheltered')));
    const debits=new Map();
    const distances=new Map();
    for(const frame of line.frames)for(const row of frame.riders){
      debits.set(row.riderId,(debits.get(row.riderId)??0)+
        row.energySpent);
      distances.set(row.riderId,(distances.get(row.riderId)??0)+
        row.distanceM);
    }
    assert.ok(line.finalRiders.every(row=>
      Math.abs(row.energyAtSource-debits.get(row.riderId)-
        row.energyAtStop)<1e-8&&
      Math.abs(row.distanceTravelledM-distances.get(row.riderId))<1e-8));
    assert.equal(validateFinaleConcurrentRearCatchContinuationFromTour(
      tour,line),true);
    const changed=structuredClone(line);
    changed.contactEvents[0].positionM+=1;
    assert.throws(()=>validateFinaleConcurrentRearCatchContinuationFromTour(
      tour,changed),/does not replay/);
  }
});
