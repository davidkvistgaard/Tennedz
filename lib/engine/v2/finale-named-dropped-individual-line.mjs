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
import {validateFinaleNamedAttackDroppedRoadFromTour} from
  './finale-named-attack-dropped-road.mjs';

export const FINALE_NAMED_DROPPED_INDIVIDUAL_LINE_VERSION=
  'v2-finale-named-dropped-individual-line-lab-1';
const EPSILON=1e-7;

// The attack must already have been caught at the paid 500 m handoff. The
// remaining bunch uses the existing nominated-rider runner and its provisional
// wheels; the isolated rider keeps paying independent travel. Any possible
// cross-band encounter withholds even a provisional full-field order.
export function recordFinaleNamedDroppedIndividualLine(tour,road,
  {plans=null}={}){
  validateFinaleNamedAttackDroppedRoadFromTour(tour,
    {teamId:road?.attackIntent?.teamId},road);
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
    !Array.isArray(ids)||ids.length!==roster.length-1||
    dropped.length!==1||
    active.riderEnergy.length!==ids.length)
    throw new Error('The named dropped line needs a caught paid 500 m bunch.');
  const isolatedId=dropped[0].riderId;
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const sourceRoadTraceVersion=road.version;
  const sprintPlan=recordFinaleDepletedSprintPlanFromTour(tour,{
    source:{endDistanceM:finishM-500,roadGroups:[],
      pelotonRiderIds:ids,isolatedRiderIds:[isolatedId],
      riderEnergy:[...active.riderEnergy.map(row=>({
        riderId:row.riderId,energyAfter:row.energyAfter})),
      {riderId:isolatedId,energyAfter:dropped[0].energyAfter}]},
    plans:nominations,sourceRoadTraceVersion});
  const virtualTour={...tour,committedInputs:{...tour.committedInputs,
    teams:tour.committedInputs.teams.map(team=>({...team,
      riders:team.riders.filter(rider=>rider.id!==isolatedId)}))}};
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
  let state={riderId:isolatedId,
    deficitSeconds:dropped[0].deficitSecondsAfter,
    energy:dropped[0].energyAfter};
  let passageSeconds=at500.bunchElapsedSecondsFromMarker+
    state.deficitSeconds;
  const droppedFrames=grid.map((slice,index)=>{
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
      droppedRiders:[state],ridersById});
    const row=step.riders[0];
    const before=passageSeconds;
    passageSeconds+=row.elapsedSeconds;
    state={riderId:isolatedId,
      deficitSeconds:row.deficitSecondsAfter,
      energy:row.energyAfter};
    return {startDistanceM:slice.startDistanceM,
      endDistanceM:slice.endDistanceM,
      elapsedSecondsAtStart:before,durationSeconds:row.elapsedSeconds,
      riders:[{riderId:isolatedId,role:'dropped',
        positionBeforeM:slice.startDistanceM,
        positionM:slice.endDistanceM,activeSeconds:row.elapsedSeconds,
        activeDistanceM:slice.lengthM,shelteredSeconds:0,
        shelteredDistanceM:0,energyAtDecision:row.energyBefore,
        energySpent:row.energySpent,energyAfter:row.energyAfter,
        elapsedToLineSeconds:slice.endDistanceM===finishM?
          passageSeconds:null}]};
  });
  const isolatedRunner={frames:droppedFrames,
    finishers:[{riderId:isolatedId,
      teamId:tour.committedInputs.teams.find(team=>
        team.riders.some(rider=>rider.id===isolatedId)).id,
      elapsedSecondsFromLastKmStart:passageSeconds,
      energyAtLine:state.energy}]};
  const bandRunners=[{roadBandId:'peloton',runner:bunchRunner},
    {roadBandId:`isolated:${isolatedId}`,runner:isolatedRunner}];
  const overlapAudit=recordFinaleUnorderedBandOverlapAudit(bandRunners);
  const conditionalCrossings=[...bunchRunner.finishers,
    ...isolatedRunner.finishers];
  const provisionalLineOrder=overlapAudit.firstPotentialOverlap?
    null:positionedLineOrder(conditionalCrossings);
  return {version:FINALE_NAMED_DROPPED_INDIVIDUAL_LINE_VERSION,
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
