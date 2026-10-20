import {isDeepStrictEqual} from 'node:util';
import {validateFinaleDepletedLastKmClock,
  validateFinaleNoFrontDroppedLastKmClock,
  validateFinaleCoastDroppedLastKmClock,
  validateFinaleCoastNoFrontDroppedLastKmClock,
  validateFinaleCoastDynamicNoFrontLastKmClock,
  validateFinaleCoastDynamicFrontLastKmClock,
  validateFinaleCoastDynamicActiveLastKmClock,
  validateFinaleCoastDynamicSingleLastKmClock,
  FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_CLOCK_VERSION,
  FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_CLOCK_VERSION,
  FINALE_COAST_DYNAMIC_FRONT_LAST_KM_CLOCK_VERSION,
  FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_CLOCK_VERSION,
  FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_CLOCK_VERSION,
  FINALE_COAST_DROPPED_LAST_KM_CLOCK_VERSION} from
  './finale-separated-last-km.mjs';
import {resolveFinaleMultibandPositionedSource,
  resolveFinaleDynamicNoFrontPositionedSource,
  resolveFinaleDynamicFrontPositionedSource,
  resolveFinaleDynamicActivePositionedSource,
  resolveFinaleDynamicSinglePositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {recordFinaleDepletedSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {recordFinaleIndividualBandsAt500} from
  './finale-multiband-individual-line.mjs';
import {recordFinalePre500DroppedOverlapAudit} from
  './finale-pre500-active-overlap-audit.mjs';
import {recordFinaleUnorderedBandOverlapAudit} from
  './finale-multiband-overlap-audit.mjs';
import {positionedLineOrder} from './finale-paid-bunch-runner.mjs';

export const FINALE_DEPLETED_INDIVIDUAL_LINE_VERSION=
  'v2-finale-depleted-individual-line-lab-1';
export const FINALE_AUDITED_DROPPED_INDIVIDUAL_LINE_VERSION=
  'v2-finale-depleted-individual-line-lab-2';
export const FINALE_UNORDERED_DROPPED_INDIVIDUAL_LINE_VERSION=
  'v2-finale-depleted-individual-line-lab-3';
export const FINALE_COASTED_INDIVIDUAL_LINE_VERSION=
  'v2-finale-coasted-individual-line-lab-4';
export const FINALE_COAST_NO_FRONT_INDIVIDUAL_LINE_VERSION=
  'v2-finale-coast-no-front-individual-line-lab-5';
export const FINALE_COAST_DYNAMIC_NO_FRONT_INDIVIDUAL_LINE_VERSION=
  'v2-finale-coast-dynamic-no-front-individual-line-lab-6';
export const FINALE_COAST_DYNAMIC_FRONT_INDIVIDUAL_LINE_VERSION=
  'v2-finale-coast-dynamic-front-individual-line-lab-7';
export const FINALE_COAST_DYNAMIC_ACTIVE_INDIVIDUAL_LINE_VERSION=
  'v2-finale-coast-dynamic-active-individual-line-lab-8';
export const FINALE_COAST_SINGLETON_INDIVIDUAL_LINE_VERSION=
  'v2-finale-coast-singleton-individual-line-lab-9';
export const FINALE_COAST_DYNAMIC_SINGLE_INDIVIDUAL_LINE_VERSION=
  'v2-finale-coast-dynamic-single-individual-line-lab-10';
const EPSILON=1e-7;

// Use the already recorded isolated passage and energy for each dropped
// rider. No wheel, helper, or invented shared dropped-rider group is added.
function isolatedRunners(tour,clock,at500Passage){
  const coasted=[FINALE_COAST_DROPPED_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_FRONT_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_CLOCK_VERSION]
    .includes(clock.version);
  const finishM=tour.route.distanceKm*1000;
  const dropped=[FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_FRONT_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_CLOCK_VERSION]
    .includes(clock.version)?
    clock.trace.finalDroppedRiderIds:clock.trace.sourceDroppedRiderIds;
  const roster=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  const passages=clock.passageFrames.filter(frame=>
    frame.distanceM>=finishM-500);
  const traces=new Map(clock.trace.frames.map(frame=>
    [frame.endDistanceM,frame]));
  if(passages[0]!==at500Passage||
    passages.at(-1)?.distanceM!==finishM||
    passages.length!==6||
    dropped.length!==at500Passage.droppedPassages.length)
    throw new Error('The isolated riders need complete recorded passages.');
  return dropped.map(riderId=>{
    let previousTime=at500Passage.droppedPassages.find(row=>
      row.riderId===riderId)?.passageSecondsFromBunchMarker;
    let previousEnergy=traces.get(finishM-500)?.riders.find(row=>
      row.riderId===riderId)?.energy;
    if(!Number.isFinite(previousTime)||
      !Number.isFinite(previousEnergy))
      throw new Error('A dropped rider has no paid 500 m state.');
    const frames=[];
    for(let index=1;index<passages.length;index++){
      const before=passages[index-1].distanceM;
      const after=passages[index].distanceM;
      const row=passages[index].droppedPassages.find(value=>
        value.riderId===riderId);
      const energy=traces.get(after)?.riders.find(value=>
        value.riderId===riderId)?.energy;
      const seconds=row?.passageSecondsFromBunchMarker-previousTime;
      if(after-before!==100||!Number.isFinite(seconds)||
        seconds<=0||!Number.isFinite(energy)||
        (coasted?row.curtailedEnergyDemand<0||
          !Number.isFinite(row.curtailedEnergyDemand):
          row.unmetEnergyDemand>EPSILON)||
        Math.abs(previousEnergy-row.energySpent-energy)>EPSILON)
        throw new Error('A dropped rider has unpaid or discontinuous travel.');
      frames.push({startDistanceM:before,endDistanceM:after,
        elapsedSecondsAtStart:previousTime,durationSeconds:seconds,
        riders:[{riderId,role:'dropped',positionBeforeM:before,
          positionM:after,activeSeconds:seconds,activeDistanceM:100,
          shelteredSeconds:0,shelteredDistanceM:0,
          energyAtDecision:previousEnergy,energySpent:row.energySpent,
          energyAfter:energy,
          elapsedToLineSeconds:after===finishM?
            row.passageSecondsFromBunchMarker:null}]});
      previousTime=row.passageSecondsFromBunchMarker;
      previousEnergy=energy;
    }
    return {roadBandId:`isolated:${riderId}`,
      runner:{frames,finishers:[{riderId,teamId:roster.get(riderId),
        elapsedSecondsFromLastKmStart:previousTime,
        energyAtLine:previousEnergy}]}};
  });
}

// The active riders continue with the existing individual runner. The
// dropped riders keep their independent, paid last-kilometre trajectory.
// The first 500 m has no individual wheel/contact audit, so no combined
// result or point preview follows even when the final 500 m is separate.
export function recordFinaleDepletedIndividualLine(tour,clock,
  {plans=null}={}){
  const dynamicNoFront=clock?.version===
    FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_CLOCK_VERSION;
  const dynamicFront=clock?.version===
    FINALE_COAST_DYNAMIC_FRONT_LAST_KM_CLOCK_VERSION;
  const dynamicActive=clock?.version===
    FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_CLOCK_VERSION;
  const dynamicSingle=clock?.version===
    FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_CLOCK_VERSION;
  const coastNoFront=clock?.version===
    FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_CLOCK_VERSION||dynamicNoFront;
  const coasted=coastNoFront||dynamicFront||dynamicActive||
    dynamicSingle||clock?.version===
    FINALE_COAST_DROPPED_LAST_KM_CLOCK_VERSION;
  const noFront=coastNoFront||
    clock?.line?.outcome==='bunch_with_dropped_reserve';
  if(dynamicSingle)
    validateFinaleCoastDynamicSingleLastKmClock(tour,clock);
  else if(dynamicActive)
    validateFinaleCoastDynamicActiveLastKmClock(tour,clock);
  else if(dynamicFront)
    validateFinaleCoastDynamicFrontLastKmClock(tour,clock);
  else if(dynamicNoFront)
    validateFinaleCoastDynamicNoFrontLastKmClock(tour,clock);
  else if(coastNoFront)
    validateFinaleCoastNoFrontDroppedLastKmClock(tour,clock);
  else if(coasted)validateFinaleCoastDroppedLastKmClock(tour,clock);
  else if(noFront)validateFinaleNoFrontDroppedLastKmClock(tour,clock);
  else validateFinaleDepletedLastKmClock(tour,clock);
  const finishM=tour.route.distanceKm*1000;
  if(clock.passageFrames.some(frame=>frame.droppedPassages.some(row=>
    row.unmetEnergyDemand>EPSILON)))
    throw new Error('The depleted individual line has unmet energy demand.');
  const positioned=dynamicSingle?
    resolveFinaleDynamicSinglePositionedSource(tour,clock):
    dynamicActive?
    resolveFinaleDynamicActivePositionedSource(tour,clock):
    dynamicFront?
    resolveFinaleDynamicFrontPositionedSource(tour,clock):
    dynamicNoFront?
    resolveFinaleDynamicNoFrontPositionedSource(tour,clock):
    resolveFinaleMultibandPositionedSource(tour,{
      includeDropped:true,allowNoFront:noFront});
  const at500=clock.trace.frames.find(frame=>
    frame.endDistanceM===finishM-500);
  const passage=clock.passageFrames.find(frame=>
    frame.distanceM===finishM-500);
  if(!at500||!passage||
    passage.groups.length!==positioned.roadBands.length-1||
    passage.groups.some((group,index)=>group.id!==
      positioned.roadBands[index].id))
    throw new Error('The depleted line has no paid 500 m passage.');
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const sprintPlan=recordFinaleDepletedSprintPlanFromTour(tour,{
    source:{endDistanceM:finishM-500,
      roadGroups:at500.roadGroups,
      pelotonRiderIds:at500.pelotonRiderIds,
      isolatedRiderIds:positioned.droppedRiderIds,
      riderEnergy:at500.riders.map(row=>({
        riderId:row.riderId,energyAfter:row.energy}))},
    plans:nominations,sourceRoadTraceVersion:clock.version});
  const coastedSingleton=coasted&&!dynamicFront&&!dynamicActive&&
    positioned.roadBands.slice(0,-1).some(band=>band.slots.length===1);
  const handoff=recordFinaleIndividualBandsAt500(tour,{
    positioned,at500,sourceRoadTraceVersion:clock.version,
    passageTimes:[...passage.groups.map(group=>
      group.passageSecondsFromBunchMarker),
    passage.bunchPassageSecondsFromBunchMarker],
    isolatedSprintPlan:sprintPlan,
    isolatedBandRunners:isolatedRunners(tour,clock,passage),
    singletonRoad:dynamicActive||dynamicFront||dynamicSingle||
      coastedSingleton?{
      trace:clock.trace,passageAtLine:clock.passageFrames.at(-1)}:null,
    withholdProvisionalOrder:true});
  return {version:dynamicSingle?
    FINALE_COAST_DYNAMIC_SINGLE_INDIVIDUAL_LINE_VERSION:
    dynamicActive?
    FINALE_COAST_DYNAMIC_ACTIVE_INDIVIDUAL_LINE_VERSION:
    dynamicFront?
    FINALE_COAST_DYNAMIC_FRONT_INDIVIDUAL_LINE_VERSION:
    dynamicNoFront?
    FINALE_COAST_DYNAMIC_NO_FRONT_INDIVIDUAL_LINE_VERSION:
    coastedSingleton?
    FINALE_COAST_SINGLETON_INDIVIDUAL_LINE_VERSION:
    coastNoFront?
    FINALE_COAST_NO_FRONT_INDIVIDUAL_LINE_VERSION:
    coasted?FINALE_COASTED_INDIVIDUAL_LINE_VERSION:
    FINALE_DEPLETED_INDIVIDUAL_LINE_VERSION,
    sourceClockVersion:clock.version,
    sourcePositionVersion:positioned.version,
    startDistanceM:positioned.startDistanceM,
    lineDistanceM:finishM,positionedSource:positioned,
    ...handoff,pre500ContactStatus:'unresolved',
    roadStatus:'conditional_isolated_and_active_lines_contact_unresolved',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleDepletedIndividualLine(tour,clock,input,
  recorded){
  const expected=[FINALE_COASTED_INDIVIDUAL_LINE_VERSION,
    FINALE_COAST_NO_FRONT_INDIVIDUAL_LINE_VERSION,
    FINALE_COAST_DYNAMIC_NO_FRONT_INDIVIDUAL_LINE_VERSION,
    FINALE_COAST_DYNAMIC_FRONT_INDIVIDUAL_LINE_VERSION,
    FINALE_COAST_DYNAMIC_ACTIVE_INDIVIDUAL_LINE_VERSION,
    FINALE_COAST_SINGLETON_INDIVIDUAL_LINE_VERSION,
    FINALE_COAST_DYNAMIC_SINGLE_INDIVIDUAL_LINE_VERSION]
    .includes(recorded?.version)?
    recordFinaleCoastedIndividualLine(tour,clock,input):recorded?.version===
    FINALE_UNORDERED_DROPPED_INDIVIDUAL_LINE_VERSION?
    recordFinaleUnorderedDroppedIndividualLine(tour,clock,input):
    recorded?.version===FINALE_AUDITED_DROPPED_INDIVIDUAL_LINE_VERSION?
      recordFinaleAuditedDroppedIndividualLine(tour,clock,input):
      recordFinaleDepletedIndividualLine(tour,clock,input);
  if(!isDeepStrictEqual(recorded,expected))
    throw new Error('The depleted individual line does not replay.');
  return true;
}

// The older lab-1 line remains replayable. This opt-in version checks the
// already paid first 500 m for possible contact with isolated riders before
// exposing an individual provisional order. All wheels remain inferred.
export function recordFinaleAuditedDroppedIndividualLine(tour,clock,
  input={}){
  const prior=recordFinaleDepletedIndividualLine(tour,clock,input);
  const pre500Audit=recordFinalePre500DroppedOverlapAudit(tour,clock,
    prior.positionedSource);
  const separated=pre500Audit.firstPotentialOverlap===null&&
    prior.overlapAudit.firstPotentialOverlap===null;
  return {...prior,
    version:FINALE_AUDITED_DROPPED_INDIVIDUAL_LINE_VERSION,
    pre500Audit,
    pre500ContactStatus:separated?
      'provisional_separated':'potential_longitudinal_overlap',
    roadStatus:separated?
      'conditional_isolated_and_active_lines_separated':
      prior.roadStatus,
    provisionalLineOrder:separated?
      positionedLineOrder(prior.conditionalCrossings):null};
}

// A dropped rider's ID says nothing about their order along the road. This
// opt-in revision checks signed separation in both paid halves, preserving
// lab-1 and lab-2 recordings for replay.
export function recordFinaleUnorderedDroppedIndividualLine(tour,clock,
  input={}){
  const prior=recordFinaleDepletedIndividualLine(tour,clock,input);
  const pre500Audit=recordFinalePre500DroppedOverlapAudit(tour,clock,
    prior.positionedSource,{unordered:true});
  const overlapAudit=recordFinaleUnorderedBandOverlapAudit(
    prior.bandRunners);
  const separated=pre500Audit.firstPotentialOverlap===null&&
    overlapAudit.firstPotentialOverlap===null;
  return {...prior,
    version:FINALE_UNORDERED_DROPPED_INDIVIDUAL_LINE_VERSION,
    pre500Audit,overlapAudit,
    pre500ContactStatus:separated?
      'provisional_separated':'potential_longitudinal_overlap',
    roadStatus:separated?
      'conditional_isolated_and_active_lines_separated':
      prior.roadStatus,
    provisionalLineOrder:separated?
      positionedLineOrder(prior.conditionalCrossings):null};
}

// The v93 source pays curtailed work as slower travel before the sprint.
// Retain the same isolated rider passages and audit every band before a
// conditional individual order is exposed.
export function recordFinaleCoastedIndividualLine(tour,clock,input={}){
  const dynamicNoFront=clock?.version===
    FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_CLOCK_VERSION;
  const dynamicFront=clock?.version===
    FINALE_COAST_DYNAMIC_FRONT_LAST_KM_CLOCK_VERSION;
  const dynamicActive=clock?.version===
    FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_CLOCK_VERSION;
  const dynamicSingle=clock?.version===
    FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_CLOCK_VERSION;
  if(![FINALE_COAST_DROPPED_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_FRONT_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_CLOCK_VERSION]
    .includes(clock?.version))
    throw new Error('The coasted individual line needs a v93 road clock.');
  const prior=recordFinaleDepletedIndividualLine(tour,clock,input);
  if(dynamicSingle)return {...prior,
    pre500Audit:{status:'unresolved_new_front_drops',
      droppedRiderIds:[...clock.trace.finalDroppedRiderIds],
      contactResolved:false,pointsStatus:'withheld',
      canCommitAwards:false},
    pre500ContactStatus:'unresolved_new_front_drops',
    roadStatus:'conditional_front_drops_ahead_of_bunch_contact_unresolved',
    provisionalLineOrder:null};
  if(dynamicActive)return {...prior,
    pre500Audit:{status:'unresolved_active_bunch_drops',
      droppedRiderIds:clock.trace.finalDroppedRiderIds.filter(id=>
        !clock.trace.sourceDroppedRiderIds.includes(id)),
      contactResolved:false,pointsStatus:'withheld',
      canCommitAwards:false},
    pre500ContactStatus:'unresolved_active_bunch_drops',
    roadStatus:'conditional_front_and_new_bunch_drops_contact_unresolved',
    provisionalLineOrder:null};
  if(dynamicFront){
    const contactEvents=clock.passageFrames.flatMap(frame=>
      frame.droppedPassages.filter(row=>
        row.contactDistanceM!==null).map(row=>({
        riderId:row.riderId,distanceM:row.contactDistanceM,
        status:row.contactStatus})));
    return {...prior,
      pre500Audit:{status:'recorded_front_drop_bunch_pass',
        contactEvents,contactResolved:false,
        pointsStatus:'withheld',canCommitAwards:false},
      pre500ContactStatus:'recorded_front_drop_bunch_pass',
      roadStatus:'conditional_front_drop_bunch_contact_recorded',
      provisionalLineOrder:null};
  }
  if(dynamicNoFront)return {...prior,
    pre500Audit:{status:'unresolved_new_drops',
      firstPotentialOverlap:null,contactResolved:false,
      pointsStatus:'withheld',canCommitAwards:false},
    pre500ContactStatus:'unresolved_new_drops',
    roadStatus:'conditional_new_drops_contact_unresolved',
    provisionalLineOrder:null};
  const pre500Audit=recordFinalePre500DroppedOverlapAudit(tour,clock,
    prior.positionedSource,{unordered:true});
  const overlapAudit=recordFinaleUnorderedBandOverlapAudit(
    prior.bandRunners);
  const separated=pre500Audit.firstPotentialOverlap===null&&
    overlapAudit.firstPotentialOverlap===null;
  return {...prior,pre500Audit,overlapAudit,
    pre500ContactStatus:separated?
      'provisional_separated':'potential_longitudinal_overlap',
    roadStatus:separated?
      'conditional_isolated_and_active_lines_separated':prior.roadStatus,
    provisionalLineOrder:separated?
      positionedLineOrder(prior.conditionalCrossings):null};
}
