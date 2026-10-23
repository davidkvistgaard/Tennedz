import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  validateFinaleSeparatedGroupsFromTour,
  FINALE_COAST_DISSOLVED_FRONT_LAST_KM_VERSION} from
  '../../lib/engine/v2/finale-multi-run.mjs';
import {auditDissolvedFrontContact} from
  '../../lib/engine/v2/finale-dissolved-front-contact.mjs';
import {auditDissolvedFrontPaidContact} from
  '../../lib/engine/v2/finale-dissolved-front-paid-contact.mjs';
import {recordDissolvedFrontFirstWheel,
  validateDissolvedFrontFirstWheel} from
  '../../lib/engine/v2/finale-dissolved-front-wheel-audit.mjs';

test('whole-race dissolved front identifies both active overtakes without a result',()=>{
  const prepared=prepareV91Playtest({distanceKm:260,teamCount:4,
    gender:'M',terrain:'rolling',fatigue:30,seed:'v93-expanded-61-a',
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',
    chase:'selective',profileHeightsM:[900,700,300,500,200,100],
    managerTactics:[
      {effort:'steady',attack:'none',chase:'selective'},
      {effort:'hard',attack:'selective',chase:'all'},
      {effort:'hard',attack:'repeated',chase:'ignore'}]});
  const tour=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:prepared.teams,seed:prepared.seed,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_DISSOLVED_FRONT_LAST_KM_VERSION});
  assert.equal(validateFinaleSeparatedGroupsFromTour(tour,trace),true);
  assert.equal(trace.frames.at(-1).endDistanceM,260000);
  assert.deepEqual(trace.frames[0].frontGroupDissolutions[0].riderIds,
    ['rival-2-7','rival-3-5','you-5']);
  assert.deepEqual(trace.contactAudit.encounters.map(row=>row.activeBandId),
    ['road-13','road-13','road-13','peloton','peloton','peloton']);
  assert.ok(trace.contactAudit.encounters.every(row=>
    row.distanceM>259000&&row.distanceM<259250));
  assert.ok(Math.abs(trace.contactAudit.firstPotentialContact.distanceM-
    259061.1835909186)<1e-6);
  assert.equal(trace.contactAudit.status,
    'unresolved_active_isolated_contact');
  assert.equal(trace.roadStatus,'provisional_contact_unresolved');
  assert.equal(trace.classifiedResults,null);
  assert.equal(trace.canCommitAwards,false);
  assert.equal(trace.pointsStatus,'withheld');
  const paid=auditDissolvedFrontPaidContact(trace);
  assert.equal(paid.encounters.length,6);
  assert.equal(paid.contactResolved,false);
  assert.equal(paid.canCommitAwards,false);
  assert.equal(paid.pointsStatus,'withheld');
  assert.deepEqual(paid.encounters.map(row=>row.activeBandId),
    trace.contactAudit.encounters.map(row=>row.activeBandId));
  for(const event of paid.encounters){
    const {solo,activeBand}=event.split;
    assert.ok(Math.abs(solo.energyBefore-solo.energySpentToContact-
      solo.energyAtContact)<1e-7);
    assert.ok(activeBand.riders.every(row=>
      Math.abs(row.energyBefore-row.energySpentToContact-
        row.energyAtContact)<1e-7));
    assert.equal(event.split.unresolvedSliceEndDistanceM,259250);
    assert.equal(Object.hasOwn(solo,'energyAfter'),false);
  }
  assert.ok(paid.encounters.every(row=>
    row.elapsedSecondsFromLastKmStart>0));
  assert.ok(paid.encounters.every((row,index)=>!index||
    row.elapsedSecondsFromLastKmStart>=
      paid.encounters[index-1].elapsedSecondsFromLastKmStart));
  const wheels=recordDissolvedFrontFirstWheel(tour,trace);
  assert.equal(validateDissolvedFrontFirstWheel(tour,trace,wheels),true);
  assert.equal(wheels.status,'unresolved_occupied_lane_wheel_contact');
  assert.equal(wheels.firstPotentialWheelContact.leaverRiderId,
    'rival-2-7');
  assert.equal(wheels.firstPotentialWheelContact.approachingBandId,
    'road-13');
  assert.ok(Math.abs(wheels.firstPotentialWheelContact.approachingWheelM-
    259054.07065255172)<1e-6);
  assert.ok(wheels.firstPotentialWheelContact.approachingWheelM<
    paid.firstPaidSplit.distanceM);
  assert.ok(wheels.firstPotentialWheelContact.leaverEnergyAtContact>=0);
  assert.equal(wheels.firstPotentialWheelContact.leaverEnergyAtContact,0);
  assert.ok(Math.abs(wheels.firstPotentialWheelContact
    .approachingEnergyAtContact-6.359238231264091)<1e-7);
  assert.ok(wheels.candidates.every((row,index)=>!index||
    row.elapsedSecondsFromLastKmStart>=
      wheels.candidates[index-1].elapsedSecondsFromLastKmStart));
  assert.equal(wheels.canCommitAwards,false);
  assert.equal(wheels.classifiedResults,null);
  const alteredWheel=structuredClone(wheels);
  alteredWheel.firstPotentialWheelContact.approachingWheelM+=1;
  assert.throws(()=>validateDissolvedFrontFirstWheel(tour,trace,
    alteredWheel),/does not replay/);
  const altered=structuredClone(trace);
  altered.contactAudit.encounters[0].distanceM+=1;
  assert.throws(()=>validateFinaleSeparatedGroupsFromTour(tour,altered),
    /differs from its locked tour/);
});

