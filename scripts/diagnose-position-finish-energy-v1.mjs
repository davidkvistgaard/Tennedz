// Diagnose recorded reserve differences at the same route finish.
// Group clocks do not supply individual wheel positions or times.
import {preparePhysicalFirstSplitMotorInputV1} from
  '../lib/viewer/physical-first-split-test-race-v1.mjs';
import {PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../lib/engine/v2/physical-first-position-start-v2.mjs';
import {runPhysicalFirstWholeRaceProbeV2} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {recordPhysicalFirstPositionGeneralRaceV3,
  recordPhysicalFirstPositionGeneralRaceV4,
  recordPhysicalFirstPositionGeneralRaceV5} from
  '../lib/engine/v2/physical-first-position-general-race-v1.mjs';
import {orderAt} from '../lib/engine/v2/orders.mjs';
import {riderKilometreEffect} from
  '../lib/engine/v2/physiology.mjs';
import {segmentBaseSeconds} from
  '../lib/engine/v2/road-clock.mjs';
import {MOTOR_RACE_DYNAMICS,TUNING} from
  '../lib/engine/v2/tuning.mjs';

const option=(name,fallback)=>process.argv.find(arg=>
  arg.startsWith(`--${name}=`))?.slice(name.length+3)??
  fallback;
const category=option('category','men');
const terrain=option('terrain','flat');
const chase=option('chase','selective');
const attack=option('attack','selective');
const seed=option('seed','preview-recorded-road-1');
const positionVersion=option('position-version','5');
if(!['men','women'].includes(category)||
  !['flat','rolling','mountain'].includes(terrain)||
  !['selective','all'].includes(chase)||
  !['none','selective','repeated'].includes(attack)||
  !['3','4','5'].includes(positionVersion)||
  !(/^[A-Za-z0-9-]{1,64}$/).test(seed))
  throw new Error('Unsupported finish-energy diagnosis input.');
const prepared=preparePhysicalFirstSplitMotorInputV1(
  category,{terrain,chase,attack,seed});
const input={...prepared.input,
  positionModelVersion:
    PHYSICAL_FIRST_POSITION_START_V2_VERSION,
  positionPassingCorridorCount:1};
const source=runPhysicalFirstWholeRaceProbeV2(input);
const position=(positionVersion==='5'?
  recordPhysicalFirstPositionGeneralRaceV5:
  positionVersion==='4'?
    recordPhysicalFirstPositionGeneralRaceV4:
    recordPhysicalFirstPositionGeneralRaceV3)({
  input,grid:{laneCount:4,wheelSpacingM:2.5,
    laneStaggerM:.08}});
const sourceFinal=new Map(source.states.at(-1).riders
  .map(row=>[row.riderId,row]));
const beforeTail=new Map(position.steps.at(-1)
  .sharedRoad.positions.map(row=>[row.riderId,row]));
const tail=new Map(position.tail.decisions.map(row=>
  [row.riderId,row]));
const frontLeaderMismatches=source.steps.flatMap((step,index)=>{
  const sourceLeaderRiderId=step.peloton.road
    .leaderRiderId;
  const positionLeaderRiderId=position.steps[index]
    .sharedRoad.leaderRiderId;
  return sourceLeaderRiderId===positionLeaderRiderId?[]:[{
    sourceKm:index+1,sourceLeaderRiderId,
    positionLeaderRiderId}];
});
const sources=new Map(input.teams.flatMap(team=>
  team.riders.map(rider=>[rider.id,{rider,team}])));
const speed=(riderId,energy,segment,phase)=>{
  const source=sources.get(riderId);
  const effort=orderAt(source.team.orders,
    segment.km-1).effort;
  const ability=riderKilometreEffect(source.rider,
    segment,{phase,energy,
      exposed:segment.exposed}).ability+
    (TUNING.effortPressure[effort]-1)*20;
  return 1000/(segmentBaseSeconds(segment)+
    (50-ability)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint);
};
const firstFrontPassConstraints=frontLeaderMismatches
  .slice(0,10).map(({sourceKm})=>{
    const step=position.steps[sourceKm-1];
    const prior=sourceKm===1?position.start:
      position.steps[sourceKm-2].sharedRoad;
    const candidateId=step.leaderPlan.leaderRiderId;
    const frontId=prior.leaderRiderId??
      prior.firstLeaderPlan.leaderRiderId;
    const front=prior.positions.find(row=>
      row.riderId===frontId);
    const candidate=prior.positions.find(row=>
      row.riderId===candidateId);
    const segment=input.kilometres[sourceKm-1];
    const sameRoad=candidate?.roadId==='peloton';
    const laneClear=sameRoad&&
      candidate.lane!==front.lane&&
      !prior.positions.some(row=>
        row.roadId==='peloton'&&
        row.riderId!==candidateId&&
        row.lane===candidate.lane&&
        row.distanceM>candidate.distanceM+1e-6);
    const relativeSpeedMps=sameRoad?
      speed(candidateId,candidate.energy,segment,
        'attack')-
      speed(frontId,front.energy,segment,
        'solo'):null;
    const requiredGainM=sameRoad?
      front.distanceM-candidate.distanceM+
        prior.grid.wheelSpacingM:null;
    const firstDistanceM=relativeSpeedMps>0?
      speed(frontId,front.energy,segment,
        'solo')*requiredGainM/
          relativeSpeedMps:null;
    return {sourceKm,frontId,candidateId,
      sameRoad,laneClear,requiredGainM,
      relativeSpeedMps,firstDistanceM,
      proposedPassRecorded:
        Boolean(step.sharedRoad.frontPassEvent),
      refusal:step.frontPassRefusal??null};
  });
const rows=position.finishCrossings.map(crossing=>{
  const riderId=crossing.riderId;
  const sourceRow=sourceFinal.get(riderId);
  const boundary=beforeTail.get(riderId);
  const finish=tail.get(riderId);
  if(!sourceRow||!boundary||!finish)
    throw new Error('Finish-energy diagnosis lacks a rider.');
  return {riderId,sourceRoadId:sourceRow.roadId,
    positionRoadId:boundary.roadId,
    sourceEnergy:sourceRow.reserve,
    positionEnergyAtGlobalBoundary:boundary.energy,
    positionEnergyAtFinish:finish.energyAfter,
    paidTailDistanceM:+finish.paidTailDistanceM.toFixed(3),
    paidTailEnergy:+finish.paidFromReserve.toFixed(3),
    sourceMinusPositionAtFinish:+
      (sourceRow.reserve-finish.energyAfter).toFixed(3),
    crossingClockSeconds:+crossing.clockSeconds
      .toFixed(3)};
}).sort((a,b)=>Math.abs(b.sourceMinusPositionAtFinish)-
  Math.abs(a.sourceMinusPositionAtFinish)||
  a.riderId.localeCompare(b.riderId));
process.stdout.write(JSON.stringify({
  version:'position-finish-energy-diagnosis-1',
  fixture:'current_motor_lab_test_input',
  category,terrain,chase,attack,seed,
  positionVersion,
  riderCount:rows.length,
  maxAbsoluteFinishReserveDifference:
    Math.abs(rows[0].sourceMinusPositionAtFinish),
  meanAbsoluteFinishReserveDifference:+
    (rows.reduce((sum,row)=>sum+
      Math.abs(row.sourceMinusPositionAtFinish),0)/
      rows.length).toFixed(3),
  frontLeaderMismatchKmCount:
    frontLeaderMismatches.length,
  frontPassRefusalCount:position.steps.filter(step=>
    step.frontPassRefusal).length,
  firstFrontPassRefusals:position.steps.filter(step=>
    step.frontPassRefusal).slice(0,10).map(step=>
    step.frontPassRefusal),
  firstFrontPassConstraints,
  firstFrontLeaderMismatches:
    frontLeaderMismatches.slice(0,10),
  topRiders:rows.slice(0,10),
  officialResults:false},null,2)+'\n');
