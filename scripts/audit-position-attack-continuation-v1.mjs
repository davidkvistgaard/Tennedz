// One-rider contact diagnostic. Later attacks are intentionally not
// simulated here; this cannot certify a complete race.
import {preparePhysicalFirstSplitMotorInputV1} from
  '../lib/viewer/physical-first-split-test-race-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../lib/engine/v2/physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionRotationKmV2} from
  '../lib/engine/v2/physical-first-position-rotation-km-v2.mjs';
import {choosePhysicalFirstBoundaryAttacksV1} from
  '../lib/engine/v2/physical-first-attack-choice-v1.mjs';
import {advancePhysicalFirstPositionAttackDepartureKmV1} from
  '../lib/engine/v2/physical-first-position-attack-departure-km-v1.mjs';
import {advancePhysicalFirstPositionSoloKmV1} from
  '../lib/engine/v2/physical-first-position-solo-km-v1.mjs';

const {input:base}=preparePhysicalFirstSplitMotorInputV1(
  'men',{terrain:'flat',chase:'all',
    attack:'selective',seed:'preview-recorded-road-1'});
const input={...base,positionModelVersion:
  PHYSICAL_FIRST_POSITION_START_V2_VERSION};
const grid={laneCount:4,wheelSpacingM:2.5,laneStaggerM:.08};
let peloton=createPhysicalFirstPositionStartV2({input,grid});
for(const segment of input.kilometres.slice(0,19))
  peloton=advancePhysicalFirstPositionRotationKmV2({
    prior:peloton,segment,input});
const choicePrior={sourceKm:peloton.sourceKm,
  roads:[{roadId:'peloton',
    riderIds:peloton.positions.map(row=>row.riderId),
    clockSeconds:peloton.clockSeconds}],
  riders:peloton.positions.map(row=>({
    riderId:row.riderId,teamId:row.teamId,
    roadId:'peloton',distanceM:19000,
    clockSeconds:peloton.clockSeconds,
    reserve:row.energy,quietKm:row.quietKm}))};
const choice=choosePhysicalFirstBoundaryAttacksV1({
  prior:choicePrior,segment:input.kilometres[19],
  teams:input.teams,stakes:input.stakes,
  kilometres:input.kilometres})
  .find(row=>row.choice==='attempt_paid_attack');
const departure=advancePhysicalFirstPositionAttackDepartureKmV1({
  prior:peloton,segment:input.kilometres[19],
  input,choice});
peloton=departure.peloton;
let solo=departure.soloPosition;
const gaps=[{km:20,gapM:solo.distanceM-
  peloton.frontDistanceM}];
let stop=null;
let soloFinish=null;
for(const segment of input.kilometres.slice(20)){
  try{
    const nextPeloton=advancePhysicalFirstPositionRotationKmV2({
      prior:peloton,segment,input});
    const nextSolo=advancePhysicalFirstPositionSoloKmV1({
      priorSolo:solo,priorPeloton:peloton,
      nextPeloton,segment,input});
    peloton=nextPeloton;
    solo=nextSolo.position;
    gaps.push({km:segment.km,
      gapM:nextSolo.gapAheadOfPelotonM});
    if(nextSolo.finished){
      soloFinish={sourceKm:segment.km,
        crossing:nextSolo.finishCrossing,
        energyAfter:nextSolo.position.energy};
      break;
    }
  }catch(error){
    stop={km:segment.km,reason:error.message};
    break;
  }
}
process.stdout.write(`${JSON.stringify({
  version:'physical-first-position-attack-continuation-audit-1',
  raceSeed:input.raceSeed,
  attackRiderId:choice.riderId,
  departureGapM:gaps[0].gapM,
  completedThroughKm:peloton.sourceKm,
  minGapM:Math.min(...gaps.map(row=>row.gapM)),
  maxGapM:Math.max(...gaps.map(row=>row.gapM)),
  sampledGaps:gaps.filter(row=>
    row.km===20||row.km%10===0||
    row.km===peloton.sourceKm),
  soloFinish,stop,officialResults:false},null,2)}\n`);
