import {isDeepStrictEqual} from 'node:util';
import {recordFinaleLaneQueuedCoastedContactRunnerFromTour,
  recordFinaleLaneQueuedLateActiveContactRunnerFromTour,
  positionedLineOrder} from './finale-paid-bunch-runner.mjs';
import {recordFinalePre500ActiveContactGate} from
  './finale-pre500-active-overlap-audit.mjs';
import {recordFinaleLateActiveWheelContact,
  recordFinalePaidCrossBandOverlap,paidQueuedRiderAt,
  splitPaidQueuedBandAt} from './finale-late-active-wheel-contact.mjs';

export const FINALE_LATE_ACTIVE_CONTACT_LINE_VERSION=
  'v2-finale-late-active-contact-line-lab-18';
const EPSILON=1e-7;

function queueOneBand(tour,line,band){
  const prior=band.runner;
  const slots=prior.positionedSource?.slots.map(slot=>({
    ...slot,row:slot.depth}));
  const ids=slots?.map(slot=>slot.riderId);
  const first=prior.frames?.[0];
  if(!ids?.length||!first||
    new Set(ids).size!==ids.length||
    first.riders.length!==ids.length||
    first.riders.some(row=>!ids.includes(row.riderId)))
    throw new Error('Late active contact lost its paid sprint handoff.');
  const source={distanceM:line.lineDistanceM-500,
    pelotonRiderIds:ids,
    riderEnergy:first.riders.map(row=>({
      riderId:row.riderId,energy:row.energyAtDecision})),
    bunchElapsedSeconds:band.paidTo500Seconds,
    sourceRoadTraceVersion:line.sourceClockVersion};
  const plan={...line.sprintPlan,
    decisions:line.sprintPlan.decisions.filter(row=>
      ids.includes(row.finisherId))};
  return {roadBandId:band.roadBandId,
    runner:recordFinaleLaneQueuedCoastedContactRunnerFromTour(tour,{
      source,plan,
      positionedSource:{...prior.positionedSource,slots}})};
}

function sourceAtContact(queued,positioned,contact){
  const time=contact.elapsedSecondsFromLastKmStart;
  const slots=queued.flatMap((band,index)=>{
    const source=positioned.roadBands[index];
    return source.slots.map(slot=>({
      ...slot,...paidQueuedRiderAt(band,slot.riderId,time)}));
  });
  const byLane=new Map();
  for(const slot of slots){
    if(!byLane.has(slot.lane))byLane.set(slot.lane,[]);
    byLane.get(slot.lane).push(slot);
  }
  for(const lane of byLane.values()){
    lane.sort((a,b)=>b.positionM-a.positionM||
      a.riderId.localeCompare(b.riderId));
    lane.forEach((slot,row)=>{slot.row=row;});
    for(let index=1;index<lane.length;index++)
      if(lane[index-1].positionM-lane[index].positionM<
        positioned.wheelSpacingM-EPSILON)
        throw new Error('The merged road begins with overlapping wheels.');
  }
  return slots;
}

function replayBand(prefix,merged,sourceBand){
  const ids=new Set(prefix.riderIds);
  const frames=[...prefix.frames,...merged.frames.map(frame=>({
    ...frame,riders:frame.riders.filter(row=>
      ids.has(row.riderId))}))];
  if(frames.some(frame=>frame.riders.length!==ids.size))
    throw new Error('A shared replay lost a source-band rider.');
  return {roadBandId:sourceBand.roadBandId,
    paidTo500Seconds:sourceBand.paidTo500Seconds,
    mergedIntoRoadBandId:'peloton',
    runner:{version:merged.version,frames,
      finishers:merged.finishers.filter(row=>
        ids.has(row.riderId))}};
}

