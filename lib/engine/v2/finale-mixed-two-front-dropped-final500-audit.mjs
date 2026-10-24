import {isDeepStrictEqual} from 'node:util';
import {recordFinaleMixedTwoFrontDroppedPre500Audit,
  FINALE_MIXED_TWO_FRONT_DROPPED_PRE500_AUDIT_VERSION} from
  './finale-mixed-two-front-dropped-pre500-audit.mjs';

export const FINALE_MIXED_TWO_FRONT_DROPPED_FINAL500_AUDIT_VERSION=
  'v2-finale-mixed-two-front-dropped-final500-wheel-audit-1';
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
export function recordFinaleMixedTwoFrontDroppedFinal500Audit(tour,clock,
  line,pre500Audit){
  if(pre500Audit?.version!==
      FINALE_MIXED_TWO_FRONT_DROPPED_PRE500_AUDIT_VERSION||
    !isDeepStrictEqual(pre500Audit,
      recordFinaleMixedTwoFrontDroppedPre500Audit(tour,clock,line)))
    throw new Error('The final wheel audit needs its paid first half.');
  const groups=new Map(line.positionedSource.roadBands.flatMap(band=>
    band.slots.map(slot=>[slot.riderId,band.id])));
  for(const id of line.positionedSource.droppedRiderIds)
    groups.set(id,'older');
  const segments=paidSegments(line,groups);
  const byRider=new Map([...groups.keys()].map(id=>[id,
    segments.filter(row=>row.riderId===id)]));
  let sourceAdjacentPairs=0;
  const ids=[...byRider.keys()];
  for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){
    const intervals=proximityIntervals(byRider.get(ids[a]),
      byRider.get(ids[b]));
    if(!intervals.length)continue;
    const start=Math.max(byRider.get(ids[a])[0].start,
      byRider.get(ids[b])[0].start);
    if(groups.get(ids[a])!==groups.get(ids[b])||
      intervals.length!==1||intervals[0].from>start+EPSILON)
      throw new Error('The final wheels have a new unpaid approach.');
    sourceAdjacentPairs++;
  }
  return {version:FINALE_MIXED_TWO_FRONT_DROPPED_FINAL500_AUDIT_VERSION,
    status:'source_adjacent_outside_lanes_no_fresh_approach',
    paidRiderCount:ids.length,sourceAdjacentPairs,
    outsideLaneAssignments:pre500Audit.outsideLaneAssignments,
    contactResolved:false,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}

export function validateFinaleMixedTwoFrontDroppedFinal500Audit(tour,
  clock,line,pre500Audit,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedFinal500Audit(tour,clock,line,
      pre500Audit)))
    throw new Error('The final wheel audit does not replay.');
  return true;
}
