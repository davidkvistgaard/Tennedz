import {isDeepStrictEqual} from 'node:util';
import {validateFinaleDepletedLastKmClock,
  validateFinaleNoFrontDroppedLastKmClock,
  validateFinaleCoastDroppedLastKmClock,
  validateFinaleCoastNoFrontDroppedLastKmClock,
  validateFinaleCoastDynamicNoFrontLastKmClock,
  validateFinaleCoastDynamicFrontLastKmClock,
  validateFinaleCoastDissolvedLeadingLastKmClock,
  validateFinaleCoastDynamicActiveLastKmClock,
  validateFinaleCoastDynamicSingleLastKmClock,
  validateFinaleCoastFrontCatchLastKmClock,
  FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_CLOCK_VERSION,
  FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_CLOCK_VERSION,
  FINALE_COAST_DYNAMIC_FRONT_LAST_KM_CLOCK_VERSION,
  FINALE_COAST_DISSOLVED_LEADING_LAST_KM_CLOCK_VERSION,
  FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_CLOCK_VERSION,
  FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_CLOCK_VERSION,
  FINALE_COAST_FRONT_CATCH_LAST_KM_CLOCK_VERSION,
  FINALE_COAST_DROPPED_LAST_KM_CLOCK_VERSION} from
  './finale-separated-last-km.mjs';
