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
import {recordFinaleDissolvedFrontShoulderRoad,
  validateFinaleDissolvedFrontShoulderRoad} from
  '../../lib/engine/v2/finale-dissolved-front-shoulder-road.mjs';
import {recordFinaleDissolvedFrontConditionalLine,
  validateFinaleDissolvedFrontConditionalLine,
  FINALE_DISSOLVED_FRONT_CONDITIONAL_LINE_VERSION} from
  '../../lib/engine/v2/finale-dissolved-front-conditional-line.mjs';
import {recordFinaleDissolvedFrontPost500Wheel,
  validateFinaleDissolvedFrontPost500Wheel} from
  '../../lib/engine/v2/finale-dissolved-front-post500-wheel.mjs';

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
  const shoulder=recordFinaleDissolvedFrontShoulderRoad(tour);
  assert.equal(validateFinaleDissolvedFrontShoulderRoad(tour,
    shoulder),true);
  assert.equal(shoulder.passages.at(-1).distanceM,260000);
  assert.equal(shoulder.laneAssignments.length,3);
  assert.equal(new Set(shoulder.laneAssignments.map(row=>
    row.outsideLane)).size,3);
  assert.deepEqual(shoulder.lineRoad.roadGroups.map(row=>row.id),
    ['road-13']);
  assert.equal(shoulder.lineRoad.isolated.length,5);
  assert.equal(shoulder.lineRoad.pelotonRiderIds.length,24);
  assert.equal(shoulder.lineRoad.riderEnergy.length,32);
  assert.ok(shoulder.passages.every(frame=>
    frame.riderEnergy.length===32&&
    new Set(frame.riderEnergy.map(row=>row.riderId)).size===32));
  assert.deepEqual(shoulder.lineRoad.riderEnergy.map(row=>({
    riderId:row.riderId,energy:row.energy})),
  shoulder.trace.finalRiderEnergy);
  assert.equal(shoulder.classifiedResults,null);
  assert.equal(shoulder.pointsStatus,'withheld');
  assert.equal(shoulder.canCommitAwards,false);
  const alteredRoad=structuredClone(shoulder);
  alteredRoad.passages[0].riderEnergy[0].energy+=1;
  assert.throws(()=>validateFinaleDissolvedFrontShoulderRoad(tour,
    alteredRoad),/does not replay/);
  const individual=recordFinaleDissolvedFrontConditionalLine(tour);
  assert.equal(validateFinaleDissolvedFrontConditionalLine(tour,{},
    individual),true);
  assert.equal(individual.conditionalCrossings.length,32);
  assert.equal(new Set(individual.conditionalCrossings.map(row=>
    row.riderId)).size,32);
  assert.equal(individual.bandRunners.length,7);
  assert.equal(individual.provisionalLineOrder,null);
  assert.equal(individual.classifiedResults,null);
  assert.equal(individual.pointsStatus,'withheld');
  assert.equal(individual.canCommitAwards,false);
  const post500=recordFinaleDissolvedFrontPost500Wheel(tour,individual);
  assert.equal(validateFinaleDissolvedFrontPost500Wheel(tour,individual,
    post500),true);
  assert.equal(post500.status,'no_active_cross_band_wheel_contact');
  assert.equal(post500.firstPotentialWheelContact,null);
  const alteredWheelRoad=structuredClone(post500);
  alteredWheelRoad.status='active_cross_band_wheel_contact_unresolved';
  assert.throws(()=>validateFinaleDissolvedFrontPost500Wheel(tour,
    individual,alteredWheelRoad),/does not replay/);
  assert.equal(post500.classifiedResults,null);
  assert.equal(post500.pointsStatus,'withheld');
  assert.equal(post500.canCommitAwards,false);
  assert.ok(post500.candidates.every(row=>
    (row.atHandoff||Math.abs(row.frontWheelM-row.bunchWheelM-
      individual.positionedSource.wheelSpacingM)<1e-7)&&
    row.frontEnergyAtContact>=0&&row.bunchEnergyAtContact>=0));
  const at500=individual.shoulder.passages.find(row=>
    row.distanceM===259500);
  const at500Energy=new Map(at500.riderEnergy.map(row=>
    [row.riderId,row.energy]));
  const from500=new Set();
  for(const band of individual.bandRunners){
    assert.ok(band.runner.frames.length>=5);
    assert.equal(band.runner.frames[0].startDistanceM,259500);
    assert.equal(band.runner.frames.at(-1).endDistanceM,260000);
    for(const row of band.runner.frames[0].riders){
      from500.add(row.riderId);
      assert.ok(Math.abs(row.energyAtDecision-
        at500Energy.get(row.riderId))<1e-7);
    }
    for(const frame of band.runner.frames){
      assert.ok(frame.endDistanceM>frame.startDistanceM);
      for(const row of frame.riders){
        assert.ok(Math.abs(row.energyAtDecision-row.energySpent-
          row.energyAfter)<1e-7);
      }
    }
  }
  assert.equal(from500.size,32);
  const different=tour.committedInputs.teams.flatMap(team=>
    team.riders.filter(rider=>
      rider.id!==team.orders.captainId&&
      at500.pelotonRiderIds.includes(rider.id)).map(rider=>({
        team,finisherId:rider.id})))[0];
  assert.ok(different);
  const changedPlans=tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.id===different.team.id?
      different.finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const changed=recordFinaleDissolvedFrontConditionalLine(tour,{
    plans:changedPlans});
  assert.equal(validateFinaleDissolvedFrontConditionalLine(tour,{
    plans:changedPlans},changed),true);
  assert.equal(changed.conditionalCrossings.length,32);
  assert.ok(changed.sprintPlan.decisions.some(row=>
    row.finisherId===different.finisherId));
  assert.notDeepEqual(changed.conditionalCrossings,
    individual.conditionalCrossings);
  assert.equal(changed.classifiedResults,null);
  assert.equal(changed.pointsStatus,'withheld');
  for(const row of individual.conditionalCrossings){
    const paid=individual.shoulder.lineRoad.riderEnergy.find(item=>
      item.riderId===row.riderId);
    assert.ok(Number.isFinite(row.elapsedSecondsFromLastKmStart));
    assert.ok(Math.abs(row.energyAtLine-paid.energy)<1e-7||
      row.roadBandId==='road-13'||row.roadBandId==='peloton');
  }
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

