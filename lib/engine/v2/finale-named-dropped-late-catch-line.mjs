import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleDepletedSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {resolveLateContactBunchSource} from
  './finale-positioned-source.mjs';
import {recordFinalePositionedLateContactRunnerFromTour,
  positionedLineOrder} from './finale-paid-bunch-runner.mjs';
import {advanceFinaleDroppedStep} from './finale-dropped-step.mjs';
import {recordFinaleUnorderedBandOverlapAudit} from
  './finale-multiband-overlap-audit.mjs';
import {validateFinaleNamedAttackDroppedRoadFromTour} from
  './finale-named-attack-dropped-road.mjs';

export const FINALE_NAMED_DROPPED_LATE_CATCH_LINE_VERSION=
  'v2-finale-named-dropped-late-catch-line-lab-1';
const EPSILON=1e-7;

// The exact catch and the rest of its 100 m slice stay on the paid road.
// Nominated sprint work starts at the next recorded boundary, with the
// merged bunch's actual energy. A pre-contact lead-out needs its own road
// trajectory and is explicitly outside this branch.
export function recordFinaleNamedDroppedLateCatchLine(tour,road,
  {plans=null}={}){
  validateFinaleNamedAttackDroppedRoadFromTour(tour,
    {teamId:road?.attackIntent?.teamId},road);
  const finishM=tour.route.distanceKm*1000;
  const at500=road.frames.find(frame=>frame.distanceM===finishM-500);
  const catchFrame=road.frames.find(frame=>
    frame.active.catchDistanceM>finishM-500+EPSILON);
  const roster=tour.committedInputs.teams.flatMap(team=>team.riders);
  const droppedId=at500?.droppedTravel.riders[0]?.riderId;
  const source=catchFrame?.active;
  const sourceDistanceM=catchFrame?.distanceM;
  if(!at500||at500.active.roadGroups.length!==1||
    !catchFrame||sourceDistanceM>=finishM||
    source.roadGroups.length||!droppedId||
    source.pelotonRiderIds.length!==roster.length-1||
    source.riderEnergy.length!==roster.length-1||
    catchFrame.droppedTravel.riders.length!==1||
    catchFrame.droppedTravel.riders[0].riderId!==droppedId||
    road.frames.some(frame=>frame.distanceM>sourceDistanceM&&
      frame.active.roadGroups.length))
    throw new Error('The named late catch needs one paid merged boundary and dropped rider.');
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const sprintPlan=recordFinaleDepletedSprintPlanFromTour(tour,{
    source:{endDistanceM:finishM-500,
      roadGroups:at500.active.roadGroups,
      pelotonRiderIds:at500.active.pelotonRiderIds,
      isolatedRiderIds:[droppedId],
      riderEnergy:[...at500.active.riderEnergy.map(row=>({
        riderId:row.riderId,energyAfter:row.energyAfter})),
      {riderId:droppedId,energyAfter:at500.droppedTravel.riders[0]
        .energyAfter}]},
    plans:nominations,sourceRoadTraceVersion:road.version});
  if(sprintPlan.decisions.some(row=>row.leadOutRiderId))
    throw new Error('A pre-contact lead-out needs separate paid road work.');
  const virtualTour={...tour,committedInputs:{...tour.committedInputs,
    teams:tour.committedInputs.teams.map(team=>({...team,
      riders:team.riders.filter(rider=>rider.id!==droppedId)}))}};
  const positionedSource=resolveLateContactBunchSource(virtualTour,{
    version:road.version,at500M:{distanceM:sourceDistanceM,
      roadGroups:[],pelotonRiderIds:source.pelotonRiderIds},
    frames:[source]},
  {...sprintPlan,decisionDistanceM:sourceDistanceM});
  const bunchRunner=recordFinalePositionedLateContactRunnerFromTour(tour,{
    source:{distanceM:sourceDistanceM,
      pelotonRiderIds:source.pelotonRiderIds,
      riderEnergy:source.riderEnergy.map(row=>({
        riderId:row.riderId,energy:row.energyAfter})),
      bunchElapsedSeconds:catchFrame.bunchElapsedSecondsFromMarker,
      sourceRoadTraceVersion:road.version,
      sourceCatchVersion:road.version,
      catchDistanceM:source.catchDistanceM},
    plan:{...sprintPlan,decisions:sprintPlan.decisions.filter(row=>
      source.pelotonRiderIds.includes(row.finisherId))},
    positionedSource});
  const droppedAtSource=catchFrame.droppedTravel.riders[0];
  const ridersById=new Map(roster.map(rider=>[rider.id,rider]));
  let droppedState={riderId:droppedId,
    deficitSeconds:droppedAtSource.deficitSecondsAfter,
    energy:droppedAtSource.energyAfter};
  let droppedTime=catchFrame.bunchElapsedSecondsFromMarker+
    droppedState.deficitSeconds;
  const slices=finaleDistanceGrid(tour.route,{remainingKm:1})
    .filter(slice=>slice.startDistanceM>=sourceDistanceM);
  const droppedFrames=slices.map((slice,index)=>{
    const bunch=bunchRunner.frames[index];
    if(bunch?.startDistanceM!==slice.startDistanceM||
      bunch.endDistanceM!==slice.endDistanceM)
      throw new Error('The late catch lost its paid bunch clock.');
    const step=advanceFinaleDroppedStep({slice,
      segment:tour.route.kilometres[slice.sourceKm-1],
      bunchElapsedSeconds:bunch.durationSeconds,
      droppedRiders:[droppedState],ridersById});
    const row=step.riders[0];
    const before=droppedTime;
    droppedTime+=row.elapsedSeconds;
    droppedState={riderId:droppedId,
      deficitSeconds:row.deficitSecondsAfter,energy:row.energyAfter};
    return {startDistanceM:slice.startDistanceM,
      endDistanceM:slice.endDistanceM,elapsedSecondsAtStart:before,
      durationSeconds:row.elapsedSeconds,
      riders:[{riderId:droppedId,role:'dropped',
        positionBeforeM:slice.startDistanceM,positionM:slice.endDistanceM,
        activeSeconds:row.elapsedSeconds,activeDistanceM:slice.lengthM,
        shelteredSeconds:0,shelteredDistanceM:0,
        energyAtDecision:row.energyBefore,energySpent:row.energySpent,
        energyAfter:row.energyAfter,
        elapsedToLineSeconds:slice.endDistanceM===finishM?
          droppedTime:null}]};
  });
  const isolatedRunner={frames:droppedFrames,
    finishers:[{riderId:droppedId,
      teamId:tour.committedInputs.teams.find(team=>
        team.riders.some(rider=>rider.id===droppedId)).id,
      elapsedSecondsFromLastKmStart:droppedTime,
      energyAtLine:droppedState.energy}]};
  const bandRunners=[{roadBandId:'peloton',runner:bunchRunner},
    {roadBandId:`isolated:${droppedId}`,runner:isolatedRunner}];
  const conditionalCrossings=[...bunchRunner.finishers,
    ...isolatedRunner.finishers];
  if(conditionalCrossings.length!==roster.length||
    new Set(conditionalCrossings.map(row=>row.riderId)).size!==
      roster.length)
    throw new Error('The late catch lost a locked rider.');
  const overlapAudit=recordFinaleUnorderedBandOverlapAudit(bandRunners);
  return {version:FINALE_NAMED_DROPPED_LATE_CATCH_LINE_VERSION,
    sourceRoadTraceVersion:road.version,
    catchDistanceM:source.catchDistanceM,
    startDistanceM:sourceDistanceM,lineDistanceM:finishM,
    sprintPlan,positionedSource,bandRunners,conditionalCrossings,
    overlapAudit,
    provisionalLineOrder:overlapAudit.firstPotentialOverlap?
      null:positionedLineOrder(conditionalCrossings),
    roadStatus:overlapAudit.firstPotentialOverlap?
      'conditional_named_late_catch_contact_unresolved':
      'conditional_named_late_catch_lines_separated',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleNamedDroppedLateCatchLine(tour,road,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleNamedDroppedLateCatchLine(tour,road,input)))
    throw new Error('The named dropped late-catch line does not replay.');
  return true;
}
