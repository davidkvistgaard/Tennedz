import {isDeepStrictEqual} from 'node:util';
import {simulateFinaleGroupToLine} from './finale-group-run.mjs';

export const FINALE_GROUP_COMMON_CLOCK_VERSION=
  'v2-finale-group-common-clock-1';
const EPSILON=1e-7;

function frontAtTime(passages,seconds){
  const last=passages.at(-1);
  if(seconds>=last.seconds-EPSILON)return {
    positionM:last.distanceM,energy:last.energy};
  for(let index=1;index<passages.length;index++){
    const end=passages[index];
    if(seconds>end.seconds+EPSILON)continue;
    const start=passages[index-1];
    const fraction=Math.max(0,Math.min(1,
      (seconds-start.seconds)/(end.seconds-start.seconds)));
    const before=new Map(start.energy.map(row=>[row.riderId,row.energy]));
    return {positionM:start.distanceM+
      (end.distanceM-start.distanceM)*fraction,
    energy:end.energy.map(row=>({riderId:row.riderId,
      energy:before.get(row.riderId)+
        (row.energy-before.get(row.riderId))*fraction}))};
  }
  throw new Error('The cooperative front has no common-time passage.');
}

// The source gap is a passage-time difference at the same kilometre marker.
// Align the already paid constant-speed slices on the bunch's marker clock.
// This reconstructs band positions, never wheel order within either band.
export function simulateFinaleCooperativeGroupCommonClock(input){
  if(input?.cooperativeFront!==true||
    input.snapshot?.remainingM!==1000||
    input.snapshot.roadGroups?.length!==1||
    input.snapshot.droppedRiderIds?.length)
    throw new Error('A common-clock group needs one complete paid last-kilometre road.');
  const line=simulateFinaleGroupToLine(input);
  if(line.version!=='v2-finale-group-cooperative-to-line-12'||
    !['survived','caught_merged'].includes(line.outcome))
    throw new Error('A common-clock group needs the cooperative paid line.');
  const snapshot=input.snapshot;
  const frontIds=new Set(snapshot.roadGroups[0].riderIds);
  const sourceEnergy=id=>snapshot.riders.find(row=>row.riderId===id)?.energy;
  const passages=[{distanceM:snapshot.startDistanceM,
    seconds:-snapshot.roadGroups[0].gapSeconds,
    energy:[...frontIds].map(riderId=>({riderId,
      energy:sourceEnergy(riderId)}))}];
  let frontSeconds=passages[0].seconds;
  let bunchSeconds=0;
  for(const frame of line.approachFrames){
    frontSeconds+=frame.frontElapsedSeconds;
    passages.push({distanceM:frame.endDistanceM,seconds:frontSeconds,
      energy:frame.riders.filter(row=>frontIds.has(row.riderId))
        .map(row=>({riderId:row.riderId,energy:row.energy}))});
  }
  const roadFrames=[];
  function recordBand(distanceM,time,energy,contact=false){
    const front=frontAtTime(passages,time);
    if(front.positionM+EPSILON<distanceM||
      front.positionM>input.route.distanceKm*1000+EPSILON||
      front.energy.length!==frontIds.size)
      throw new Error('The paid front crossed behind the bunch.');
    roadFrames.push({elapsedSecondsFromBunchMarker:time,
      bunchPositionM:distanceM,
      frontPositionM:front.positionM,
      frontRiderEnergy:front.energy,
      bunchRiderEnergy:energy,
      contact});
  }
  recordBand(snapshot.startDistanceM,0,
    snapshot.riders.filter(row=>!frontIds.has(row.riderId))
      .map(row=>({riderId:row.riderId,energy:row.energy})));
  for(const frame of line.approachFrames){
    bunchSeconds+=frame.pelotonElapsedSeconds;
    const frontPassage=passages.find(row=>
      Math.abs(row.distanceM-frame.endDistanceM)<EPSILON);
    const gap=bunchSeconds-frontPassage.seconds;
    if(Math.abs(gap-(frame.roadGroups[0]?.gapSeconds??0))>EPSILON||
      frame.event&&Math.abs(gap)>EPSILON)
      throw new Error('The recorded gap disagrees with the common clock.');
    recordBand(frame.endDistanceM,bunchSeconds,
      frame.riders.filter(row=>!frontIds.has(row.riderId))
        .map(row=>({riderId:row.riderId,energy:row.energy})),
      Boolean(frame.event));
  }
  for(const frame of line.mergedFrames){
    bunchSeconds+=frame.travelSeconds;
    roadFrames.push({elapsedSecondsFromBunchMarker:bunchSeconds,
      bunchPositionM:frame.endDistanceM,frontPositionM:null,
      frontRiderEnergy:[],
      bunchRiderEnergy:frame.riders.map(row=>({
        riderId:row.riderId,energy:row.energy})),contact:false});
  }
  const frontLineTime=line.outcome==='survived'?passages.at(-1).seconds:null;
  const bunchLineTime=bunchSeconds;
  if(Math.abs(bunchLineTime-
    line.bunchTravelSecondsFromLastKm)>EPSILON||
    line.outcome==='survived'&&
    (Math.abs(frontLineTime-
      line.lineBandTimesFromBunchLastKmStart.front)>EPSILON||
    Math.abs(bunchLineTime-
      line.lineBandTimesFromBunchLastKmStart.bunch)>EPSILON))
    throw new Error('The common-clock line differs from paid band passages.');
  return {version:FINALE_GROUP_COMMON_CLOCK_VERSION,
    sourceLineVersion:line.version,sourceSnapshotVersion:snapshot.version,
    startDistanceM:snapshot.startDistanceM,
    lineDistanceM:input.route.distanceKm*1000,
    sourceGapSeconds:snapshot.roadGroups[0].gapSeconds,
    line,roadFrames,frontLineTime,bunchLineTime,
    roadStatus:'inferred_common_clock_bands',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleCooperativeGroupCommonClock(input,recorded){
  if(!isDeepStrictEqual(recorded,
    simulateFinaleCooperativeGroupCommonClock(input)))
    throw new Error('The cooperative group common clock does not replay.');
  return true;
}
