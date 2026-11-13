import {isDeepStrictEqual} from 'node:util';
import {recordFinaleGroupResultBounds} from './finale-group-result-bounds.mjs';
import {resolveFinaleMultibandPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {recordFinaleMultibandSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {recordFinalePositionedBandRunnerFromTour,
  positionedLineOrder} from './finale-paid-bunch-runner.mjs';
import {recordFinaleMultibandOverlapAudit} from
  './finale-multiband-overlap-audit.mjs';
import {recordFinalePre500ActiveOverlapAudit} from
  './finale-pre500-active-overlap-audit.mjs';
import {paidSoloSprintPassage} from './finale-solo-sprint-work.mjs';

export const FINALE_SINGLETON_FRONT_INDIVIDUAL_LINE_VERSION=
  'v2-finale-singleton-front-individual-line-lab-1';
export const FINALE_SINGLETON_FRONT_SPRINT_LINE_VERSION=
  'v2-finale-singleton-front-individual-line-lab-2';
const EPSILON=1e-7;

// A lone front rider already has individually paid passages in the group
// clock. Retain that trajectory when they are not nominated to sprint; the
// bunch uses the existing paid rider-level sprint/lead-out runner. Cross-band
// encounters are audited, never silently merged or awarded.
export function recordFinaleSingletonFrontIndividualLine(tour,clock,
  {plans=null}={}){
  recordFinaleGroupResultBounds(tour,clock,{
    chasePullRiderId:clock?.line?.chasePullRiderId??null,
    chaseRotationRiderIds:clock?.line?.chaseRotationRiderIds??null});
  const finishM=tour.route.distanceKm*1000;
  const frames=clock.line.approachFrames;
  const at500=frames.find(frame=>frame.endDistanceM===finishM-500);
  const before500=frames.filter(frame=>frame.endDistanceM<=finishM-500);
  const after500=frames.filter(frame=>frame.endDistanceM>finishM-500);
  const frontId=at500?.roadGroups[0]?.riderIds[0];
  const frontGroupId=at500?.roadGroups[0]?.id;
  const positioned=resolveFinaleMultibandPositionedSource(tour);
  if(clock.line.outcome!=='survived'||frames.some(frame=>frame.event)||
    clock.line.mergedFrames.length||before500.length!==2||
    after500.length!==5||after500.some(frame=>
      frame.endDistanceM-frame.startDistanceM!==100)||
    at500.roadGroups.length!==1||
    at500.roadGroups[0].riderIds.length!==1||
    positioned.roadBands.length!==2||
    positioned.roadBands[0].id!==frontGroupId||
    positioned.roadBands[0].slots.length!==1||
    positioned.roadBands[1].slots.length!==
      at500.pelotonRiderIds.length)
    throw new Error('A singleton individual line needs one paid solo and bunch.');
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const sprintPlan=recordFinaleMultibandSprintPlanFromTour(tour,{
    source:{endDistanceM:finishM-500,
      roadGroups:at500.roadGroups,
      pelotonRiderIds:at500.pelotonRiderIds,
      riderEnergy:at500.riders.map(row=>({
        riderId:row.riderId,energyAfter:row.energy}))},
    plans:nominations,sourceRoadTraceVersion:clock.version});
  const frontFinisher=sprintPlan.decisions.some(row=>
    row.finisherId===frontId);
  const frontTeam=tour.committedInputs.teams.find(team=>
    team.riders.some(rider=>rider.id===frontId));
  const frontRider=frontTeam?.riders.find(rider=>rider.id===frontId);
  if(!frontRider)
    throw new Error('The singleton has no locked rider.');
  const frontAt500=at500.riders.find(row=>row.riderId===frontId);
  const frontLineEnergy=clock.line.finalRiderEnergy.find(row=>
    row.riderId===frontId)?.energy;
  let frontTime=clock.frontLineTime-after500.reduce((sum,frame)=>
    sum+frame.frontElapsedSeconds,0);
  let frontEnergy=frontAt500?.energy;
  if(!Number.isFinite(frontTime)||!Number.isFinite(frontEnergy)||
    !Number.isFinite(frontLineEnergy))
    throw new Error('The singleton has no paid 500 m source energy.');
  const soloFrames=after500.map(frame=>{
    const row=frame.riders.find(rider=>rider.riderId===frontId);
    const sprint=frontFinisher&&frame.startDistanceM>=finishM-300;
    const segment=tour.route.kilometres[frame.sourceKm-1];
    const paidSprint=sprint?paidSoloSprintPassage(frontRider,segment,
      frontEnergy):null;
    const seconds=sprint?paidSprint.durationSeconds:
      frame.frontElapsedSeconds;
    const energySpent=sprint?paidSprint.energySpent:row?.energySpent;
    const energyAfter=sprint?paidSprint.energyAfter:row?.energy;
    if(sprint&&energySpent>frontEnergy+EPSILON)
      throw new Error('The singleton cannot pay for the nominated sprint.');
    if(!row||!Number.isFinite(seconds)||seconds<=0||
      !Number.isFinite(energySpent)||energySpent<0||
      !Number.isFinite(energyAfter)||energyAfter<0||
      energySpent>frontEnergy+EPSILON||
      !sprint&&Math.abs(frontEnergy-energySpent-energyAfter)>EPSILON)
      throw new Error('The singleton has unpaid final-500 m travel.');
    const result={startDistanceM:frame.startDistanceM,
      endDistanceM:frame.endDistanceM,
      elapsedSecondsAtStart:frontTime,durationSeconds:seconds,
      riders:[{riderId:frontId,role:sprint?'solo_sprint':'solo_front',
        positionBeforeM:frame.startDistanceM,
        positionM:frame.endDistanceM,
        activeSeconds:seconds,activeDistanceM:100,
        shelteredSeconds:0,shelteredDistanceM:0,
        energyAtDecision:frontEnergy,energySpent,
        energyAfter:Math.max(0,energyAfter),
        elapsedToLineSeconds:frame.endDistanceM===finishM?
          frontTime+seconds:null}]};
    frontTime+=seconds;
    frontEnergy=Math.max(0,energyAfter);
    return result;
  });
  if(!frontFinisher&&(Math.abs(frontTime-clock.frontLineTime)>EPSILON||
    Math.abs(frontEnergy-frontLineEnergy)>EPSILON))
    throw new Error('The solo conditional crossing differs from paid road.');
  const frontRunner={roadBandId:frontGroupId,
    paidTo500Seconds:soloFrames[0].elapsedSecondsAtStart,
    runner:{frames:soloFrames,finishers:[{riderId:frontId,
      teamId:frontTeam.id,
      elapsedSecondsFromLastKmStart:frontTime,
      energyAtLine:frontEnergy}]}};
  const bunchBand=positioned.roadBands[1];
  const bunchTime=before500.reduce((sum,frame)=>
    sum+frame.pelotonElapsedSeconds,0);
  const source={distanceM:finishM-500,
    pelotonRiderIds:at500.pelotonRiderIds,
    riderEnergy:at500.riders.filter(row=>
      at500.pelotonRiderIds.includes(row.riderId)).map(row=>({
      riderId:row.riderId,energy:row.energy})),
    bunchElapsedSeconds:bunchTime,
    sourceRoadTraceVersion:clock.version};
  const positionedSource={version:positioned.version,
    status:positioned.status,distanceM:source.distanceM,
    wheelSpacingM:positioned.wheelSpacingM,
    slots:bunchBand.slots.map(slot=>({...slot,
      positionM:slot.positionM+500,
      energy:source.riderEnergy.find(row=>
        row.riderId===slot.riderId).energy}))};
  const bunchRunner={roadBandId:bunchBand.id,
    paidTo500Seconds:bunchTime,
    runner:recordFinalePositionedBandRunnerFromTour(tour,{
      source,positionedSource,branch:'bunch_band',
      plan:{...sprintPlan,decisions:sprintPlan.decisions.filter(row=>
        at500.pelotonRiderIds.includes(row.finisherId))}})};
  const bandRunners=[frontRunner,bunchRunner];
  const conditionalCrossings=bandRunners.flatMap(band=>
    band.runner.finishers.map(row=>({...row,
      roadBandId:band.roadBandId})));
  const roster=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  if(conditionalCrossings.length!==roster.length||
    new Set(conditionalCrossings.map(row=>row.riderId)).size!==roster.length||
    conditionalCrossings.some(row=>!roster.includes(row.riderId)))
    throw new Error('The singleton line lost a locked rider.');
  let priorFront=positioned.roadBands[0]
    .passageSecondsFromBunchMarker;
  let priorBunch=0;
  const pre500Audit=recordFinalePre500ActiveOverlapAudit(positioned,
    before500.map(frame=>{
      priorFront+=frame.frontElapsedSeconds;
      priorBunch+=frame.pelotonElapsedSeconds;
      return {endDistanceM:frame.endDistanceM,
        bandTimes:[priorFront,priorBunch],
        riderEnergy:frame.riders};
    }));
  const overlapAudit=recordFinaleMultibandOverlapAudit(bandRunners);
  const provisionalLineOrder=pre500Audit.firstPotentialOverlap||
    overlapAudit.firstPotentialOverlap?null:
      positionedLineOrder(conditionalCrossings);
  return {version:frontFinisher?FINALE_SINGLETON_FRONT_SPRINT_LINE_VERSION:
    FINALE_SINGLETON_FRONT_INDIVIDUAL_LINE_VERSION,
    sourceClockVersion:clock.version,
    sourcePositionVersion:positioned.version,
    startDistanceM:positioned.startDistanceM,
    lineDistanceM:finishM,positionedSource:positioned,
    sprintPlan,bandRunners,conditionalCrossings,
    pre500Audit,overlapAudit,provisionalLineOrder,
    roadStatus:frontFinisher?
      'solo_paid_sprint_bunch_individual_contact_unresolved':
      'solo_paid_band_bunch_individual_contact_unresolved',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleSingletonFrontIndividualLine(tour,clock,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleSingletonFrontIndividualLine(tour,clock,input)))
    throw new Error('The singleton front individual line does not replay.');
  return true;
}
