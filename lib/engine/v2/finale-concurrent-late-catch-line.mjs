import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentFullCatchContinuationFromTour} from
  './finale-concurrent-band-continuation.mjs';
import {recordFinaleLateMergedSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {resolveLateContactBunchSource} from
  './finale-positioned-source.mjs';
import {recordFinalePositionedLateMergedRunnerFromTour} from
  './finale-paid-bunch-runner.mjs';

export const FINALE_CONCURRENT_LATE_CATCH_LINE_VERSION=
  'v2-finale-concurrent-late-catch-line-lab-1';
const EPSILON=1e-8;

// The complete road-band tape is evidence for the two exact catches. Only
// its prefix through the first merged boundary feeds this alternative
// individual continuation. Reusing its paid line crossing would double-count
// the remaining road.
export function recordFinaleConcurrentLateCatchLineFromTour(tour,
  {plans=null}={}){
  const road=recordFinaleConcurrentFullCatchContinuationFromTour(tour);
  const finishM=tour.route.distanceKm*1000;
  const roster=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  if(road.status!=='band_crossings_only'||
    road.roadRelationshipStatus!=='all_caught_band_crossing'||
    road.contactEvents.map(row=>row.kind).join(',')!==
      'rear_attack_bunch_contact,front_bunch_contact')
    throw new Error('A late concurrent line needs two measured catches.');
  const secondCatch=road.contactEvents[1];
  const handoffIndex=road.frames.findIndex(frame=>
    frame.elapsedSinceLaunchSeconds>secondCatch.elapsedSinceLaunchSeconds+
      EPSILON&&frame.roadBands.length===1&&
    frame.roadBands[0].kind==='bunch'&&
    Math.abs(frame.roadBands[0].positionM-
      Math.round(frame.roadBands[0].positionM/100)*100)<EPSILON&&
    frame.roadBands[0].positionM<finishM);
  const handoff=road.frames[handoffIndex];
  const riderIds=handoff?.roadBands[0].riderIds;
  const sourceDistanceM=handoff?.roadBands[0].positionM;
  if(handoffIndex<0||sourceDistanceM<=finishM-500||
    riderIds?.length!==roster.length||
    new Set(riderIds).size!==roster.length||
    roster.some(id=>!riderIds.includes(id))||
    handoff.riders.length!==roster.length||
    handoff.riders.some(row=>!Number.isFinite(row.energyAtEvent)))
    throw new Error('The late concurrent line needs one complete paid handoff.');
  const energyById=new Map(handoff.riders.map(row=>
    [row.riderId,row.energyAtEvent]));
  const sourceEnergy=new Map(road.finalRiders.map(row=>
    [row.riderId,row.energyAtSource]));
  const roadPrefix=road.frames.slice(0,handoffIndex+1);
  const spentById=new Map();
  for(const frame of roadPrefix)for(const row of frame.riders)
    spentById.set(row.riderId,(spentById.get(row.riderId)??0)+
      row.energySpent);
  if(riderIds.some(id=>!sourceEnergy.has(id)||
    Math.abs(sourceEnergy.get(id)-(spentById.get(id)??0)-
      energyById.get(id))>EPSILON))
    throw new Error('The late concurrent handoff lost earned energy.');
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const sprintPlan=recordFinaleLateMergedSprintPlanFromTour(tour,{
    source:{endDistanceM:sourceDistanceM,roadGroups:[],
      pelotonRiderIds:riderIds,
      riderEnergy:riderIds.map(riderId=>({riderId,
        energyAfter:energyById.get(riderId)}))},
    plans:nominations,sourceRoadTraceVersion:road.version});
  const source={distanceM:sourceDistanceM,roadGroups:[],
    pelotonRiderIds:riderIds,
    riderEnergy:riderIds.map(riderId=>({riderId,
      energy:energyById.get(riderId)})),
    bunchElapsedSeconds:handoff.elapsedSinceLaunchSeconds,
    sourceRoadTraceVersion:road.version};
  const positionedSource=resolveLateContactBunchSource(tour,{
    version:road.version,at500M:source,frames:[{}]},sprintPlan);
  const runner=recordFinalePositionedLateMergedRunnerFromTour(tour,{
    source,plan:sprintPlan,positionedSource});
  if(runner.finishers.length!==roster.length||
    new Set(runner.finishers.map(row=>row.riderId)).size!==roster.length||
    runner.finishers.some(row=>!energyById.has(row.riderId)||
      !Number.isFinite(row.elapsedSecondsFromLastKmStart)||
      row.elapsedSecondsFromLastKmStart<=
        handoff.elapsedSinceLaunchSeconds||
      !Number.isFinite(row.energyAtLine)||row.energyAtLine<0||
      row.energyAtLine>energyById.get(row.riderId)+EPSILON))
    throw new Error('The late concurrent line lost an individual crossing.');
  return {version:FINALE_CONCURRENT_LATE_CATCH_LINE_VERSION,
    sourceRoadTraceVersion:road.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    roadPrefix:{startDistanceM:road.startDistanceM,
      handoffDistanceM:sourceDistanceM,
      sourceElapsedSinceLaunchSeconds:road.sourceElapsedSinceLaunchSeconds,
      handoffElapsedSinceLaunchSeconds:handoff.elapsedSinceLaunchSeconds,
      contactEvents:road.contactEvents,frames:roadPrefix,
      riderEnergyAtHandoff:source.riderEnergy},
    sprintPlan,positionedSource,runner,
    conditionalCrossings:runner.finishers,
    provisionalLineOrder:runner.lineOrder,
    roadStatus:'paid_late_double_catch_conditional_individual_line',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleConcurrentLateCatchLineFromTour(tour,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentLateCatchLineFromTour(tour,input)))
    throw new Error('Concurrent late-catch individual line does not replay.');
  return true;
}
