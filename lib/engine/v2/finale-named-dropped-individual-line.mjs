import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleDepletedSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {resolveIndependentBunchSource} from
  './finale-positioned-source.mjs';
import {recordFinalePositionedBandRunnerFromTour,
  positionedLineOrder} from './finale-paid-bunch-runner.mjs';
import {advanceFinaleDroppedStep} from './finale-dropped-step.mjs';
import {recordFinaleUnorderedBandOverlapAudit} from
  './finale-multiband-overlap-audit.mjs';
import {validateFinaleNamedAttackDroppedRoadFromTour,
  validateFinaleNamedAttackMultipleDroppedRoadFromTour} from
  './finale-named-attack-dropped-road.mjs';

export const FINALE_NAMED_DROPPED_INDIVIDUAL_LINE_VERSION=
  'v2-finale-named-dropped-individual-line-lab-1';
export const FINALE_NAMED_MULTIPLE_DROPPED_INDIVIDUAL_LINE_VERSION=
  'v2-finale-named-multiple-dropped-individual-line-lab-2';
const EPSILON=1e-7;

// The attack must already have been caught at the paid 500 m handoff. The
// remaining bunch uses the existing nominated-rider runner and its provisional
// wheels; the isolated rider keeps paying independent travel. Any possible
// cross-band encounter withholds even a provisional full-field order.
export function recordFinaleNamedDroppedIndividualLine(tour,road,
  {plans=null}={}){
  return recordNamedDroppedIndividualLine(tour,road,{plans},
    {minDropped:1,maxDropped:1,
      version:FINALE_NAMED_DROPPED_INDIVIDUAL_LINE_VERSION,
      validateRoad:validateFinaleNamedAttackDroppedRoadFromTour});
}

export function recordFinaleNamedMultipleDroppedIndividualLine(tour,road,
  {plans=null}={}){
  return recordNamedDroppedIndividualLine(tour,road,{plans},
    {minDropped:2,maxDropped:Infinity,
      version:FINALE_NAMED_MULTIPLE_DROPPED_INDIVIDUAL_LINE_VERSION,
      validateRoad:validateFinaleNamedAttackMultipleDroppedRoadFromTour});
}