test('post-500 wheel audit catches a paid same-lane approach',()=>{
  const frame=(riderId,from,speed)=>({
    elapsedSecondsAtStart:0,durationSeconds:(1000-from)/speed,
    riders:[{riderId,role:'sprint',positionBeforeM:from,
      positionM:1000,activeSeconds:(1000-from)/speed,
      activeDistanceM:1000-from,shelteredSeconds:0,
      shelteredDistanceM:0,energyAtDecision:10,
      energySpent:0,energyAfter:10}]});
  const band=(id,riderId,from,speed)=>({roadBandId:id,
    runner:{frames:[frame(riderId,from,speed)],
      finishers:[{riderId,elapsedSecondsFromLastKmStart:
        (1000-from)/speed}]}});
  const line={version:FINALE_DISSOLVED_FRONT_CONDITIONAL_LINE_VERSION,
    positionedSource:{wheelSpacingM:2.5,laneCount:8,roadBands:[
      {id:'front',slots:[{riderId:'front-rider',lane:0}]},
      {id:'peloton',slots:[{riderId:'bunch-rider',lane:0}]}]},
    bandRunners:[band('front','front-rider',520,5),
      band('peloton','bunch-rider',500,10)],
    shoulder:{version:'synthetic-shoulder',laneAssignments:[],
      passages:[{distanceM:500,isolated:[]}]}};
  const audit=recordFinaleDissolvedFrontPost500Wheel({
    route:{distanceKm:1}},line);
  assert.equal(audit.status,'active_cross_band_wheel_contact_unresolved');
  assert.equal(audit.candidates.length,1);
  assert.equal(audit.firstPotentialWheelContact.frontRiderId,
    'front-rider');
  assert.ok(Math.abs(audit.firstPotentialWheelContact
    .elapsedSecondsFromLastKmStart-3.5)<1e-7);
  assert.ok(Math.abs(audit.firstPotentialWheelContact.frontWheelM-
    audit.firstPotentialWheelContact.bunchWheelM-2.5)<1e-7);
  const separate=structuredClone(line);
  separate.positionedSource.roadBands[1].slots[0].lane=1;
  assert.equal(recordFinaleDissolvedFrontPost500Wheel({
    route:{distanceKm:1}},separate).firstPotentialWheelContact,null);
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
