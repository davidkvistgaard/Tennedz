// Pay the final, still connected, positional road until its last wheel
// crosses. This records individual clocks without claiming a sprint result.
import {isDeepStrictEqual} from 'node:util';
import {orderAt} from './orders.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {createPhysicalFirstPositionStartV2} from
  './physical-first-position-start-v2.mjs';
import {PHYSICAL_FIRST_POSITION_ROTATION_KM_V2_VERSION} from
  './physical-first-position-rotation-km-v2.mjs';

export const PHYSICAL_FIRST_POSITION_FINISH_TAIL_V2_VERSION=
  'physical-first-position-finish-tail-2';
const EPS=1e-6;

export function settlePhysicalFirstPositionFinishTailV2({
  input,prior}){
  const finishKm=input?.kilometres?.length;
  const finishDistanceM=finishKm*1000;
  const positions=prior?.positions;
  const speedMps=prior?.secondSpeedMps??
    prior?.firstSpeedMps;
  if(input?.positionModelVersion!==
      'physical-first-position-start-2'||
    prior?.version!==
      PHYSICAL_FIRST_POSITION_ROTATION_KM_V2_VERSION||
    !Number.isInteger(finishKm)||finishKm<1||
    prior.sourceKm!==finishKm||
    !Array.isArray(positions)||!positions.length||
    prior.frontDistanceM!==finishDistanceM||
    !Number.isFinite(prior.clockSeconds)||
    !Number.isFinite(speedMps)||speedMps<=0||
    positions[0]?.riderId!==prior.leaderRiderId||
    positions.some(row=>row.roadId!=='peloton'||
      !Number.isFinite(row.distanceM)||
      row.distanceM>finishDistanceM+EPS||
      !Number.isFinite(row.energy)||row.energy<0)||
    new Set(positions.map(row=>row.riderId)).size!==
      positions.length)
    throw new Error('Finish tail v2 needs a completed position road.');
  if(prior.inputHash!==createPhysicalFirstPositionStartV2({
    input,grid:prior.grid}).inputHash)
    throw new Error('Finish tail v2 changed committed inputs.');
  const maxGapM=finishDistanceM-
    Math.min(...positions.map(row=>row.distanceM));
  if(maxGapM<0||maxGapM>=1000)
    throw new Error('Finish tail v2 exceeds final route segment.');
  const sources=new Map(input.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const separate=prior.separateRoadRiderIds??[];
  if(!Array.isArray(separate)||
    new Set(separate).size!==separate.length||
    sources.size!==positions.length+separate.length||
    separate.some(id=>!sources.has(id)||
      positions.some(row=>row.riderId===id))||
    positions.some(row=>sources.get(row.riderId)?.team.id!==
      row.teamId))
    throw new Error('Finish tail v2 lacks committed rider roads.');
  const segment=input.kilometres.at(-1);
  const tailDecisions=positions.map(row=>{
    const source=sources.get(row.riderId);
    const role=row.riderId===prior.leaderRiderId?
      'leader':'sheltered';
    const order=orderAt(source.team.orders,finishKm-1);
    const paid=maxGapM>0?priceRearEnergyDemandV1({
      rider:source.rider,segment,energyBefore:row.energy,
      effort:order.effort,role,distanceM:maxGapM}):null;
    return {riderId:row.riderId,role,
      startDistanceM:row.distanceM,
      endDistanceM:row.distanceM+maxGapM,
      energyBefore:row.energy,
      paidFromReserve:paid?.energyDemand??0,
      energyAfter:paid?.energyAfter??row.energy};
  });
  const lineCrossings=positions.map(row=>({
    riderId:row.riderId,lineDistanceM:finishDistanceM,
    clockSeconds:prior.clockSeconds+
      (finishDistanceM-row.distanceM)/speedMps,
    sourceKm:finishKm,paidRoadId:'peloton'}))
    .sort((a,b)=>a.clockSeconds-b.clockSeconds||
      a.riderId.localeCompare(b.riderId));
  if(lineCrossings[0]?.riderId!==
      prior.leaderRiderId||
    lineCrossings.at(-1).clockSeconds>
      prior.clockSeconds+maxGapM/speedMps+EPS)
    throw new Error('Finish tail v2 lost a paid crossing.');
  return {version:
    PHYSICAL_FIRST_POSITION_FINISH_TAIL_V2_VERSION,
  raceSeed:prior.raceSeed,inputHash:prior.inputHash,
  sourceKm:finishKm,riderCount:positions.length,
  finishDistanceM,frontClockSeconds:prior.clockSeconds,
  speedMps,tailDistanceM:maxGapM,
  tailEndClockSeconds:prior.clockSeconds+
    maxGapM/speedMps,
  frontWorkerPaidBeyondFinish:maxGapM>0,
  tailDecisions,lineCrossings,
  lineCrossingCoverage:
    `${lineCrossings.length}/${positions.length}`,
  legacyGroupClockPositionsUsed:false,
  competitiveSprintModelUsed:false,
  officialResults:false};
}

export function replayPhysicalFirstPositionFinishTailV2(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    settlePhysicalFirstPositionFinishTailV2(input)))
    throw new Error('Finish tail v2 differs from paid movement.');
  return recorded;
}
