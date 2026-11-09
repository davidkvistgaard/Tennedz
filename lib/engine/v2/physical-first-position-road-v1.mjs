// A narrow, source-independent paid position transition. The same named
// leader keeps a connected road for this kilometre; later versions must
// account for passing, attacks, drops and contact before accepting them.
import {isDeepStrictEqual} from 'node:util';
import {PHYSICAL_FIRST_POSITION_START_VERSION} from
  './physical-first-position-start-v1.mjs';

export const PHYSICAL_FIRST_POSITION_ROAD_VERSION=
  'physical-first-position-road-1';
const EPS=1e-6;

export function advancePhysicalFirstPositionRoadV1(prior,step){
  const road=step?.peloton?.road;
  const positions=prior?.positions;
  const frontDistanceM=prior?.frontDistanceM??
    prior?.startLineDistanceM;
  if(![PHYSICAL_FIRST_POSITION_START_VERSION,
    PHYSICAL_FIRST_POSITION_ROAD_VERSION].includes(prior?.version)||
    !Array.isArray(positions)||!positions.length||
    step?.sourceKm!==prior.sourceKm+1||
    step.attackSteps?.length||
    step.otherSteps?.length||
    step.boundaryContactEvents?.length||
    step.withinKmContactEvents?.length||
    step.peloton.startDropEvents?.length||
    road?.roadId!=='peloton'||
    road.startDistanceM!==frontDistanceM||
    road.endDistanceM!==frontDistanceM+1000||
    Math.abs(road.startClockSeconds-prior.clockSeconds)>EPS||
    !Number.isFinite(road.finishClockSeconds)||
    road.finishClockSeconds<=road.startClockSeconds||
    !Number.isFinite(road.speedMps)||road.speedMps<=0||
    Math.abs(road.speedMps*(road.finishClockSeconds-
      road.startClockSeconds)-1000)>EPS||
    positions[0].riderId!==road.leaderRiderId||
    road.riderIds?.length!==positions.length||
    road.riderDecisions?.length!==positions.length)
    throw new Error('Position road needs one unchanged paid leader and road.');
  const byDecision=new Map(road.riderDecisions.map(row=>
    [row.riderId,row]));
  if(byDecision.size!==positions.length||
    positions.some(row=>!road.riderIds.includes(row.riderId)||
      !byDecision.has(row.riderId)||
      Math.abs(byDecision.get(row.riderId).energyBefore-
        row.energy)>EPS||
      !Number.isFinite(byDecision.get(row.riderId).energyAfter)||
      !Number.isFinite(row.distanceM)||
      !Number.isFinite(row.paidDistanceM)||
      row.paidDistanceM!==prior.sourceKm*1000))
    throw new Error('Position road lost rider movement or paid energy.');
  const next=positions.map(row=>{
    const decision=byDecision.get(row.riderId);
    return {...row,distanceM:row.distanceM+1000,
      paidDistanceM:row.paidDistanceM+1000,
      energy:decision.energyAfter,quietKm:decision.quietKm};
  });
  const checkpointCrossings=positions.flatMap(row=>{
    const endDistanceM=row.distanceM+1000;
    const crossings=[];
    for(let km=1;km<=step.sourceKm;km++){
      const lineDistanceM=km*1000;
      if(row.distanceM+EPS<lineDistanceM&&
        endDistanceM+EPS>=lineDistanceM){
        const clockSeconds=road.startClockSeconds+
          (lineDistanceM-row.distanceM)/road.speedMps;
        if(clockSeconds>road.finishClockSeconds+EPS)
          throw new Error('Position crossing exceeds paid road time.');
        crossings.push({riderId:row.riderId,km,
          lineDistanceM,clockSeconds});
      }
    }
    return crossings;
  }).sort((a,b)=>a.clockSeconds-b.clockSeconds||
    a.riderId.localeCompare(b.riderId));
  return {version:PHYSICAL_FIRST_POSITION_ROAD_VERSION,
    sourceStartVersion:PHYSICAL_FIRST_POSITION_START_VERSION,
    inputHash:prior.inputHash,
    raceSeed:prior.raceSeed,
    grid:{...prior.grid},
    sourceKm:step.sourceKm,
    frontDistanceM:road.endDistanceM,
    clockSeconds:road.finishClockSeconds,
    speedMps:road.speedMps,
    leaderRiderId:road.leaderRiderId,
    positions:next,
    checkpointCrossings,
    checkpointCrossingsRecorded:true,
    lineCrossingsRecorded:false,
    officialResults:false};
}

export function replayPhysicalFirstPositionRoadV1(prior,step,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionRoadV1(prior,step)))
    throw new Error('Position road differs from paid rider movement.');
  return recorded;
}
