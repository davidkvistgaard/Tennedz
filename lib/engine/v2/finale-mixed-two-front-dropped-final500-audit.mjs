import {isDeepStrictEqual} from 'node:util';
import {recordFinaleMixedTwoFrontDroppedPre500Audit,
  recordFinaleMixedTwoFrontDroppedFreshPre500Audit,
  recordFinaleMixedTwoFrontDroppedManyPre500Audit,
  FINALE_MIXED_TWO_FRONT_DROPPED_PRE500_AUDIT_VERSION,
  FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_PRE500_AUDIT_VERSION,
  FINALE_MIXED_TWO_FRONT_DROPPED_MANY_PRE500_AUDIT_VERSION} from
  './finale-mixed-two-front-dropped-pre500-audit.mjs';
import {paidQueuedRiderAt,splitPaidQueuedBandAt} from
  './finale-late-active-wheel-contact.mjs';

export const FINALE_MIXED_TWO_FRONT_DROPPED_FINAL500_AUDIT_VERSION=
  'v2-finale-mixed-two-front-dropped-final500-wheel-audit-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_FINAL500_AUDIT_VERSION=
  'v2-finale-mixed-two-front-dropped-fresh-final500-wheel-audit-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_MANY_FINAL500_AUDIT_VERSION=
  'v2-finale-mixed-two-front-dropped-many-final500-wheel-audit-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_CLEAN_PRE500_FRESH_FINAL500_AUDIT_VERSION=
  'v2-finale-mixed-two-front-dropped-clean-pre500-fresh-final500-wheel-audit-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_PRE500_MANY_FINAL500_AUDIT_VERSION=
  'v2-finale-mixed-two-front-dropped-fresh-pre500-many-final500-wheel-audit-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_PRE500_CLEAN_FINAL500_AUDIT_VERSION=
  'v2-finale-mixed-two-front-dropped-fresh-pre500-clean-final500-wheel-audit-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_MANY_PRE500_FINAL500_AUDIT_VERSION=
  'v2-finale-mixed-two-front-dropped-many-pre500-final500-wheel-audit-1';
const EPSILON=1e-7;
const SPACING_M=2.5;

function paidSegments(line,sourceGroups){
  const segments=[];
  const seen=new Set();
  for(const band of line.bandRunners)
    for(const frame of band.runner.frames)
      for(const row of frame.riders){
        if(row.role==='finished')continue;
        const groupId=sourceGroups.get(row.riderId);
        if(!groupId||!Number.isFinite(frame.elapsedSecondsAtStart)||
          !Number.isFinite(row.positionBeforeM)||
          !Number.isFinite(row.positionM))
          throw new Error('A final wheel lacks its paid source or position.');
        seen.add(row.riderId);
        let time=frame.elapsedSecondsAtStart;
        let position=row.positionBeforeM;
        for(const [seconds,metres] of [
          [row.activeSeconds,row.activeDistanceM],
          [row.shelteredSeconds,row.shelteredDistanceM]]){
          if(!Number.isFinite(seconds)||!Number.isFinite(metres)||
            seconds<0||metres<0||seconds<=EPSILON&&metres>EPSILON)
            throw new Error('A final wheel has unpaid motion.');
          if(seconds>EPSILON)segments.push({riderId:row.riderId,
            sourceGroupId:groupId,start:time,end:time+seconds,
            before:position,after:position+metres});
          time+=seconds;
          position+=metres;
        }
        if(Math.abs(position-row.positionM)>EPSILON||
          time>frame.elapsedSecondsAtStart+frame.durationSeconds+EPSILON)
          throw new Error('A final wheel differs from its paid frame.');
      }
  if(seen.size!==sourceGroups.size)
    throw new Error('The final wheel audit lost a rider.');
  return segments;
}

function at(segment,time){
  return segment.before+(time-segment.start)*
    (segment.after-segment.before)/(segment.end-segment.start);
}

function singleRiderBand(line,riderId){
  const frames=line.bandRunners.flatMap(band=>band.runner.frames
    .map(frame=>({...frame,riders:frame.riders.filter(row=>
      row.riderId===riderId&&row.role!=='finished')}))
    .filter(frame=>frame.riders.length));
  if(!frames.length)throw new Error('A final approach lacks its rider.');
  return {roadBandId:`audit:${riderId}`,runner:{frames}};
}

