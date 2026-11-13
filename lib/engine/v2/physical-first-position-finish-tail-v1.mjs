// Continue a fully supported connected road until its last wheel reaches
// the line. The same front worker pays for riding beyond the line.
// This preserves the recorded order; a competitive sprint needs a new
// paid passing and speed contract before official places can exist.
import {isDeepStrictEqual} from 'node:util';
import {orderAt} from './orders.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {PHYSICAL_FIRST_POSITION_TRACE_VERSION} from
  './physical-first-position-trace-v1.mjs';

export const PHYSICAL_FIRST_POSITION_FINISH_TAIL_VERSION=
  'physical-first-position-finish-tail-1';
const EPS=1e-6;

export function settlePhysicalFirstPositionFinishTailV1(input,trace){
  const finishKm=input?.kilometres?.length;
  const last=trace?.states?.at(-1);
  const positions=last?.positions;
  const finishDistanceM=finishKm*1000;
  if(trace?.version!==PHYSICAL_FIRST_POSITION_TRACE_VERSION||
    !Number.isInteger(finishKm)||finishKm<1||
    trace.completedThroughKm!==finishKm||
    trace.unsupported!==null||
    trace.plannedKm!==finishKm||
    !Array.isArray(positions)||
    positions.length!==trace.riderCount||
    last.frontDistanceM!==finishDistanceM||
    !Number.isFinite(last.clockSeconds)||
    !Number.isFinite(last.speedMps)||last.speedMps<=0||
    positions[0]?.riderId!==last.leaderRiderId||
    positions.some(row=>row.roadId!=='peloton'||
      !Number.isFinite(row.distanceM)||
      row.distanceM>finishDistanceM+EPS||
      !Number.isFinite(row.energy)||row.energy<0)||
    new Set(positions.map(row=>row.riderId)).size!==
      positions.length)
    throw new Error('Finish tail needs a fully paid connected position road.');
  const maxGapM=finishDistanceM-
    Math.min(...positions.map(row=>row.distanceM));
  if(maxGapM<0||maxGapM>=1000)
    throw new Error('Finish tail exceeds the final route segment.');
  const sources=new Map(input.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  if(sources.size!==positions.length||
    positions.some(row=>sources.get(row.riderId)?.team.id!==
      row.teamId))
    throw new Error('Finish tail lacks committed rider sources.');
  const segment=input.kilometres.at(-1);
  const tailDecisions=positions.map(row=>{
    const source=sources.get(row.riderId);
    const role=row.riderId===last.leaderRiderId?
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
    clockSeconds:last.clockSeconds+
      (finishDistanceM-row.distanceM)/last.speedMps,
    sourceKm:finishKm,
    paidRoadId:'peloton'})).sort((a,b)=>
    a.clockSeconds-b.clockSeconds||
    a.riderId.localeCompare(b.riderId));
  if(lineCrossings.length!==positions.length||
    !isDeepStrictEqual(lineCrossings[0]?.riderId,
      last.leaderRiderId)||
    lineCrossings.at(-1).clockSeconds>
      last.clockSeconds+maxGapM/last.speedMps+EPS)
    throw new Error('Finish tail loses a paid line crossing.');
  return {version:PHYSICAL_FIRST_POSITION_FINISH_TAIL_VERSION,
    raceSeed:trace.raceSeed,inputHash:trace.inputHash,
    sourceKm:finishKm,riderCount:positions.length,
    finishDistanceM,frontClockSeconds:last.clockSeconds,
    speedMps:last.speedMps,tailDistanceM:maxGapM,
    tailEndClockSeconds:last.clockSeconds+
      maxGapM/last.speedMps,
    frontWorkerPaidBeyondFinish:maxGapM>0,
    tailDecisions,lineCrossings,
    lineCrossingCoverage:`${lineCrossings.length}/${positions.length}`,
    legacyGroupClockPositionsUsed:false,
    competitiveSprintModelUsed:false,
    officialResults:false};
}

export function replayPhysicalFirstPositionFinishTailV1(input,trace,
  recorded){
  if(!isDeepStrictEqual(recorded,
    settlePhysicalFirstPositionFinishTailV1(input,trace)))
    throw new Error('Finish tail differs from paid rider motion.');
  return recorded;
}
