import {isDeepStrictEqual} from 'node:util';

export const FINALE_MULTIBAND_OVERLAP_AUDIT_VERSION=
  'v2-finale-multiband-overlap-audit-1';
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