function proximityIntervals(left,right){
  const intervals=[];
  for(const a of left)for(const b of right){
    const start=Math.max(a.start,b.start),end=Math.min(a.end,b.end);
    if(end<start-EPSILON)continue;
    const gap=time=>at(a,time)-at(b,time);
    if(end<=start+EPSILON){
      if(Math.abs(gap(start))<=SPACING_M+EPSILON)
        intervals.push({from:start,to:start});
      continue;
    }
    const before=gap(start),after=gap(end);
    const cuts=[start,end];
    for(const edge of [-SPACING_M,SPACING_M]){
      const share=(edge-before)/(after-before);
      if(Number.isFinite(share)&&share>EPSILON&&share<1-EPSILON)
        cuts.push(start+share*(end-start));
    }
    cuts.sort((a,b)=>a-b);
    for(let index=0;index<cuts.length-1;index++){
      const from=cuts[index],to=cuts[index+1];
      if(to-from<=EPSILON||
        Math.abs(gap((from+to)/2))>SPACING_M+EPSILON)continue;
      intervals.push({from,to});
    }
    for(const time of [start,end])
      if(Math.abs(gap(time))<=SPACING_M+EPSILON)
        intervals.push({from:time,to:time});
  }
  intervals.sort((a,b)=>a.from-b.from||a.to-b.to);
  const merged=[];
  for(const interval of intervals){
    const last=merged.at(-1);
    if(last&&interval.from<=last.to+EPSILON)
      last.to=Math.max(last.to,interval.to);
    else merged.push({...interval});
  }
  return merged;
}

// This remains an internal longitudinal gate. Distinct outside lanes are
// inferred; no possible wheel proximity is a resolved occupied-wheel order.
function recordFinal500Audit(tour,clock,line,pre500Audit,
  {freshPre500=false,manyPre500=false,allowFreshFinal=false,
    allowManyFreshFinal=false}={}){
  if(pre500Audit?.version!==
      (manyPre500?
        FINALE_MIXED_TWO_FRONT_DROPPED_MANY_PRE500_AUDIT_VERSION:
        freshPre500?
        FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_PRE500_AUDIT_VERSION:
        FINALE_MIXED_TWO_FRONT_DROPPED_PRE500_AUDIT_VERSION)||
    !isDeepStrictEqual(pre500Audit,
      (manyPre500?
        recordFinaleMixedTwoFrontDroppedManyPre500Audit:
        freshPre500?
        recordFinaleMixedTwoFrontDroppedFreshPre500Audit:
        recordFinaleMixedTwoFrontDroppedPre500Audit)(tour,clock,line)))
    throw new Error('The final wheel audit needs its paid first half.');
  const groups=new Map(line.positionedSource.roadBands.flatMap(band=>
    band.slots.map(slot=>[slot.riderId,band.id])));
  for(const id of line.positionedSource.droppedRiderIds)
    groups.set(id,'older');
  const segments=paidSegments(line,groups);
  const byRider=new Map([...groups.keys()].map(id=>[id,
    segments.filter(row=>row.riderId===id)]));
  let sourceAdjacentPairs=0;
  const freshApproaches=[];
  const ids=[...byRider.keys()];
  for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){
    const intervals=proximityIntervals(byRider.get(ids[a]),
      byRider.get(ids[b]));
    if(!intervals.length)continue;
    const start=Math.max(byRider.get(ids[a])[0].start,
      byRider.get(ids[b])[0].start);
    if(groups.get(ids[a])!==groups.get(ids[b])||
      !allowFreshFinal&&!allowManyFreshFinal&&
        (intervals.length!==1||
        intervals[0].from>start+EPSILON))
      throw new Error('The final wheels have a new unpaid approach.'+
        (freshPre500?` ${ids[a]}/${ids[b]} `+
          JSON.stringify(intervals):''));
    if(intervals[0].from<=start+EPSILON)sourceAdjacentPairs++;
    if(allowFreshFinal||allowManyFreshFinal)
      for(const interval of intervals){
      if(interval.from<=start+EPSILON)continue;
      const firstBand=singleRiderBand(line,ids[a]);
      const secondBand=singleRiderBand(line,ids[b]);
      const first=paidQueuedRiderAt(firstBand,ids[a],interval.from);
      const second=paidQueuedRiderAt(secondBand,ids[b],interval.from);
      if(Math.abs(Math.abs(first.positionM-second.positionM)-
        SPACING_M)>EPSILON)
        throw new Error('A fresh final approach lacks paid spacing.');
      freshApproaches.push({firstRiderId:ids[a],secondRiderId:ids[b],
        elapsedSecondsFromLastKmStart:interval.from,
        firstWheelM:first.positionM,secondWheelM:second.positionM,
        firstEnergy:first.energy,secondEnergy:second.energy,
        paidSplit:{first:splitPaidQueuedBandAt(firstBand,interval.from,
          first.positionM),second:splitPaidQueuedBandAt(secondBand,
          interval.from,second.positionM)},contactResolved:false});
    }
  }
  if(allowFreshFinal||allowManyFreshFinal){
    freshApproaches.sort((a,b)=>
      a.elapsedSecondsFromLastKmStart-
      b.elapsedSecondsFromLastKmStart);
    if(allowFreshFinal&&(freshApproaches.length!==2||
      freshApproaches[0].secondRiderId!==
        freshApproaches[1].secondRiderId||
      freshApproaches[0].firstRiderId===
        freshApproaches[1].firstRiderId||
      freshApproaches.some(row=>
        groups.get(row.firstRiderId)!=='peloton'||
        groups.get(row.secondRiderId)!=='peloton'))||
      allowManyFreshFinal&&(
        tour.committedInputs.teams.length!==(manyPre500?20:15)||
        tour.route.distanceKm!==260)||
      freshApproaches.some(row=>row.firstWheelM<=
        tour.route.distanceKm*1000-500))
      throw new Error('The fresh final audit has unpaid geometry.');
  }
  return {version:manyPre500?
    FINALE_MIXED_TWO_FRONT_DROPPED_MANY_PRE500_FINAL500_AUDIT_VERSION:
    allowManyFreshFinal?
    freshPre500?
      FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_PRE500_MANY_FINAL500_AUDIT_VERSION:
      FINALE_MIXED_TWO_FRONT_DROPPED_MANY_FINAL500_AUDIT_VERSION:
    allowFreshFinal&&!freshPre500?
    FINALE_MIXED_TWO_FRONT_DROPPED_CLEAN_PRE500_FRESH_FINAL500_AUDIT_VERSION:
    freshPre500?
    allowFreshFinal?
      FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_FINAL500_AUDIT_VERSION:
      FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_PRE500_CLEAN_FINAL500_AUDIT_VERSION:
    FINALE_MIXED_TWO_FRONT_DROPPED_FINAL500_AUDIT_VERSION,
    status:allowManyFreshFinal?
      freshApproaches.length?
        'paid_fresh_approaches_wheel_order_unresolved':
        'source_adjacent_outside_lanes_no_fresh_approach':
      allowFreshFinal?
      'two_paid_fresh_approaches_wheel_order_unresolved':
      'source_adjacent_outside_lanes_no_fresh_approach',
    paidRiderCount:ids.length,sourceAdjacentPairs,
    ...(allowFreshFinal||allowManyFreshFinal?{freshApproaches}:{}),
    outsideLaneAssignments:pre500Audit.outsideLaneAssignments,
    contactResolved:false,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}

