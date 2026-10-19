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
import {validateFinaleNamedAttackDroppedRoadFromTour,
  validateFinaleNamedAttackMultipleDroppedRoadFromTour} from
  './finale-named-attack-dropped-road.mjs';

export const FINALE_NAMED_DROPPED_LATE_CATCH_LINE_VERSION=
  'v2-finale-named-dropped-late-catch-line-lab-1';
export const FINALE_NAMED_MULTIPLE_DROPPED_LATE_CATCH_LINE_VERSION=
  'v2-finale-named-multiple-dropped-late-catch-line-lab-2';
const EPSILON=1e-7;

// The exact catch and the rest of its 100 m slice stay on the paid road.
// Nominated sprint work starts at the next recorded boundary, with the
// merged bunch's actual energy. A pre-contact lead-out needs its own road
// trajectory and is explicitly outside this branch.
export function recordFinaleNamedDroppedLateCatchLine(tour,road,
  {plans=null}={}){
  return recordNamedDroppedLateCatchLine(tour,road,{plans},{minDropped:1,
    maxDropped:1,version:FINALE_NAMED_DROPPED_LATE_CATCH_LINE_VERSION,
    validateRoad:validateFinaleNamedAttackDroppedRoadFromTour});
}

export function recordFinaleNamedMultipleDroppedLateCatchLine(tour,road,
  {plans=null}={}){
  return recordNamedDroppedLateCatchLine(tour,road,{plans},{minDropped:2,
    maxDropped:Infinity,
    version:FINALE_NAMED_MULTIPLE_DROPPED_LATE_CATCH_LINE_VERSION,
    validateRoad:validateFinaleNamedAttackMultipleDroppedRoadFromTour});
}

