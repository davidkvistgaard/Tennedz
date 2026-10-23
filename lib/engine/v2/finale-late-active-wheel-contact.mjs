export const FINALE_LATE_ACTIVE_WHEEL_CONTACT_VERSION=
  'v2-finale-late-active-wheel-contact-lab-1';
const EPSILON=1e-7;

function riderSegments(band,riderId){
  const segments=[];
  for(const frame of band.runner.frames){
    const row=frame.riders.find(item=>item.riderId===riderId);
    if(!row)throw new Error('A contact rider has no paid frame.');
    const paid=row.motionSegments??(()=>{
      const parts=[];
      let seconds=0,positionM=row.positionBeforeM;
      for(const [duration,distance,cost] of [
        [row.activeSeconds,row.activeDistanceM,
          row.activeWorkCostPerKm],
        [row.shelteredSeconds,row.shelteredDistanceM,
          row.shelteredWorkCostPerKm]]){
        if(duration>EPSILON)parts.push({startSeconds:seconds,
          endSeconds:seconds+duration,startPositionM:positionM,
          velocityMps:distance/duration,workCostPerKm:cost??0});
        seconds+=duration;
        positionM+=distance;
      }
      return parts;
    })();
    for(const part of paid){
      if(part.endSeconds-part.startSeconds<=EPSILON)continue;
      segments.push({startSeconds:frame.elapsedSecondsAtStart+
          part.startSeconds,
        endSeconds:frame.elapsedSecondsAtStart+part.endSeconds,
        startPositionM:part.startPositionM,
        velocityMps:part.velocityMps,
        workCostPerKm:part.workCostPerKm,
        energyAtDecision:row.energyAtDecision,
        frameStartSeconds:frame.elapsedSecondsAtStart,
        frameSegments:paid});
    }
  }
  if(!segments.length)throw new Error('A contact rider has no paid motion.');
  return segments;
}

export function recordFinalePaidCrossBandOverlap(first,second,
  {fromSeconds=-Infinity,toSeconds=Infinity}={}){
  const firstIds=new Set(first.runner.frames[0].riders.map(row=>
    row.riderId));
  const secondIds=new Set(second.runner.frames[0].riders.map(row=>
    row.riderId));
  let earliest=null;
  for(const firstId of firstIds)for(const secondId of secondIds)
    for(const left of riderSegments(first,firstId))
      for(const right of riderSegments(second,secondId)){
        const start=Math.max(left.startSeconds,right.startSeconds,
          fromSeconds);
        const end=Math.min(left.endSeconds,right.endSeconds,toSeconds);
        if(end<start-EPSILON)continue;
        const before=positionAt(left,start)-positionAt(right,start);
        const after=positionAt(left,end)-positionAt(right,end);
        if(before>EPSILON&&after>EPSILON||
          before<-EPSILON&&after<-EPSILON)continue;
        const time=Math.abs(before)<=EPSILON?start:
          start+before/(before-after)*(end-start);
        if(!Number.isFinite(time)||time<start-EPSILON||
          time>end+EPSILON)continue;
        const event={firstRiderId:firstId,secondRiderId:secondId,
          elapsedSecondsFromLastKmStart:time,
          distanceM:positionAt(left,time)};
        if(!earliest||time<earliest.elapsedSecondsFromLastKmStart-
          EPSILON||Math.abs(time-earliest
            .elapsedSecondsFromLastKmStart)<=EPSILON&&
          `${firstId}:${secondId}`<
            `${earliest.firstRiderId}:${earliest.secondRiderId}`)
          earliest=event;
      }
  return earliest;
}

function positionAt(part,time){
  return part.startPositionM+
    (time-part.startSeconds)*part.velocityMps;
}

function paidEnergyAt(part,time){
  const from=part.frameStartSeconds;
  const elapsed=time-from;
  const spent=part.frameSegments.reduce((total,row)=>{
    const seconds=Math.max(0,Math.min(elapsed,row.endSeconds)-
      row.startSeconds);
    return total+seconds*row.velocityMps*
      row.workCostPerKm/1000;
  },0);
  return part.energyAtDecision-spent;
}

export function paidQueuedRiderAt(band,riderId,time){
  const part=riderSegments(band,riderId).find(row=>
    time>=row.startSeconds-EPSILON&&
    time<=row.endSeconds+EPSILON);
  if(!part)throw new Error('A contact rider has no paid instant.');
  const positionM=positionAt(part,time);
  const energy=paidEnergyAt(part,time);
  if(!Number.isFinite(positionM)||!Number.isFinite(energy)||
    energy<-EPSILON)
    throw new Error('A contact rider has no paid position or energy.');
  return {riderId,positionM,energy:Math.max(0,energy)};
}