export function recordFinaleMixedTwoFrontDroppedFinal500Audit(tour,clock,
  line,pre500Audit){
  return recordFinal500Audit(tour,clock,line,pre500Audit);
}

// Internal-only continuation of the one paid first-half approach. This
// keeps the same strict final-half pairwise guard without publishing a line.
export function recordFinaleMixedTwoFrontDroppedFreshFinal500Audit(tour,
  clock,line,pre500Audit){
  return recordFinal500Audit(tour,clock,line,pre500Audit,
    {freshPre500:true,allowFreshFinal:true});
}

// Internal diagnostic only. Exact same-source approaches can be paid and
// replayed without treating occupied wheels or the final line as resolved.
export function recordFinaleMixedTwoFrontDroppedManyFinal500Audit(tour,
  clock,line,pre500Audit){
  return recordFinal500Audit(tour,clock,line,pre500Audit,
    {allowManyFreshFinal:true});
}

// Separate strict geometry: a clean first half followed by exactly two
// paid same-bunch approaches in the second. No occupied-wheel order follows.
export function recordFinaleMixedTwoFrontDroppedCleanPre500FreshFinal500Audit(
  tour,clock,line,pre500Audit){
  return recordFinal500Audit(tour,clock,line,pre500Audit,
    {allowFreshFinal:true});
}

// Internal-only mountain diagnostic following exactly one paid source exit.
export function recordFinaleMixedTwoFrontDroppedFreshPre500ManyFinal500Audit(
  tour,clock,line,pre500Audit){
  return recordFinal500Audit(tour,clock,line,pre500Audit,
    {freshPre500:true,allowManyFreshFinal:true});
}

// A different strict bounded path: one paid first-half approach and no
// fresh final-half approach. The occupied source wheel remains unresolved.
export function recordFinaleMixedTwoFrontDroppedFreshPre500CleanFinal500Audit(
  tour,clock,line,pre500Audit){
  return recordFinal500Audit(tour,clock,line,pre500Audit,
    {freshPre500:true});
}

// Internal-only 20-team continuation. Every final-half approach is paid,
// but occupied-wheel responses and a user-facing line remain unresolved.
export function recordFinaleMixedTwoFrontDroppedManyPre500Final500Audit(
  tour,clock,line,pre500Audit){
  return recordFinal500Audit(tour,clock,line,pre500Audit,
    {manyPre500:true,allowManyFreshFinal:true});
}

export function validateFinaleMixedTwoFrontDroppedFinal500Audit(tour,
  clock,line,pre500Audit,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedFinal500Audit(tour,clock,line,
      pre500Audit)))
    throw new Error('The final wheel audit does not replay.');
  return true;
}
