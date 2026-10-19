import {isDeepStrictEqual} from 'node:util';
import {recordFinaleDepletedSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {resolveIndependentBunchSource} from
  './finale-positioned-source.mjs';
import {recordFinalePositionedBandRunnerFromTour,
  positionedLineOrder} from './finale-paid-bunch-runner.mjs';
import {recordFinaleUnorderedBandOverlapAudit} from
  './finale-multiband-overlap-audit.mjs';
import {validateFinaleNamedAttackDroppedRoadFromTour} from
  './finale-named-attack-dropped-road.mjs';
import {paidSoloSprintPassage} from './finale-solo-sprint-work.mjs';

export const FINALE_NAMED_DROPPED_SURVIVOR_LINE_VERSION=
  'v2-finale-named-dropped-survivor-line-lab-1';
const EPSILON=1e-7;

// Keep the already paid isolated passages. A nominated solo uses the same
// exposed sprint work as the singleton front; the bunch uses its paid runner.
// If that bunch might meet either other band, its conditional crossings must
// not be presented as a full-field order or points.
export function recordFinaleNamedDroppedSurvivorLine(tour,road,
  {plans=null}={}){
  validateFinaleNamedAttackDroppedRoadFromTour(tour,
    {teamId:road?.attackIntent?.teamId},road);
  const finishM=tour.route.distanceKm*1000;
  const at500=road.frames.find(frame=>frame.distanceM===finishM-500);
  const after500=road.frames.filter(frame=>frame.distanceM>finishM-500);
  const front=at500?.active.roadGroups[0];
  const soloId=front?.riderIds[0];
  const droppedId=at500?.droppedTravel.riders[0]?.riderId;
  const activeIds=at500?.active.pelotonRiderIds;
  const roster=tour.committedInputs.teams.flatMap(team=>team.riders);
  if(!front||at500.active.roadGroups.length!==1||
    front.riderIds.length!==1||!droppedId||
    after500.length!==5||
    after500.some(frame=>frame.active.catchDistanceM||
      frame.active.roadGroups.length!==1||
      frame.active.roadGroups[0].id!==front.id||
      frame.active.roadGroups[0].riderIds[0]!==soloId)||
    activeIds.length!==roster.length-2||
    road.line.bands[0]?.riderIds[0]!==soloId)
    throw new Error('The named dropped survivor needs three separate paid bands.');
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const sprintPlan=recordFinaleDepletedSprintPlanFromTour(tour,{
    source:{endDistanceM:finishM-500,
      roadGroups:[front],pelotonRiderIds:activeIds,
      isolatedRiderIds:[droppedId],
      riderEnergy:[...at500.active.riderEnergy.map(row=>({
        riderId:row.riderId,energyAfter:row.energyAfter})),
      {riderId:droppedId,energyAfter:at500.droppedTravel.riders[0]
        .energyAfter}]},
    plans:nominations,sourceRoadTraceVersion:road.version});
  const soloFinisher=sprintPlan.decisions.some(row=>
    row.finisherId===soloId);
  const soloRider=roster.find(rider=>rider.id===soloId);
  const virtualTour={...tour,committedInputs:{...tour.committedInputs,
    teams:tour.committedInputs.teams.map(team=>({...team,
      riders:team.riders.filter(rider=>
        rider.id!==soloId&&rider.id!==droppedId)}))}};
  const positionedSource=resolveIndependentBunchSource(virtualTour,{
    version:road.version,at500M:{distanceM:finishM-500,
      roadGroups:[],pelotonRiderIds:activeIds},frames:[]},
  sprintPlan);
  const bunchRunner=recordFinalePositionedBandRunnerFromTour(tour,{
    source:{distanceM:finishM-500,pelotonRiderIds:activeIds,
      riderEnergy:at500.active.riderEnergy.filter(row=>
        activeIds.includes(row.riderId)).map(row=>({
        riderId:row.riderId,energy:row.energyAfter})),
      bunchElapsedSeconds:at500.bunchElapsedSecondsFromMarker,
      sourceRoadTraceVersion:road.version},
    plan:{...sprintPlan,decisions:sprintPlan.decisions.filter(row=>
      activeIds.includes(row.finisherId))},positionedSource,
    branch:'bunch_band'});
  const teamById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  let frontTime=at500.bunchElapsedSecondsFromMarker-front.gapSeconds;
  let frontEnergy=at500.active.riderEnergy.find(row=>
    row.riderId===soloId).energyAfter;
  const soloFrames=after500.map(frame=>{
    const row=frame.active.riderEnergy.find(value=>
      value.riderId===soloId);
    const sprint=soloFinisher&&
      frame.active.startDistanceM>=finishM-300;
    const segment=tour.route.kilometres[frame.active.sourceKm-1];
    const paidSprint=sprint?paidSoloSprintPassage(soloRider,segment,
      frontEnergy):null;
    const seconds=sprint?paidSprint.durationSeconds:
      360/frame.active.frontSpeedKph;
    const energySpent=sprint?paidSprint.energySpent:row?.energySpent;
    const energyAfter=sprint?paidSprint.energyAfter:row?.energyAfter;
    if(sprint&&energySpent>frontEnergy+EPSILON)
      throw new Error('The named solo cannot pay for the nominated sprint.');
    if(!row||!Number.isFinite(seconds)||seconds<=0||
      !Number.isFinite(frontEnergy)||
      !Number.isFinite(energySpent)||energySpent<0||
      !Number.isFinite(energyAfter)||energyAfter<0||
      energySpent>frontEnergy+EPSILON||
      !sprint&&(Math.abs(frontEnergy-row.energyAtDecision)>EPSILON||
        Math.abs(frontEnergy-energySpent-energyAfter)>EPSILON))
      throw new Error('The named solo has no paid final-500 m travel.');
    const result={startDistanceM:frame.active.startDistanceM,
      endDistanceM:frame.distanceM,
      elapsedSecondsAtStart:frontTime,durationSeconds:seconds,
      riders:[{riderId:soloId,role:sprint?'solo_sprint':'solo_front',
        positionBeforeM:frame.active.startDistanceM,
        positionM:frame.distanceM,activeSeconds:seconds,
        activeDistanceM:100,shelteredSeconds:0,shelteredDistanceM:0,
        energyAtDecision:frontEnergy,energySpent,
        energyAfter:Math.max(0,energyAfter),
        elapsedToLineSeconds:frame.distanceM===finishM?
          frontTime+seconds:null}]};
    frontTime+=seconds;
    frontEnergy=Math.max(0,energyAfter);
    return result;
  });
  const frontAtLine=road.frames.at(-1);
  if(!soloFinisher&&Math.abs(frontTime-(
    frontAtLine.bunchElapsedSecondsFromMarker-
    frontAtLine.active.roadGroups[0].gapSeconds))>EPSILON)
    throw new Error('The named solo line differs from paid road.');
  let droppedTime=at500.bunchElapsedSecondsFromMarker+
    at500.droppedTravel.riders[0].deficitSecondsAfter;
  let droppedEnergy=at500.droppedTravel.riders[0].energyAfter;
  const droppedFrames=after500.map(frame=>{
    const row=frame.droppedTravel.riders.find(value=>
      value.riderId===droppedId);
    if(!row||Math.abs(row.energyBefore-droppedEnergy)>EPSILON||
      Math.abs(row.energyBefore-row.energySpent-row.energyAfter)>EPSILON)
      throw new Error('The isolated rider has no paid final-500 m travel.');
    const result={startDistanceM:frame.droppedTravel.startDistanceM,
      endDistanceM:frame.distanceM,
      elapsedSecondsAtStart:droppedTime,
      durationSeconds:row.elapsedSeconds,
      riders:[{riderId:droppedId,role:'dropped',
        positionBeforeM:frame.droppedTravel.startDistanceM,
        positionM:frame.distanceM,activeSeconds:row.elapsedSeconds,
        activeDistanceM:100,shelteredSeconds:0,shelteredDistanceM:0,
        energyAtDecision:droppedEnergy,energySpent:row.energySpent,
        energyAfter:row.energyAfter,
        elapsedToLineSeconds:frame.distanceM===finishM?
          droppedTime+row.elapsedSeconds:null}]};
    droppedTime+=row.elapsedSeconds;
    droppedEnergy=row.energyAfter;
    return result;
  });
  if(Math.abs(droppedTime-(frontAtLine.bunchElapsedSecondsFromMarker+
    frontAtLine.droppedTravel.riders[0].deficitSecondsAfter))>EPSILON)
    throw new Error('The isolated line differs from paid road.');
  const bandRunners=[{roadBandId:front.id,
    runner:{frames:soloFrames,finishers:[{riderId:soloId,
      teamId:teamById.get(soloId),
      elapsedSecondsFromLastKmStart:frontTime,
      energyAtLine:frontEnergy}]}},
  {roadBandId:'peloton',runner:bunchRunner},
  {roadBandId:`isolated:${droppedId}`,
    runner:{frames:droppedFrames,finishers:[{riderId:droppedId,
      teamId:teamById.get(droppedId),
      elapsedSecondsFromLastKmStart:droppedTime,
      energyAtLine:droppedEnergy}]}}];
  const conditionalCrossings=bandRunners.flatMap(band=>
    band.runner.finishers);
  if(conditionalCrossings.length!==roster.length||
    new Set(conditionalCrossings.map(row=>row.riderId)).size!==
      roster.length)
    throw new Error('The named survivor line lost a locked rider.');
  const overlapAudit=recordFinaleUnorderedBandOverlapAudit(bandRunners);
  return {version:FINALE_NAMED_DROPPED_SURVIVOR_LINE_VERSION,
    sourceRoadTraceVersion:road.version,
    startDistanceM:finishM-500,lineDistanceM:finishM,
    sprintPlan,positionedSource,bandRunners,conditionalCrossings,
    overlapAudit,
    provisionalLineOrder:overlapAudit.firstPotentialOverlap?
      null:positionedLineOrder(conditionalCrossings),
    roadStatus:overlapAudit.firstPotentialOverlap?
      'conditional_named_survivor_contact_unresolved':
      'conditional_named_survivor_lines_separated',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleNamedDroppedSurvivorLine(tour,road,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleNamedDroppedSurvivorLine(tour,road,input)))
    throw new Error('The named dropped survivor line does not replay.');
  return true;
}