// The first occupied-lane wheel encounter changes the active road. Pay
// both source bands to that instant, then run their union on one clock.
// Isolated riders retain separately paid outside lanes and cannot touch
// either the source bands or the actual merged path. No official result
// or award is written by this conditional laboratory rule.
export function recordFinaleLateActiveContactLine(tour,clock,prior){
  const positioned=prior?.positionedSource;
  const sourceBands=prior?.bandRunners?.slice(0,2);
  const isolated=prior?.bandRunners?.slice(2);
  if(positioned?.roadBands?.length!==2||
    !isolated?.length||sourceBands?.length!==2||
    sourceBands[0].roadBandId!==positioned.roadBands[0].id||
    sourceBands[1].roadBandId!=='peloton'||
    prior.lineDistanceM!==tour.route.distanceKm*1000||
    prior.sprintPlan?.decisionDistanceM!==prior.lineDistanceM-500)
    return null;
  const pre500Gate=recordFinalePre500ActiveContactGate(
    tour,clock,positioned);
  if(pre500Gate.firstActiveWheel||
    pre500Gate.firstActiveIsolated)return null;
  const queued=sourceBands.map(band=>queueOneBand(tour,prior,band));
  const contact=recordFinaleLateActiveWheelContact(
    positioned,queued[0],queued[1]);
  if(!contact)return null;
  const time=contact.elapsedSecondsFromLastKmStart;
  for(const band of isolated){
    if(queued.some(active=>recordFinalePaidCrossBandOverlap(
      active,band,{toSeconds:time})))return null;
  }
  const prefix=queued.map(band=>splitPaidQueuedBandAt(
    band,time,contact.atDistanceM));
  const slots=sourceAtContact(queued,positioned,contact);
  const source={distanceM:contact.atDistanceM,
    pelotonRiderIds:slots.map(row=>row.riderId),
    riderEnergy:slots.map(row=>({
      riderId:row.riderId,energy:row.energy})),
    bunchElapsedSeconds:time,
    sourceRoadTraceVersion:prior.sourceClockVersion};
  const merged=recordFinaleLaneQueuedLateActiveContactRunnerFromTour(
    tour,{source,plan:prior.sprintPlan,
      positionedSource:{
        version:FINALE_LATE_ACTIVE_CONTACT_LINE_VERSION,
        status:'provisional_paid_merged_active_wheels',
        distanceM:contact.atDistanceM,
        wheelSpacingM:positioned.wheelSpacingM,
        slots}});
  for(const band of isolated)
    if(recordFinalePaidCrossBandOverlap(
      {roadBandId:'peloton',runner:merged},band,
      {fromSeconds:time}))return null;
  const activeReplays=prefix.map((part,index)=>
    replayBand(part,merged,sourceBands[index]));
  const crossings=[...merged.finishers.map(row=>({
    ...row,roadBandId:'peloton'})),
  ...isolated.flatMap(band=>band.runner.finishers.map(row=>({
    ...row,roadBandId:band.roadBandId})))];
  const lineOrder=positionedLineOrder(crossings);
  const count=tour.committedInputs.teams.reduce((sum,team)=>
    sum+team.riders.length,0);
  if(crossings.length!==count||
    new Set(crossings.map(row=>row.riderId)).size!==count||
    activeReplays.reduce((sum,band)=>
      sum+band.runner.finishers.length,0)!==
      merged.finishers.length)
    throw new Error('The merged road did not carry the whole field.');
  const energyAt500=new Map(sourceBands.flatMap(band=>
    band.runner.frames[0].riders.map(row=>[
      row.riderId,row.energyAtDecision])));
  const paidAfterContact=new Map(merged.finishers.map(row=>
    [row.riderId,0]));
  for(const frame of merged.frames)for(const row of frame.riders)
    paidAfterContact.set(row.riderId,
      paidAfterContact.get(row.riderId)+row.energySpent);
  for(let index=0;index<activeReplays.length;index++)
    for(const finisher of activeReplays[index].runner.finishers){
    const paidBefore=prefix[index].frames
      .reduce((sum,frame)=>sum+frame.riders.find(row=>
        row.riderId===finisher.riderId).energySpent,0);
    if(Math.abs(energyAt500.get(finisher.riderId)-
      paidBefore-paidAfterContact.get(finisher.riderId)-
      finisher.energyAtLine)>EPSILON)
      throw new Error('The merged line lost rider energy.');
  }
  return {version:FINALE_LATE_ACTIVE_CONTACT_LINE_VERSION,
    sourceClockVersion:clock.version,
    sourcePositionVersion:positioned.version,
    startDistanceM:positioned.startDistanceM,
    lineDistanceM:prior.lineDistanceM,
    positionedSource:positioned,
    sourceRoadGroupIds:sourceBands.map(row=>row.roadBandId),
    pre500Gate,contact,atContact:{slots},
    sourceQueuedBands:queued,prefix,merged,
    sprintPlan:prior.sprintPlan,
    bandRunners:[...activeReplays,...isolated],
    conditionalCrossings:crossings,
    provisionalLineOrder:lineOrder.some(row=>row.position===null)?
      null:lineOrder,
    roadPlaceBounds:lineOrder,
    roadStatus:'conditional_paid_late_active_wheel_contact',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleLateActiveContactLine(tour,clock,prior,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleLateActiveContactLine(tour,clock,prior)))
    throw new Error('The late active contact differs from the paid race.');
  return true;
}