export function splitPaidQueuedBandAt(band,time,distanceM){
  const frames=[];
  let clipped=false;
  for(const frame of band.runner.frames){
    if(frame.elapsedSecondsAtStart+frame.durationSeconds<
      time-EPSILON){
      frames.push(frame);
      continue;
    }
    const durationSeconds=time-frame.elapsedSecondsAtStart;
    if(durationSeconds<0||durationSeconds>
      frame.durationSeconds+EPSILON)
      throw new Error('The contact split lacks a paid frame.');
    const riders=frame.riders.map(row=>{
      const motionSegments=(row.motionSegments??[])
        .filter(part=>part.startSeconds<durationSeconds-EPSILON)
        .map(part=>{
          const endSeconds=Math.min(part.endSeconds,durationSeconds);
          return {...part,endSeconds,
            endPositionM:part.startPositionM+
              (endSeconds-part.startSeconds)*part.velocityMps};
        });
      const state=paidQueuedRiderAt(band,row.riderId,time);
      const sum=(phase,key)=>motionSegments.filter(part=>
        part.phase===phase).reduce((total,part)=>total+
          (key==='seconds'?part.endSeconds-part.startSeconds:
            part.endPositionM-part.startPositionM),0);
      return {...row,positionM:state.positionM,
        distanceTravelledM:state.positionM-row.positionBeforeM,
        activeSeconds:sum('active','seconds'),
        activeDistanceM:sum('active','distance'),
        shelteredSeconds:sum('sheltered','seconds'),
        shelteredDistanceM:sum('sheltered','distance'),
        energySpent:row.energyAtDecision-state.energy,
        energyAfter:state.energy,
        elapsedToLineSeconds:null,
        motionSegments,
        laneBlocks:(row.laneBlocks??[])
          .filter(part=>part.startSeconds<durationSeconds-EPSILON)
          .map(part=>({...part,
            endSeconds:Math.min(part.endSeconds,durationSeconds)}))};
    });
    frames.push({...frame,endDistanceM:distanceM,
      durationSeconds,riders});
    clipped=true;
    break;
  }
  if(!clipped||frames.at(-1).riders.some(row=>
    Math.abs(row.positionBeforeM+row.activeDistanceM+
      row.shelteredDistanceM-row.positionM)>EPSILON||
    Math.abs(row.energyAtDecision-row.energySpent-
      row.energyAfter)>EPSILON))
    throw new Error('The paid contact split lost movement or energy.');
  return {roadBandId:band.roadBandId,frames,
    riderIds:frames[0].riders.map(row=>row.riderId)};
}

// Search all fixed source lanes on the paid, individually queued sprint
// tape. The first front-to-bunch wheel spacing, rather than a centre-line
// overlap, is the only defensible point at which to join active groups.
export function recordFinaleLateActiveWheelContact(positioned,
  front,bunch){
  const [frontSource,bunchSource]=positioned?.roadBands??[];
  const spacing=positioned?.wheelSpacingM;
  if(positioned?.roadBands?.length!==2||
    front?.roadBandId!==frontSource.id||
    bunch?.roadBandId!==bunchSource.id||
    !Number.isFinite(spacing)||spacing<=0||
    !Array.isArray(front.runner?.frames)||
    !Array.isArray(bunch.runner?.frames))
    throw new Error('Late wheel contact needs two queued paid bands.');
  const events=[];
  for(const frontSlot of frontSource.slots)
    for(const bunchSlot of bunchSource.slots){
      if(frontSlot.lane!==bunchSlot.lane)continue;
      const a=riderSegments(front,frontSlot.riderId);
      const b=riderSegments(bunch,bunchSlot.riderId);
      for(const left of a)for(const right of b){
        const start=Math.max(left.startSeconds,right.startSeconds);
        const end=Math.min(left.endSeconds,right.endSeconds);
        if(end<start-EPSILON)continue;
        const before=positionAt(left,start)-
          positionAt(right,start)-spacing;
        const after=positionAt(left,end)-
          positionAt(right,end)-spacing;
        if(before>EPSILON&&after>EPSILON)continue;
        const time=before<=EPSILON?start:
          start+before/(before-after)*(end-start);
        if(!Number.isFinite(time)||time<start-EPSILON||
          time>end+EPSILON)continue;
        events.push({lane:frontSlot.lane,
          frontRiderId:frontSlot.riderId,
          bunchRiderId:bunchSlot.riderId,
          elapsedSecondsFromLastKmStart:time,
          frontWheelM:positionAt(left,time),
          bunchWheelM:positionAt(right,time)});
      }
    }
  events.sort((a,b)=>a.elapsedSecondsFromLastKmStart-
    b.elapsedSecondsFromLastKmStart||a.lane-b.lane||
    a.frontRiderId.localeCompare(b.frontRiderId)||
    a.bunchRiderId.localeCompare(b.bunchRiderId));
  const first=events[0];
  if(!first)return null;
  const simultaneous=events.filter(row=>
    Math.abs(row.elapsedSecondsFromLastKmStart-
      first.elapsedSecondsFromLastKmStart)<=EPSILON&&
    Math.abs(row.frontWheelM-row.bunchWheelM-spacing)<=
      EPSILON);
  if(first.bunchWheelM<=positioned.startDistanceM+500||
    first.bunchWheelM>=positioned.lineDistanceM)
    return null;
  return {version:FINALE_LATE_ACTIVE_WHEEL_CONTACT_VERSION,
    sourcePositionVersion:positioned.version,
    status:'paid_occupied_lane_wheel_contact',
    atDistanceM:first.bunchWheelM,
    elapsedSecondsFromLastKmStart:
      first.elapsedSecondsFromLastKmStart,
    wheelSpacingM:spacing,
    frontRoadBandId:front.roadBandId,
    bunchRoadBandId:bunch.roadBandId,
    wheelPairs:simultaneous.map(row=>({
      lane:row.lane,frontRiderId:row.frontRiderId,
      bunchRiderId:row.bunchRiderId,
      frontWheelM:row.frontWheelM,
      bunchWheelM:row.bunchWheelM})),
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}
