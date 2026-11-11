// Diagnose recorded reserve differences at the same route finish.
// Group clocks do not supply individual wheel positions or times.
import {preparePhysicalFirstSplitMotorInputV1} from
  '../lib/viewer/physical-first-split-test-race-v1.mjs';
import {PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../lib/engine/v2/physical-first-position-start-v2.mjs';
import {runPhysicalFirstWholeRaceProbeV2} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {recordPhysicalFirstPositionGeneralRaceV3} from
  '../lib/engine/v2/physical-first-position-general-race-v1.mjs';

const option=(name,fallback)=>process.argv.find(arg=>
  arg.startsWith(`--${name}=`))?.slice(name.length+3)??
  fallback;
const category=option('category','men');
const terrain=option('terrain','flat');
const chase=option('chase','selective');
const attack=option('attack','selective');
const seed=option('seed','preview-recorded-road-1');
if(!['men','women'].includes(category)||
  !['flat','rolling','mountain'].includes(terrain)||
  !['selective','all'].includes(chase)||
  !['none','selective','repeated'].includes(attack)||
  !(/^[A-Za-z0-9-]{1,64}$/).test(seed))
  throw new Error('Unsupported finish-energy diagnosis input.');
const prepared=preparePhysicalFirstSplitMotorInputV1(
  category,{terrain,chase,attack,seed});
const input={...prepared.input,
  positionModelVersion:
    PHYSICAL_FIRST_POSITION_START_V2_VERSION,
  positionPassingCorridorCount:1};
const source=runPhysicalFirstWholeRaceProbeV2(input);
const position=recordPhysicalFirstPositionGeneralRaceV3({
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
  riderCount:rows.length,
  maxAbsoluteFinishReserveDifference:
    Math.abs(rows[0].sourceMinusPositionAtFinish),
  meanAbsoluteFinishReserveDifference:+
    (rows.reduce((sum,row)=>sum+
      Math.abs(row.sourceMinusPositionAtFinish),0)/
      rows.length).toFixed(3),
  frontLeaderMismatchKmCount:
    frontLeaderMismatches.length,
  firstFrontLeaderMismatches:
    frontLeaderMismatches.slice(0,10),
  topRiders:rows.slice(0,10),
  officialResults:false},null,2)+'\n');