function recordNamedDroppedLateCatchLine(tour,road,{plans},{minDropped,
  maxDropped,version,validateRoad}){
  validateRoad(tour,{teamId:road?.attackIntent?.teamId},road);
  const finishM=tour.route.distanceKm*1000;
  const at500=road.frames.find(frame=>frame.distanceM===finishM-500);
  const catchFrame=road.frames.find(frame=>
    frame.active.catchDistanceM>finishM-500+EPSILON);
  const roster=tour.committedInputs.teams.flatMap(team=>team.riders);
  const dropped=at500?.droppedTravel.riders;
  const droppedIds=dropped?.map(row=>row.riderId);
  const source=catchFrame?.active;
  const sourceDistanceM=catchFrame?.distanceM;
  if(!at500||at500.active.roadGroups.length!==1||
    !catchFrame||sourceDistanceM>=finishM||
    source.roadGroups.length||
    dropped?.length<minDropped||dropped?.length>maxDropped||
    new Set(droppedIds).size!==droppedIds.length||
    source.pelotonRiderIds.length!==roster.length-dropped.length||
    source.riderEnergy.length!==roster.length-dropped.length||
    catchFrame.droppedTravel.riders.length!==dropped.length||
    catchFrame.droppedTravel.riders.some(row=>
      !droppedIds.includes(row.riderId))||
    road.frames.some(frame=>frame.distanceM>sourceDistanceM&&
      frame.active.roadGroups.length))
    throw new Error(minDropped===1?
      'The named late catch needs one paid merged boundary and dropped rider.':
      'The named late catch needs one paid merged boundary and isolated riders.');
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const sprintPlan=recordFinaleDepletedSprintPlanFromTour(tour,{
    source:{endDistanceM:finishM-500,
      roadGroups:at500.active.roadGroups,
      pelotonRiderIds:at500.active.pelotonRiderIds,
      isolatedRiderIds:droppedIds,
      riderEnergy:[...at500.active.riderEnergy.map(row=>({
        riderId:row.riderId,energyAfter:row.energyAfter})),
      ...dropped.map(row=>({riderId:row.riderId,
        energyAfter:row.energyAfter}))]},
    plans:nominations,sourceRoadTraceVersion:road.version});
  if(sprintPlan.decisions.some(row=>row.leadOutRiderId))
    throw new Error('A pre-contact lead-out needs separate paid road work.');
  const droppedSet=new Set(droppedIds);
  const virtualTour={...tour,committedInputs:{...tour.committedInputs,
    teams:tour.committedInputs.teams.map(team=>({...team,
      riders:team.riders.filter(rider=>!droppedSet.has(rider.id))}))}};
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
  const ridersById=new Map(roster.map(rider=>[rider.id,rider]));
  const teamById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  let droppedStates=catchFrame.droppedTravel.riders.map(row=>({
    riderId:row.riderId,deficitSeconds:row.deficitSecondsAfter,
    energy:row.energyAfter}));
  const passageSeconds=new Map(droppedStates.map(row=>[row.riderId,
    catchFrame.bunchElapsedSecondsFromMarker+row.deficitSeconds]));
  const droppedFrames=new Map(droppedIds.map(id=>[id,[]]));
  const slices=finaleDistanceGrid(tour.route,{remainingKm:1})
    .filter(slice=>slice.startDistanceM>=sourceDistanceM);
  slices.forEach((slice,index)=>{
    const bunch=bunchRunner.frames[index];
    if(bunch?.startDistanceM!==slice.startDistanceM||
      bunch.endDistanceM!==slice.endDistanceM)
      throw new Error('The late catch lost its paid bunch clock.');
    const step=advanceFinaleDroppedStep({slice,
      segment:tour.route.kilometres[slice.sourceKm-1],
      bunchElapsedSeconds:bunch.durationSeconds,
      droppedRiders:droppedStates,ridersById});
    if(step.riders.length!==droppedIds.length)
      throw new Error('The late catch lost an isolated rider.');
    for(const row of step.riders){
      const before=passageSeconds.get(row.riderId);
      if(!Number.isFinite(before)||!droppedFrames.has(row.riderId))
        throw new Error('The late catch has an unknown isolated rider.');
      const after=before+row.elapsedSeconds;
      passageSeconds.set(row.riderId,after);
      droppedFrames.get(row.riderId).push({startDistanceM:slice.startDistanceM,
      endDistanceM:slice.endDistanceM,elapsedSecondsAtStart:before,
      durationSeconds:row.elapsedSeconds,
      riders:[{riderId:row.riderId,role:'dropped',
        positionBeforeM:slice.startDistanceM,positionM:slice.endDistanceM,
        activeSeconds:row.elapsedSeconds,activeDistanceM:slice.lengthM,
        shelteredSeconds:0,shelteredDistanceM:0,
        energyAtDecision:row.energyBefore,energySpent:row.energySpent,
        energyAfter:row.energyAfter,
        elapsedToLineSeconds:slice.endDistanceM===finishM?
          after:null}]});
    }
    droppedStates=step.riders.map(row=>({riderId:row.riderId,
      deficitSeconds:row.deficitSecondsAfter,energy:row.energyAfter}));
  });
  const isolatedBands=droppedStates.map(state=>({
    roadBandId:`isolated:${state.riderId}`,
    runner:{frames:droppedFrames.get(state.riderId),
      finishers:[{riderId:state.riderId,
        teamId:teamById.get(state.riderId),
        elapsedSecondsFromLastKmStart:passageSeconds.get(state.riderId),
        energyAtLine:state.energy}]}}));
  const bandRunners=[{roadBandId:'peloton',runner:bunchRunner},
    ...isolatedBands];
  const conditionalCrossings=[...bunchRunner.finishers,
    ...isolatedBands.flatMap(band=>band.runner.finishers)];
  if(conditionalCrossings.length!==roster.length||
    new Set(conditionalCrossings.map(row=>row.riderId)).size!==
      roster.length)
    throw new Error('The late catch lost a locked rider.');
  const overlapAudit=recordFinaleUnorderedBandOverlapAudit(bandRunners);
  return {version,
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

export function validateFinaleNamedMultipleDroppedLateCatchLine(tour,road,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleNamedMultipleDroppedLateCatchLine(tour,road,input)))
    throw new Error('The named multiple-dropped late catch does not replay.');
  return true;
}
