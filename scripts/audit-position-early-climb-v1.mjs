// Reproduce the 160-rider first-climb drop without changing guided races.
import {prepareV91Playtest} from
  '../lib/engine/v2/playtest.mjs';
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {replayRearEnergyCapV1} from
  '../lib/engine/v2/rear-energy-cap-source-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../lib/engine/v2/physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionRotationKmV2} from
  '../lib/engine/v2/physical-first-position-rotation-km-v2.mjs';
import {orderAt} from '../lib/engine/v2/orders.mjs';
import {riderKilometreEffect} from
  '../lib/engine/v2/physiology.mjs';
import {segmentBaseSeconds} from
  '../lib/engine/v2/road-clock.mjs';
import {MOTOR_DRAFT_SHELTER,MOTOR_RACE_DYNAMICS,
  TUNING} from '../lib/engine/v2/tuning.mjs';

const settings={distanceKm:120,teamCount:20,
  terrain:'mountain',fatigue:0,attack:'none',
  chase:'selective',seed:'preview-recorded-road-1'};
const sportingStakes=prepareV91Playtest(settings)
  .teams.map(team=>({teamId:team.id,
    goal:team.id==='you'?'summit_attack':'none',
    captainId:team.orders.captainId}));
const rivalGoals=Array.from({length:19},(_,index)=>
  ({teamId:`rival-${index+1}`,role:'protect'}));
const {recording}=createV94RaceDynamicsPreview({
  format:'one_day',settings,sportingStakes,
  rivalGoals,ownFrontWork:'rotate',
  roadGroupPaceVersion:3,chaseTurnVersion:1,
  bunchFrontTurnVersion:1,
  pelotonFrontTurnVersion:1,
  pelotonDraftCostVersion:1,
  pelotonExposureCostVersion:1,
  freshAttackDecisionVersion:1,
  roadGroupRiderDecisionVersion:1,
  protectorSportingPursuitVersion:1});
const {teams,rivalIntent}=recording.committedInputs;
// A committed named worker can impose a pace some sheltered riders
// cannot hold. This is a new input variant, not a changed recording.
teams.find(team=>team.id==='you')
  .orders.baseline.frontWorkRiderId='you-5';
const kilometres=recording.route.kilometres;
const riders=teams.flatMap(team=>team.riders.map(rider=>({
  riderId:rider.id,teamId:team.id,
  roadId:'peloton',distanceM:0,
  clockSeconds:0,reserve:replayRearEnergyCapV1({
    rider,kilometres,throughKm:0}).initialCap,
  quietKm:0})));
const start={sourceKm:0,
  roads:[{roadId:'peloton',
    riderIds:riders.map(row=>row.riderId),
    clockSeconds:0}],riders};
const input={start,kilometres,teams,
  stakes:rivalIntent,raceSeed:recording.raceSeed,
  positionModelVersion:
    PHYSICAL_FIRST_POSITION_START_V2_VERSION};
const source=runPhysicalFirstWholeRaceProbeV1(input);
const positionStart=createPhysicalFirstPositionStartV2({
  input,grid:{laneCount:4,wheelSpacingM:2.5,
    laneStaggerM:.08}});
const segment=kilometres[0];
const riderSource=new Map(teams.flatMap(team=>
  team.riders.map(rider=>[rider.id,{rider,team}])));
const abilityFor=(row,phase)=>{
  const {rider,team}=riderSource.get(row.riderId);
  const order=orderAt(team.orders,0);
  return riderKilometreEffect(rider,segment,{
    phase,energy:row.energy,
    exposed:segment.exposed}).ability+
    (TUNING.effortPressure[order.effort]-1)*20+
    (phase==='cruise'?
      MOTOR_DRAFT_SHELTER[segment.terrain]:0);
};
const frontAbility=abilityFor(positionStart.positions[0],
  'solo');
const speedFor=ability=>1000/(
  segmentBaseSeconds(segment)+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint);
const frontSpeed=speedFor(frontAbility);
const elapsed=1000/frontSpeed;
// This deliberately omits energy and collision settlement. It only
// locates the first missing movement contract and cannot feed the viewer.
const projected=positionStart.positions.map(row=>{
  const ability=abilityFor(row,
    row===positionStart.positions[0]?'solo':'cruise');
  const speed=Math.min(frontSpeed,
    speedFor(ability));
  return {riderId:row.riderId,
    startDistanceM:row.distanceM,
    endDistanceM:row.distanceM+speed*elapsed,
    fallsBackM:1000-speed*elapsed};
}).sort((a,b)=>b.endDistanceM-a.endDistanceM);
const separationThresholdM=5;
const components=[];
for(const row of projected){
  if(!components.length||
    components.at(-1).at(-1).endDistanceM-
      row.endDistanceM>separationThresholdM)
    components.push([]);
  components.at(-1).push(row);
}
let positionOutcome=null;
try{
  const first=advancePhysicalFirstPositionRotationKmV2({
    prior:positionStart,segment:kilometres[0],
    input});
  positionOutcome={status:'complete',
    sourceKm:first.sourceKm};
}catch(error){
  positionOutcome={status:'unsupported',
    sourceKm:1,reason:error.message};
}
process.stdout.write(`${JSON.stringify({
  version:'physical-first-position-early-climb-audit-1',
  category:'men',riderCount:riders.length,
  firstTerrain:kilometres[0].terrain,
  sourceFront:source.steps[0].peloton
    .road.leaderRiderId,
  sourceStartDrops:source.steps[0].peloton
    .startDropEvents.length,
  stagedFront:positionStart.positions[0].riderId,
  unpaidDiagnostic:{slowerRiders:projected.filter(row=>
    row.fallsBackM>1e-6).length,
  maxFallBackM:Math.max(...projected.map(row=>
    row.fallsBackM)),
  componentSizes:components.map(group=>group.length)},
  positionOutcome,officialResults:false},null,2)}\n`);