function recordNamedDroppedIndividualLine(tour,road,{plans},{minDropped,
  maxDropped,version,validateRoad}){
  validateRoad(tour,{teamId:road?.attackIntent?.teamId},road);
  const finishM=tour.route.distanceKm*1000;
  const at500=road.frames.find(frame=>frame.distanceM===finishM-500);
  const active=at500?.active;
  const dropped=at500?.droppedTravel.riders;
  const ids=active?.pelotonRiderIds;
  const roster=tour.committedInputs.teams.flatMap(team=>team.riders);
  const catchFrame=road.frames.find(frame=>
    frame.distanceM<=finishM-500&&frame.active.catchDistanceM);
  if(!at500||active.roadGroups.length||!catchFrame||
    catchFrame.active.catchDistanceM>finishM-500+EPSILON||
    !Array.isArray(ids)||
    dropped?.length<minDropped||dropped?.length>maxDropped||
    ids.length!==roster.length-dropped.length||
    active.riderEnergy.length!==ids.length)
    throw new Error('The named dropped line needs a caught paid 500 m bunch.');
  const isolatedIds=dropped.map(row=>row.riderId);
  const isolatedSet=new Set(isolatedIds);
  if(isolatedSet.size!==isolatedIds.length)
    throw new Error('The named dropped line repeats an isolated rider.');
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const sourceRoadTraceVersion=road.version;
  const sprintPlan=recordFinaleDepletedSprintPlanFromTour(tour,{
    source:{endDistanceM:finishM-500,roadGroups:[],
      pelotonRiderIds:ids,isolatedRiderIds:isolatedIds,
      riderEnergy:[...active.riderEnergy.map(row=>({
        riderId:row.riderId,energyAfter:row.energyAfter})),
      ...dropped.map(row=>({riderId:row.riderId,
        energyAfter:row.energyAfter}))]},
    plans:nominations,sourceRoadTraceVersion});
  if(minDropped>1&&sprintPlan.decisions.some(row=>
    isolatedSet.has(row.finisherId)))
    throw new Error('An isolated rider cannot be a paid finisher.');
  const virtualTour={...tour,committedInputs:{...tour.committedInputs,
    teams:tour.committedInputs.teams.map(team=>({...team,
      riders:team.riders.filter(rider=>!isolatedSet.has(rider.id))}))}};
  const positionedSource=resolveIndependentBunchSource(virtualTour,{
    version:sourceRoadTraceVersion,
    at500M:{distanceM:finishM-500,roadGroups:[],
      pelotonRiderIds:ids},frames:[]},sprintPlan);
  const bunchRunner=recordFinalePositionedBandRunnerFromTour(tour,{
    source:{distanceM:finishM-500,pelotonRiderIds:ids,
      riderEnergy:active.riderEnergy.map(row=>({
        riderId:row.riderId,energy:row.energyAfter})),
      bunchElapsedSeconds:at500.bunchElapsedSecondsFromMarker,
      sourceRoadTraceVersion},
    plan:{...sprintPlan,decisions:sprintPlan.decisions.filter(row=>
      ids.includes(row.finisherId))},positionedSource,
    branch:'bunch_band'});
  const grid=finaleDistanceGrid(tour.route,{remainingKm:1})
    .filter(slice=>slice.startDistanceM>=finishM-500);
  const ridersById=new Map(roster.map(rider=>[rider.id,rider]));
  const teamById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  let states=dropped.map(row=>({riderId:row.riderId,
    deficitSeconds:row.deficitSecondsAfter,energy:row.energyAfter}));
  const passageSecondsById=new Map(states.map(row=>[
    row.riderId,at500.bunchElapsedSecondsFromMarker+row.deficitSeconds]));
  const droppedFramesById=new Map(isolatedIds.map(id=>[id,[]]));
  grid.forEach((slice,index)=>{
    const bunch=bunchRunner.frames[index];
    if(bunch?.startDistanceM!==slice.startDistanceM||
      bunch.endDistanceM!==slice.endDistanceM||
      Math.abs(bunch.elapsedSecondsAtStart-
        (at500.bunchElapsedSecondsFromMarker+
          bunchRunner.frames.slice(0,index).reduce((sum,frame)=>
            sum+frame.durationSeconds,0)))>EPSILON)
      throw new Error('The named dropped line lost its 500 m bunch clock.');
    const step=advanceFinaleDroppedStep({slice,
      segment:tour.route.kilometres.at(-1),
      bunchElapsedSeconds:bunch.durationSeconds,
      droppedRiders:states,ridersById});
    if(step.riders.length!==isolatedIds.length)
      throw new Error('The named dropped line lost an isolated rider.');
    for(const row of step.riders){
      const before=passageSecondsById.get(row.riderId);
      if(!Number.isFinite(before)||
        !droppedFramesById.has(row.riderId))
        throw new Error('The named dropped line has an unknown rider.');
      const after=before+row.elapsedSeconds;
      passageSecondsById.set(row.riderId,after);
      droppedFramesById.get(row.riderId).push({
        startDistanceM:slice.startDistanceM,
        endDistanceM:slice.endDistanceM,
        elapsedSecondsAtStart:before,durationSeconds:row.elapsedSeconds,
        riders:[{riderId:row.riderId,role:'dropped',
          positionBeforeM:slice.startDistanceM,
          positionM:slice.endDistanceM,activeSeconds:row.elapsedSeconds,
          activeDistanceM:slice.lengthM,shelteredSeconds:0,
          shelteredDistanceM:0,energyAtDecision:row.energyBefore,
          energySpent:row.energySpent,energyAfter:row.energyAfter,
          elapsedToLineSeconds:slice.endDistanceM===finishM?after:null}]});
    }
    states=step.riders.map(row=>({riderId:row.riderId,
      deficitSeconds:row.deficitSecondsAfter,energy:row.energyAfter}));
  });
  const isolatedBands=states.map(state=>({
    roadBandId:`isolated:${state.riderId}`,
    runner:{frames:droppedFramesById.get(state.riderId),
      finishers:[{riderId:state.riderId,
        teamId:teamById.get(state.riderId),
        elapsedSecondsFromLastKmStart:
          passageSecondsById.get(state.riderId),
        energyAtLine:state.energy}]}}));
  const bandRunners=[{roadBandId:'peloton',runner:bunchRunner},
    ...isolatedBands];
  const overlapAudit=recordFinaleUnorderedBandOverlapAudit(bandRunners);
  const conditionalCrossings=[...bunchRunner.finishers,
    ...isolatedBands.flatMap(band=>band.runner.finishers)];
  if(conditionalCrossings.length!==roster.length||
    new Set(conditionalCrossings.map(row=>row.riderId)).size!==roster.length)
    throw new Error('The named dropped line lost a locked rider.');
  const provisionalLineOrder=overlapAudit.firstPotentialOverlap?
    null:positionedLineOrder(conditionalCrossings);
  return {version,
    sourceRoadTraceVersion,sourceSprintPlanVersion:sprintPlan.version,
    startDistanceM:finishM-500,lineDistanceM:finishM,
    sprintPlan,positionedSource,bandRunners,conditionalCrossings,
    overlapAudit,provisionalLineOrder,
    roadStatus:overlapAudit.firstPotentialOverlap?
      'conditional_named_dropped_contact_unresolved':
      'conditional_named_dropped_lines_separated',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleNamedDroppedIndividualLine(tour,road,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleNamedDroppedIndividualLine(tour,road,input)))
    throw new Error('The named dropped individual line does not replay.');
  return true;
}

export function validateFinaleNamedMultipleDroppedIndividualLine(tour,road,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleNamedMultipleDroppedIndividualLine(tour,road,input)))
    throw new Error('The named multiple-dropped line does not replay.');
  return true;
}
