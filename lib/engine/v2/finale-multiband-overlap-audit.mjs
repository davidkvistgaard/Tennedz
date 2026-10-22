import {isDeepStrictEqual} from 'node:util';

export const FINALE_MULTIBAND_OVERLAP_AUDIT_VERSION=
  'v2-finale-multiband-overlap-audit-1';
export const FINALE_ALL_BAND_OVERLAP_AUDIT_VERSION=
  'v2-finale-all-band-overlap-audit-2';
export const FINALE_UNORDERED_BAND_OVERLAP_AUDIT_VERSION=
  'v2-finale-unordered-band-overlap-audit-1';
const EPSILON=1e-7;

function motionSegments(band){
  const segments=[];
  for(const frame of band.runner.frames){
    for(const row of frame.riders){
      if(row.role==='finished')continue;
      const parts=[
        [row.activeSeconds,row.activeDistanceM],
        [row.shelteredSeconds,row.shelteredDistanceM]];
      let time=frame.elapsedSecondsAtStart;
      let position=row.positionBeforeM;
      if(!Number.isFinite(time)||!Number.isFinite(position)||
        parts.some(([seconds,distance])=>!Number.isFinite(seconds)||
          !Number.isFinite(distance)||seconds<0||distance<0))
        throw new Error('A road band has no finite paid trajectory.');
      for(const [seconds,distance] of parts){
        if(seconds>EPSILON){
          segments.push({riderId:row.riderId,startSeconds:time,
            endSeconds:time+seconds,startDistanceM:position,
            endDistanceM:position+distance});
        }else if(distance>EPSILON){
          throw new Error('A road band moves without paid time.');
        }
        time+=seconds;
        position+=distance;
      }
      if(Math.abs(position-row.positionM)>EPSILON||
        time-frame.elapsedSecondsAtStart>frame.durationSeconds+EPSILON||
        row.elapsedToLineSeconds!==null&&
          Math.abs(time-row.elapsedToLineSeconds)>EPSILON)
        throw new Error('A road band trajectory differs from its paid frame.');
    }
  }
  return segments;
}

function positionAt(segment,time){
  const share=(time-segment.startSeconds)/
    (segment.endSeconds-segment.startSeconds);
  return segment.startDistanceM+share*
    (segment.endDistanceM-segment.startDistanceM);
}

// This is a deliberately conservative longitudinal gate. Lanes and passing
// are unresolved, so an overlap is a possible encounter, not a merged group.
export function recordFinaleMultibandOverlapAudit(bandRunners){
  if(!Array.isArray(bandRunners)||bandRunners.length!==2||
    bandRunners[0].roadBandId===bandRunners[1].roadBandId)
    throw new Error('The overlap audit needs two distinct paid road bands.');
  const front=motionSegments(bandRunners[0]);
  const bunch=motionSegments(bandRunners[1]);
  if(!front.length||!bunch.length)
    throw new Error('The overlap audit needs both paid trajectories.');
  let first=null;
  for(const ahead of front)for(const behind of bunch){
    const start=Math.max(ahead.startSeconds,behind.startSeconds);
    const end=Math.min(ahead.endSeconds,behind.endSeconds);
    if(end<start-EPSILON)continue;
    const initial=positionAt(ahead,start)-positionAt(behind,start);
    const final=positionAt(ahead,end)-positionAt(behind,end);
    if(initial>EPSILON&&final>EPSILON)continue;
    const time=initial<=EPSILON?start:
      start+initial/(initial-final)*(end-start);
    const distanceM=positionAt(ahead,time);
    const candidate={elapsedSecondsFromLastKmStart:time,
      distanceM,frontRiderId:ahead.riderId,
      bunchRiderId:behind.riderId};
    if(!first||time<first.elapsedSecondsFromLastKmStart-EPSILON||
      Math.abs(time-first.elapsedSecondsFromLastKmStart)<=EPSILON&&
      `${candidate.frontRiderId}:${candidate.bunchRiderId}`<
        `${first.frontRiderId}:${first.bunchRiderId}`)
      first=candidate;
  }
  return {version:FINALE_MULTIBAND_OVERLAP_AUDIT_VERSION,
    status:first?'potential_longitudinal_overlap':
      'separated_through_conditional_lines',
    firstPotentialOverlap:first,
    contactResolved:false,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}

export function validateFinaleMultibandOverlapAudit(bandRunners,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMultibandOverlapAudit(bandRunners)))
    throw new Error('The multiband overlap audit does not replay.');
  return true;
}