import {resolveFinaleMultibandPositionedSource,
  resolveFinaleDynamicNoFrontPositionedSource,
  resolveFinaleDynamicFrontPositionedSource,
  resolveFinaleDynamicActivePositionedSource,
  resolveFinaleDynamicSinglePositionedSource,
  resolveFinaleFrontCatchPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {recordFinaleDepletedSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {recordFinaleIndividualBandsAt500} from
  './finale-multiband-individual-line.mjs';
import {recordFinalePre500DroppedOverlapAudit,
  recordFinalePre500IsolatedPasses,
  recordFinalePre500IsolatedParallel,
  recordFinaleFullKmIsolatedLanes,
  recordFinalePre500FrontExit} from
  './finale-pre500-active-overlap-audit.mjs';
import {recordFinaleUnorderedBandOverlapAudit} from
  './finale-multiband-overlap-audit.mjs';
import {positionedLineOrder,
  FINALE_COASTED_TAIL_BAND_RUNNER_VERSION} from
  './finale-paid-bunch-runner.mjs';

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
export const FINALE_COAST_ISOLATED_PASS_INDIVIDUAL_LINE_VERSION=
  'v2-finale-coast-isolated-pass-individual-line-lab-11';
export const FINALE_COAST_FRONT_EXIT_INDIVIDUAL_LINE_VERSION=
  'v2-finale-coast-front-exit-individual-line-lab-12';
export const FINALE_COAST_LATE_BUNCH_EXIT_INDIVIDUAL_LINE_VERSION=
  'v2-finale-coast-late-bunch-exit-individual-line-lab-13';
export const FINALE_COAST_FRONT_CATCH_INDIVIDUAL_LINE_VERSION=
  'v2-finale-coast-front-catch-individual-line-lab-14';
export const FINALE_COAST_TAIL_INDIVIDUAL_LINE_VERSION=
  'v2-finale-coast-tail-individual-line-lab-15';
export const FINALE_COAST_ISOLATED_PARALLEL_INDIVIDUAL_LINE_VERSION=
  'v2-finale-coast-isolated-parallel-individual-line-lab-16';
export const FINALE_COAST_FULL_KM_ISOLATED_LANES_LINE_VERSION=
  'v2-finale-coast-full-km-isolated-lanes-line-lab-17';
const EPSILON=1e-7;

// Use the already recorded isolated passage and energy for each dropped
// rider. No wheel, helper, or invented shared dropped-rider group is added.
function isolatedRunners(tour,clock,at500Passage){
  const coasted=[FINALE_COAST_DROPPED_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_FRONT_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DISSOLVED_LEADING_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_FRONT_CATCH_LAST_KM_CLOCK_VERSION]
    .includes(clock.version);
  const finishM=tour.route.distanceKm*1000;
  const dropped=[FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_FRONT_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DISSOLVED_LEADING_LAST_KM_CLOCK_VERSION,
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
  const lateExits=dynamicLateBunchExits(clock,finishM);
  const lateIds=new Set(lateExits.map(row=>row.riderId));
  if(passages[0]!==at500Passage||
    passages.at(-1)?.distanceM!==finishM||
    passages.length!==6||
    dropped.length!==at500Passage.droppedPassages.length+lateIds.size||
    lateExits.some(row=>row.atDistanceM<finishM-500||
      at500Passage.droppedPassages.some(p=>p.riderId===row.riderId)))
    throw new Error('The isolated riders need complete recorded passages.');
  return dropped.map(riderId=>{
    let previousTime=at500Passage.droppedPassages.find(row=>
      row.riderId===riderId)?.passageSecondsFromBunchMarker??
      (lateIds.has(riderId)?
        at500Passage.bunchPassageSecondsFromBunchMarker:undefined);
    let previousEnergy=traces.get(finishM-500)?.riders.find(row=>
      row.riderId===riderId)?.energy;
    if(!Number.isFinite(previousTime)||
      !Number.isFinite(previousEnergy))
      throw new Error('A dropped rider has no paid 500 m state.');
    const paidTo500Seconds=previousTime;
    const frames=[];
    for(let index=1;index<passages.length;index++){
      const before=passages[index-1].distanceM;
      const after=passages[index].distanceM;
      const trace=traces.get(after);
      const state=trace?.riders.find(value=>
        value.riderId===riderId);
      const paidDrop=passages[index].droppedPassages.find(value=>
        value.riderId===riderId);
      const inBunch=lateIds.has(riderId)&&
        trace?.pelotonRiderIds.includes(riderId);
      const row=paidDrop??(inBunch?{
        passageSecondsFromBunchMarker:
          passages[index].bunchPassageSecondsFromBunchMarker,
        energySpent:state?.energySpent,curtailedEnergyDemand:0}:null);
      const energy=state?.energy;
      const seconds=row?.passageSecondsFromBunchMarker-previousTime;
      if(after-before!==100||!row||!Number.isFinite(seconds)||
        seconds<=0||!Number.isFinite(energy)||
        inBunch&&state?.role!=='sheltered'||
        lateIds.has(riderId)&&!inBunch&&!paidDrop||
        (coasted?row.curtailedEnergyDemand<0||
          !Number.isFinite(row.curtailedEnergyDemand):
          row.unmetEnergyDemand>EPSILON)||
        Math.abs(previousEnergy-row.energySpent-energy)>EPSILON)
        throw new Error('A dropped rider has unpaid or discontinuous travel.');
      frames.push({startDistanceM:before,endDistanceM:after,
        elapsedSecondsAtStart:previousTime,durationSeconds:seconds,
        riders:[{riderId,role:inBunch?'sheltered':'dropped',
          positionBeforeM:before,
          positionM:after,activeSeconds:inBunch?0:seconds,
          activeDistanceM:inBunch?0:100,
          shelteredSeconds:inBunch?seconds:0,
          shelteredDistanceM:inBunch?100:0,
          energyAtDecision:previousEnergy,energySpent:row.energySpent,
          energyAfter:energy,
          elapsedToLineSeconds:after===finishM?
            row.passageSecondsFromBunchMarker:null}]});
      previousTime=row.passageSecondsFromBunchMarker;
      previousEnergy=energy;
    }
    return {roadBandId:`isolated:${riderId}`,
      ...(lateIds.has(riderId)?{paidTo500Seconds}:{}),
      runner:{frames,finishers:[{riderId,teamId:roster.get(riderId),
        elapsedSecondsFromLastKmStart:previousTime,
        energyAtLine:previousEnergy}]}};
  });
}

function dynamicLateBunchExits(clock,finishM){
  if(clock?.version!==FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_CLOCK_VERSION)
    return [];
  return clock.trace.frames.filter(frame=>
    frame.startDistanceM>=finishM-500).flatMap(frame=>
    frame.exhaustionDrops.map(row=>({riderId:row.riderId,
      atDistanceM:row.atDistanceM})));
}

// The active riders continue with the existing individual runner. The
// dropped riders keep their independent, paid last-kilometre trajectory.
// The first 500 m has no individual wheel/contact audit, so no combined
// result or point preview follows even when the final 500 m is separate.
export function recordFinaleDepletedIndividualLine(tour,clock,
  {plans=null}={}){
  const dynamicNoFront=clock?.version===
    FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_CLOCK_VERSION;
  const dissolvedLeading=clock?.version===
    FINALE_COAST_DISSOLVED_LEADING_LAST_KM_CLOCK_VERSION;
  const dynamicFront=dissolvedLeading||clock?.version===
    FINALE_COAST_DYNAMIC_FRONT_LAST_KM_CLOCK_VERSION;
  const dynamicActive=clock?.version===
    FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_CLOCK_VERSION;
  const dynamicSingle=clock?.version===
    FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_CLOCK_VERSION;
  const frontCatch=clock?.version===
    FINALE_COAST_FRONT_CATCH_LAST_KM_CLOCK_VERSION;
  const coastNoFront=clock?.version===
    FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_CLOCK_VERSION||dynamicNoFront;
  const coasted=coastNoFront||dynamicFront||dynamicActive||
    dynamicSingle||frontCatch||clock?.version===
    FINALE_COAST_DROPPED_LAST_KM_CLOCK_VERSION;
  const noFront=coastNoFront||frontCatch||
    clock?.line?.outcome==='bunch_with_dropped_reserve';
  if(frontCatch)
    validateFinaleCoastFrontCatchLastKmClock(tour,clock);
  else if(dynamicSingle)
    validateFinaleCoastDynamicSingleLastKmClock(tour,clock);
  else if(dynamicActive)
    validateFinaleCoastDynamicActiveLastKmClock(tour,clock);
  else if(dissolvedLeading)
    validateFinaleCoastDissolvedLeadingLastKmClock(tour,clock);
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
  const positioned=frontCatch?
    resolveFinaleFrontCatchPositionedSource(tour,clock):
    dynamicSingle?
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
  const lateIds=new Set((positioned.lateBunchExits??[]).map(row=>
    row.riderId));
  if([...lateIds].some(id=>!at500.pelotonRiderIds.includes(id)))
    throw new Error('A late bunch exit differs from its paid 500 m road.');
  const activeAt500=lateIds.size?{...at500,
    pelotonRiderIds:at500.pelotonRiderIds.filter(id=>
      !lateIds.has(id))}:at500;
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const sprintPlan=recordFinaleDepletedSprintPlanFromTour(tour,{
    source:{endDistanceM:finishM-500,
      roadGroups:at500.roadGroups,
      pelotonRiderIds:activeAt500.pelotonRiderIds,
      isolatedRiderIds:positioned.droppedRiderIds,
      riderEnergy:at500.riders.map(row=>({
        riderId:row.riderId,energyAfter:row.energy}))},
    plans:nominations,sourceRoadTraceVersion:clock.version});
  const coastedSingleton=coasted&&!dynamicFront&&!dynamicActive&&
    positioned.roadBands.slice(0,-1).some(band=>band.slots.length===1);
  const handoff=recordFinaleIndividualBandsAt500(tour,{
    positioned,at500:activeAt500,sourceRoadTraceVersion:clock.version,
    passageTimes:[...passage.groups.map(group=>
      group.passageSecondsFromBunchMarker),
    passage.bunchPassageSecondsFromBunchMarker],
    isolatedSprintPlan:sprintPlan,
    isolatedBandRunners:isolatedRunners(tour,clock,passage),
    singletonRoad:dynamicActive||dynamicFront||dynamicSingle||
      coastedSingleton?{
      trace:clock.trace,passageAtLine:clock.passageFrames.at(-1)}:null,
    withholdProvisionalOrder:true,
    allowCoastedTail:coastNoFront&&!dynamicNoFront});
  const coastedTail=handoff.bandRunners.some(band=>
    band.runner.version===FINALE_COASTED_TAIL_BAND_RUNNER_VERSION);
  return {version:frontCatch?
    FINALE_COAST_FRONT_CATCH_INDIVIDUAL_LINE_VERSION:
    coastedTail?FINALE_COAST_TAIL_INDIVIDUAL_LINE_VERSION:
    dynamicSingle?
    FINALE_COAST_DYNAMIC_SINGLE_INDIVIDUAL_LINE_VERSION:
    dynamicActive?
    FINALE_COAST_DYNAMIC_ACTIVE_INDIVIDUAL_LINE_VERSION:
    dynamicFront?
    FINALE_COAST_DYNAMIC_FRONT_INDIVIDUAL_LINE_VERSION:
    lateIds.size?
    FINALE_COAST_LATE_BUNCH_EXIT_INDIVIDUAL_LINE_VERSION:
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
  const expected=recorded?.version===
    FINALE_COAST_ISOLATED_PASS_INDIVIDUAL_LINE_VERSION?
    recordFinaleCoastedIsolatedPassIndividualLine(tour,clock,input):
    recorded?.version===
      FINALE_COAST_ISOLATED_PARALLEL_INDIVIDUAL_LINE_VERSION?
      recordFinaleCoastedIsolatedParallelIndividualLine(tour,clock,input):
    recorded?.version===
      FINALE_COAST_FULL_KM_ISOLATED_LANES_LINE_VERSION?
      recordFinaleCoastedFullKmIsolatedLanesLine(tour,clock,input):
    recorded?.version===FINALE_COAST_FRONT_EXIT_INDIVIDUAL_LINE_VERSION?
    recordFinaleCoastedFrontExitIndividualLine(tour,clock,input):
    [FINALE_COASTED_INDIVIDUAL_LINE_VERSION,
    FINALE_COAST_NO_FRONT_INDIVIDUAL_LINE_VERSION,
    FINALE_COAST_DYNAMIC_NO_FRONT_INDIVIDUAL_LINE_VERSION,
    FINALE_COAST_DYNAMIC_FRONT_INDIVIDUAL_LINE_VERSION,
    FINALE_COAST_DYNAMIC_ACTIVE_INDIVIDUAL_LINE_VERSION,
    FINALE_COAST_LATE_BUNCH_EXIT_INDIVIDUAL_LINE_VERSION,
    FINALE_COAST_FRONT_CATCH_INDIVIDUAL_LINE_VERSION,
    FINALE_COAST_TAIL_INDIVIDUAL_LINE_VERSION,
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
  const dynamicFront=[FINALE_COAST_DYNAMIC_FRONT_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DISSOLVED_LEADING_LAST_KM_CLOCK_VERSION]
    .includes(clock?.version);
  const dynamicActive=clock?.version===
    FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_CLOCK_VERSION;
  const dynamicSingle=clock?.version===
    FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_CLOCK_VERSION;
  const frontCatch=clock?.version===
    FINALE_COAST_FRONT_CATCH_LAST_KM_CLOCK_VERSION;
  if(![FINALE_COAST_DROPPED_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_FRONT_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DISSOLVED_LEADING_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_CLOCK_VERSION,
    FINALE_COAST_FRONT_CATCH_LAST_KM_CLOCK_VERSION]
    .includes(clock?.version))
    throw new Error('The coasted individual line needs a v93 road clock.');
  const prior=recordFinaleDepletedIndividualLine(tour,clock,input);
  if(frontCatch)return {...prior,
    pre500Audit:{status:'paid_front_catch_wheels_unresolved',
      catchDistanceM:clock.contact.atDistanceM,
      firstPotentialOverlap:null,contactResolved:false,
      pointsStatus:'withheld',canCommitAwards:false},
    pre500ContactStatus:'paid_front_catch_wheels_unresolved',
    roadStatus:'conditional_front_catch_and_isolated_lines',
    provisionalLineOrder:null};
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
    if(clock.line.outcome===
      'front_leavers_ahead_of_bunch_contact_unresolved')return {...prior,
      pre500Audit:{status:'front_leavers_ahead_of_bunch',
        contactResolved:false,pointsStatus:'withheld',
        canCommitAwards:false},
      pre500ContactStatus:'front_leavers_ahead_of_bunch',
      roadStatus:'conditional_front_leavers_ahead_of_bunch',
      provisionalLineOrder:null};
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
  if(dynamicNoFront){
    const late=prior.version===
      FINALE_COAST_LATE_BUNCH_EXIT_INDIVIDUAL_LINE_VERSION;
    return {...prior,
    pre500Audit:{status:late?'unresolved_late_bunch_exits':
      'unresolved_new_drops',
      firstPotentialOverlap:null,contactResolved:false,
      pointsStatus:'withheld',canCommitAwards:false},
    pre500ContactStatus:late?'unresolved_late_bunch_exits':
      'unresolved_new_drops',
    roadStatus:late?'conditional_late_bunch_exits_contact_unresolved':
      'conditional_new_drops_contact_unresolved',
    provisionalLineOrder:null};
  }
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

// A new opt-in line version records every isolated-to-isolated lane pass.
// The established coasted line remains byte-for-byte replayable.
export function recordFinaleCoastedIsolatedPassIndividualLine(tour,clock,
  input={}){
  const prior=recordFinaleCoastedIndividualLine(tour,clock,input);
  if(prior.version!==FINALE_COASTED_INDIVIDUAL_LINE_VERSION||
    prior.provisionalLineOrder!==null||
    prior.overlapAudit.firstPotentialOverlap!==null)
    return null;
  const passAudit=recordFinalePre500IsolatedPasses(tour,clock,
    prior.positionedSource);
  if(!passAudit)return null;
  return {...prior,
    version:FINALE_COAST_ISOLATED_PASS_INDIVIDUAL_LINE_VERSION,
    pre500Audit:passAudit,
    pre500ContactStatus:'resolved_isolated_lane_passes',
    roadStatus:'conditional_isolated_passes_separated',
    provisionalLineOrder:positionedLineOrder(prior.conditionalCrossings)};
}

// Isolated riders who share the recorded last-kilometre marker stay in
// separate paid lanes. The opt-in version changes no movement or energy.
export function recordFinaleCoastedIsolatedParallelIndividualLine(tour,
  clock,input={}){
  const prior=recordFinaleCoastedIndividualLine(tour,clock,input);
  if(![FINALE_COASTED_INDIVIDUAL_LINE_VERSION,
    FINALE_COAST_NO_FRONT_INDIVIDUAL_LINE_VERSION]
    .includes(prior.version)||prior.provisionalLineOrder!==null||
    prior.overlapAudit.firstPotentialOverlap!==null)return null;
  const audit=recordFinalePre500IsolatedParallel(tour,clock,
    prior.positionedSource);
  if(!audit?.parallelStarts.length)return null;
  return {...prior,
    version:FINALE_COAST_ISOLATED_PARALLEL_INDIVIDUAL_LINE_VERSION,
    pre500Audit:audit,
    pre500ContactStatus:'resolved_isolated_parallel_lanes',
    roadStatus:'conditional_isolated_parallel_lanes_separated',
    provisionalLineOrder:positionedLineOrder(prior.conditionalCrossings)};
}

// A single opt-in lane rule covers every paid isolated-to-isolated meeting
// from the kilometre marker through the finish. It never repairs a meeting
// with an active road band, and exact crossing ties retain place ranges.
export function recordFinaleCoastedFullKmIsolatedLanesLine(tour,clock,
  input={}){
  const prior=recordFinaleCoastedIndividualLine(tour,clock,input);
  if(![FINALE_COASTED_INDIVIDUAL_LINE_VERSION,
    FINALE_COAST_NO_FRONT_INDIVIDUAL_LINE_VERSION]
    .includes(prior.version)||prior.provisionalLineOrder!==null||
    !prior.pre500Audit.firstPotentialOverlap&&
      !prior.overlapAudit.firstPotentialOverlap)return null;
  const audit=recordFinaleFullKmIsolatedLanes(tour,clock,
    prior.positionedSource,prior.bandRunners);
  if(!audit)return null;
  return {...prior,
    version:FINALE_COAST_FULL_KM_ISOLATED_LANES_LINE_VERSION,
    pre500Audit:audit,
    overlapAudit:{version:audit.version,
      status:audit.status,firstPotentialOverlap:null,
      contactResolved:true,classifiedResults:null,
      pointsStatus:'withheld',canCommitAwards:false},
    pre500ContactStatus:audit.status,
    roadStatus:'conditional_isolated_full_km_lanes',
    provisionalLineOrder:positionedLineOrder(prior.conditionalCrossings)};
}

// A source-front leaver takes an outside exit lane only when the paid
// passage proves that the entire front clears the leaver by 250 m and no
// later pair meets. Previous dynamic-single recordings remain unchanged.
export function recordFinaleCoastedFrontExitIndividualLine(tour,clock,
  input={}){
  if(clock?.version!==FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_CLOCK_VERSION)
    return null;
  const prior=recordFinaleCoastedIndividualLine(tour,clock,input);
  const exitAudit=recordFinalePre500FrontExit(tour,clock,
    prior.positionedSource);
  if(!exitAudit)return null;
  const overlapAudit=recordFinaleUnorderedBandOverlapAudit(
    prior.bandRunners);
  if(overlapAudit.firstPotentialOverlap!==null)return null;
  return {...prior,
    version:FINALE_COAST_FRONT_EXIT_INDIVIDUAL_LINE_VERSION,
    pre500Audit:exitAudit,overlapAudit,
    pre500ContactStatus:'resolved_front_exit_lane',
    roadStatus:'conditional_front_exit_separated',
    provisionalLineOrder:positionedLineOrder(prior.conditionalCrossings)};
}