test('dissolved-front contact audit has no encounter on separate paid paths',()=>{
  const result=auditDissolvedFrontContact({frames:[{
    startDistanceM:259000,endDistanceM:259250,
    bunchElapsedSeconds:25,roadGroups:[{id:'road-1',gapSeconds:4,
      elapsedSeconds:25}],droppedTravel:{riders:[{
      riderId:'solo',deficitSecondsBefore:-8,
      deficitSecondsAfter:-7}]}}]});
  assert.equal(result.status,'no_active_isolated_contact');
  assert.equal(result.firstPotentialContact,null);
  assert.deepEqual(result.encounters,[]);
  assert.equal(result.canCommitAwards,false);
});

test('paid encounter order follows time when different riders meet at different markers',()=>{
  const trace={version:'synthetic-paid-road',frames:[{
    startDistanceM:0,endDistanceM:100,bunchElapsedSeconds:10,
    roadGroups:[{id:'front',gapSeconds:5,elapsedSeconds:15,
      riderIds:['leader']}],pelotonRiderIds:['bunch'],
    riders:[{riderId:'leader',role:'sheltered',energy:9,
      energySpent:1},{riderId:'bunch',role:'sheltered',energy:9,
      energySpent:1}],
    droppedTravel:{riders:[{
      riderId:'solo-1',deficitSecondsBefore:-20,
      deficitSecondsAfter:5,elapsedSeconds:35,
      energyBefore:10,energyAfter:9,energySpent:1},{
      riderId:'solo-2',deficitSecondsBefore:-1,
      deficitSecondsAfter:19,elapsedSeconds:30,
      energyBefore:10,energyAfter:9,energySpent:1}]}}]};
  const paid=auditDissolvedFrontPaidContact(trace);
  assert.deepEqual(paid.encounters.map(row=>row.riderId),
    ['solo-1','solo-2','solo-1']);
  assert.deepEqual(paid.encounters.map(row=>row.activeBandId),
    ['front','peloton','peloton']);
  assert.deepEqual(paid.encounters.map(row=>row.distanceM),
    [50,5,80]);
  assert.deepEqual(paid.encounters.map(row=>
    row.elapsedSecondsFromLastKmStart),[-2.5,.5,8]);
});