// Reuse the exact two-band trajectory check for every ordered pair. This
// records a possible encounter only; it never changes either band's road.
export function recordFinaleAllBandOverlapAudit(bandRunners){
  if(!Array.isArray(bandRunners)||bandRunners.length<2||
    new Set(bandRunners.map(row=>row.roadBandId)).size!==
      bandRunners.length)
    throw new Error('The all-band audit needs distinct paid road bands.');
  let first=null;
  for(let ahead=0;ahead<bandRunners.length;ahead++)
    for(let behind=ahead+1;behind<bandRunners.length;behind++){
      const pair=recordFinaleMultibandOverlapAudit([
        bandRunners[ahead],bandRunners[behind]]);
      if(!pair.firstPotentialOverlap)continue;
      const candidate={aheadRoadBandId:bandRunners[ahead].roadBandId,
        behindRoadBandId:bandRunners[behind].roadBandId,
        aheadRiderId:pair.firstPotentialOverlap.frontRiderId,
        behindRiderId:pair.firstPotentialOverlap.bunchRiderId,
        elapsedSecondsFromLastKmStart:pair.firstPotentialOverlap
          .elapsedSecondsFromLastKmStart,
        distanceM:pair.firstPotentialOverlap.distanceM};
      if(!first||candidate.elapsedSecondsFromLastKmStart<
        first.elapsedSecondsFromLastKmStart-EPSILON||
        Math.abs(candidate.elapsedSecondsFromLastKmStart-
          first.elapsedSecondsFromLastKmStart)<=EPSILON&&
          `${candidate.aheadRoadBandId}:${candidate.behindRoadBandId}:`+
          `${candidate.aheadRiderId}:${candidate.behindRiderId}`<
          `${first.aheadRoadBandId}:${first.behindRoadBandId}:`+
          `${first.aheadRiderId}:${first.behindRiderId}`)
        first=candidate;
    }
  return {version:FINALE_ALL_BAND_OVERLAP_AUDIT_VERSION,
    status:first?'potential_longitudinal_overlap':
      'separated_through_conditional_lines',
    firstPotentialOverlap:first,
    contactResolved:false,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}

export function validateFinaleAllBandOverlapAudit(bandRunners,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleAllBandOverlapAudit(bandRunners)))
    throw new Error('The all-band overlap audit does not replay.');
  return true;
}

// Isolated dropped riders are stored by ID, not by road position. Unlike the
// older front/bunch audit, neither input can be assumed to start ahead. A
// meeting is possible only when their signed longitudinal separation reaches
// zero while both recorded trajectories are active.
export function recordFinaleUnorderedBandOverlapAudit(bandRunners){
  if(!Array.isArray(bandRunners)||bandRunners.length<2||
    new Set(bandRunners.map(row=>row.roadBandId)).size!==
      bandRunners.length)
    throw new Error('The unordered audit needs distinct paid road bands.');
  const segments=bandRunners.map(motionSegments);
  if(segments.some(rows=>!rows.length))
    throw new Error('The unordered audit needs paid trajectories.');
  let first=null;
  for(let a=0;a<segments.length;a++)for(let b=a+1;b<segments.length;b++)
    for(const left of segments[a])for(const right of segments[b]){
      const start=Math.max(left.startSeconds,right.startSeconds);
      const end=Math.min(left.endSeconds,right.endSeconds);
      if(end<start-EPSILON)continue;
      const initial=positionAt(left,start)-positionAt(right,start);
      const final=positionAt(left,end)-positionAt(right,end);
      if(initial>EPSILON&&final>EPSILON||
        initial<-EPSILON&&final<-EPSILON)continue;
      const time=Math.abs(initial)<=EPSILON?start:
        start+initial/(initial-final)*(end-start);
      const candidate={firstRoadBandId:bandRunners[a].roadBandId,
        secondRoadBandId:bandRunners[b].roadBandId,
        firstRiderId:left.riderId,secondRiderId:right.riderId,
        elapsedSecondsFromLastKmStart:time,
        distanceM:positionAt(left,time)};
      if(!first||time<first.elapsedSecondsFromLastKmStart-EPSILON||
        Math.abs(time-first.elapsedSecondsFromLastKmStart)<=EPSILON&&
          `${candidate.firstRoadBandId}:${candidate.secondRoadBandId}:`+
          `${candidate.firstRiderId}:${candidate.secondRiderId}`<
          `${first.firstRoadBandId}:${first.secondRoadBandId}:`+
          `${first.firstRiderId}:${first.secondRiderId}`)
        first=candidate;
    }
  return {version:FINALE_UNORDERED_BAND_OVERLAP_AUDIT_VERSION,
    status:first?'potential_longitudinal_overlap':
      'separated_through_conditional_lines',
    firstPotentialOverlap:first,contactResolved:false,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}
