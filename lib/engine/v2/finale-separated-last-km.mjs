import {isDeepStrictEqual} from 'node:util';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  FINALE_SEPARATED_LAST_KM_VERSION,
  FINALE_DEPLETED_LAST_KM_VERSION,
  FINALE_NO_FRONT_DROPPED_LAST_KM_VERSION,
  FINALE_COAST_DROPPED_LAST_KM_VERSION,
  FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_VERSION,
  FINALE_SINGLE_GROUP_LAST_KM_VERSION} from './finale-multi-run.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from './tuning.mjs';
import {assignFinishBandPlaces} from './finale-finish-order-bounds.mjs';

export const FINALE_SEPARATED_LAST_KM_CLOCK_VERSION=
  'v2-finale-separated-last-km-clock-1';
export const FINALE_DEPLETED_LAST_KM_CLOCK_VERSION=
  'v2-finale-depleted-last-km-clock-2';
export const FINALE_NO_FRONT_DROPPED_LAST_KM_CLOCK_VERSION=
  'v2-finale-no-front-dropped-last-km-clock-3';
export const FINALE_COAST_DROPPED_LAST_KM_CLOCK_VERSION=
  'v2-finale-coast-dropped-last-km-clock-4';
export const FINALE_SINGLE_GROUP_LAST_KM_CLOCK_VERSION=
  'v2-finale-single-group-last-km-clock-5';
export const FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_CLOCK_VERSION=
  'v2-finale-coast-no-front-dropped-last-km-clock-6';
const EPSILON=1e-7;

// Align independently paid group passage times to the bunch's last-kilometre
// marker. This proves road-band order only; no group member gets a wheel order.
export function recordFinaleSeparatedLastKmClock(tour){
  return recordActiveGroupLastKmClock(tour,false);
}

export function recordFinaleSingleGroupLastKmClock(tour){
  return recordActiveGroupLastKmClock(tour,true);
}

function recordActiveGroupLastKmClock(tour,singleGroup){
  if(singleGroup&&tour?.tuningVersion!==MOTOR_EXHAUSTION_COAST_VERSION)
    throw new Error('The single-group clock needs a v93 source.');
  const source=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:singleGroup?FINALE_SINGLE_GROUP_LAST_KM_VERSION:
      FINALE_SEPARATED_LAST_KM_VERSION});
  const lineDistanceM=tour.route.distanceKm*1000;
  const groupIds=source.roadGroups.map(group=>group.id);
  if(trace.sourceKm!==source.sourceKm||
    trace.frames[0]?.startDistanceM!==source.startDistanceM||
    trace.frames.at(-1)?.endDistanceM!==lineDistanceM||
    (singleGroup?groupIds.length!==1:groupIds.length<2))
    throw new Error('The separated clock needs one locked last-kilometre road.');
  const times=new Map(source.roadGroups.map(group=>[
    group.id,-group.gapSeconds]));
  let bunchTime=0;
  const passageFrames=trace.frames.map(frame=>{
    bunchTime+=frame.bunchElapsedSeconds;
    if(frame.roadGroups.length!==groupIds.length||
      frame.roadGroups.some((group,index)=>group.id!==groupIds[index]))
      throw new Error('The separated road changed its group identity.');
    const groups=frame.roadGroups.map(group=>{
      const time=times.get(group.id)+group.elapsedSeconds;
      times.set(group.id,time);
      if(Math.abs(bunchTime-time-group.gapSeconds)>EPSILON)
        throw new Error('The separated passage disagrees with its paid gap.');
      return {id:group.id,passageSecondsFromBunchMarker:time,
        gapSeconds:group.gapSeconds,riderIds:[...group.riderIds]};
    });
    return {distanceM:frame.endDistanceM,
      bunchPassageSecondsFromBunchMarker:bunchTime,groups};
  });
  const line=trace.frames.at(-1);
  const bands=assignFinishBandPlaces([
    ...line.roadGroups.map(group=>({id:group.id,kind:'road_group',
      riderIds:[...group.riderIds],
      passageSecondsFromBunchMarker:times.get(group.id)})),
    {id:'peloton',kind:'peloton',riderIds:[...line.pelotonRiderIds],
      passageSecondsFromBunchMarker:bunchTime}]);
  if(bands.some((band,index)=>index>0&&
    band.passageSecondsFromBunchMarker<=
      bands[index-1].passageSecondsFromBunchMarker+EPSILON))
    throw new Error('The separated line bands crossed without contact.');
  const locked=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>({riderId:rider.id,teamId:team.id})));
  const energy=new Map(trace.finalRiderEnergy.map(row=>[
    row.riderId,row.energy]));
  const bandByRider=new Map(bands.flatMap(band=>band.riderIds
    .map(riderId=>[riderId,band])));
  if(energy.size!==locked.length||bandByRider.size!==locked.length||
    locked.some(row=>!energy.has(row.riderId)||
      !bandByRider.has(row.riderId))||
    bands.at(-1).lastPossiblePlace!==locked.length)
    throw new Error('The separated line lost a locked rider.');
  return {version:singleGroup?
    FINALE_SINGLE_GROUP_LAST_KM_CLOCK_VERSION:
    FINALE_SEPARATED_LAST_KM_CLOCK_VERSION,
    traceVersion:trace.version,sourceSnapshotVersion:source.version,
    sourceKm:source.sourceKm,lineDistanceM,trace,passageFrames,
    line:{outcome:'separated',bands,
      finalRiderEnergy:trace.finalRiderEnergy,
      riders:locked.map(row=>({...row,
        energyAtLine:energy.get(row.riderId),
        bandId:bandByRider.get(row.riderId).id,
        firstPossiblePlace:bandByRider.get(row.riderId).firstPossiblePlace,
        lastPossiblePlace:bandByRider.get(row.riderId).lastPossiblePlace}))},
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleSeparatedLastKmClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,recordFinaleSeparatedLastKmClock(tour)))
    throw new Error('The separated last-kilometre clock does not replay.');
  return true;
}

export function validateFinaleSingleGroupLastKmClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,recordFinaleSingleGroupLastKmClock(tour)))
    throw new Error('The single-group last-kilometre clock does not replay.');
  return true;
}

// The kilometre motor lets exhausted riders continue after their reserve
// reaches zero. This separate, non-awarding version carries that saturation
// visibly instead of claiming the remaining work was paid from energy.
function recordDepletedLastKmClock(tour,{noFront=false,coastDropped=false}={}){
  if(coastDropped&&tour.tuningVersion!==MOTOR_EXHAUSTION_COAST_VERSION)
    throw new Error('The coasted last-kilometre clock needs a v93 source.');
  const source=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:coastDropped&&noFront?
      FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_VERSION:
      coastDropped?FINALE_COAST_DROPPED_LAST_KM_VERSION:
      noFront?FINALE_NO_FRONT_DROPPED_LAST_KM_VERSION:
      FINALE_DEPLETED_LAST_KM_VERSION});
  const lineDistanceM=tour.route.distanceKm*1000;
  const groupIds=source.roadGroups.map(group=>group.id);
  const sourceRows=new Map(tour.frames[source.sourceKm-1]
    .riderGroups.map(row=>[row.id,row]));
  const dropped=source.droppedRiderIds.map(riderId=>{
    const row=sourceRows.get(riderId);
    if(row?.group!=='dropped'||!Number.isFinite(row.deficitSeconds)||
      row.deficitSeconds<=0)
      throw new Error('The depleted line needs recorded source deficits.');
    return {riderId,deficitSeconds:row.deficitSeconds};
  });
  if((noFront?groupIds.length!==0:groupIds.length<1)||!dropped.length||
    trace.sourceKm!==source.sourceKm||
    trace.frames[0]?.startDistanceM!==source.startDistanceM||
    trace.frames.at(-1)?.endDistanceM!==lineDistanceM)
    throw new Error('The depleted clock needs one locked last-kilometre road.');
  const groupTimes=new Map(source.roadGroups.map(group=>[
    group.id,-group.gapSeconds]));
  const droppedTimes=new Map(dropped.map(row=>[
    row.riderId,row.deficitSeconds]));
  let bunchTime=0;
  const passageFrames=trace.frames.map(frame=>{
    bunchTime+=frame.bunchElapsedSeconds;
    if(frame.roadGroups.length!==groupIds.length||
      frame.roadGroups.some((group,index)=>group.id!==groupIds[index])||
      frame.droppedTravel?.riders.length!==dropped.length)
      throw new Error('The depleted road changed its group identity.');
    const groups=frame.roadGroups.map(group=>{
      const time=groupTimes.get(group.id)+group.elapsedSeconds;
      groupTimes.set(group.id,time);
      if(Math.abs(bunchTime-time-group.gapSeconds)>EPSILON)
        throw new Error('The depleted group passage disagrees with its gap.');
      return {id:group.id,passageSecondsFromBunchMarker:time,
        gapSeconds:group.gapSeconds,riderIds:[...group.riderIds]};
    });
    const droppedPassages=frame.droppedTravel.riders.map(row=>{
      if(!droppedTimes.has(row.riderId))
        throw new Error('The depleted road gained a dropped rider.');
      const time=droppedTimes.get(row.riderId)+row.elapsedSeconds;
      droppedTimes.set(row.riderId,time);
      if(Math.abs(time-bunchTime-row.deficitSecondsAfter)>EPSILON)
        throw new Error('The depleted passage disagrees with its deficit.');
      return {riderId:row.riderId,
        passageSecondsFromBunchMarker:time,
        deficitSeconds:row.deficitSecondsAfter,
        energySpent:row.energySpent,
        ...(coastDropped?{curtailedEnergyDemand:row.curtailedEnergyDemand,
          sustainableFraction:row.sustainableFraction}:
          {unmetEnergyDemand:row.unmetEnergyDemand})};
    });
    return {distanceM:frame.endDistanceM,
      bunchPassageSecondsFromBunchMarker:bunchTime,
      groups,droppedPassages};
  });
  const line=trace.frames.at(-1);
  const bands=assignFinishBandPlaces([
    ...line.roadGroups.map(group=>({id:group.id,kind:'road_group',
      riderIds:[...group.riderIds],
      passageSecondsFromBunchMarker:groupTimes.get(group.id)})),
    {id:'peloton',kind:'peloton',riderIds:[...line.pelotonRiderIds],
      passageSecondsFromBunchMarker:bunchTime},
    {id:'dropped',kind:'unresolved_dropped',
      riderIds:[...source.droppedRiderIds],
      firstPassageSecondsFromBunchMarker:
        Math.min(...droppedTimes.values()),
      lastPassageSecondsFromBunchMarker:
        Math.max(...droppedTimes.values())}]);
  if(bands.slice(0,-2).some((band,index)=>index>0&&
    band.passageSecondsFromBunchMarker<=
      bands[index-1].passageSecondsFromBunchMarker+EPSILON)||
    groupIds.length>0&&
      bands.at(-3).passageSecondsFromBunchMarker>=bunchTime-EPSILON||
    bands.at(-1).firstPassageSecondsFromBunchMarker<=bunchTime+EPSILON)
    throw new Error('The depleted line bands crossed without contact.');
  const locked=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>({riderId:rider.id,teamId:team.id})));
  const energy=new Map(trace.finalRiderEnergy.map(row=>[
    row.riderId,row.energy]));
  const bandByRider=new Map(bands.flatMap(band=>band.riderIds
    .map(riderId=>[riderId,band])));
  if(energy.size!==locked.length||bandByRider.size!==locked.length||
    locked.some(row=>!energy.has(row.riderId)||
      !bandByRider.has(row.riderId))||
    bands.at(-1).lastPossiblePlace!==locked.length)
    throw new Error('The depleted line lost a locked rider.');
  return {version:coastDropped&&noFront?
    FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_CLOCK_VERSION:
    coastDropped?FINALE_COAST_DROPPED_LAST_KM_CLOCK_VERSION:
    noFront?FINALE_NO_FRONT_DROPPED_LAST_KM_CLOCK_VERSION:
    FINALE_DEPLETED_LAST_KM_CLOCK_VERSION,
    traceVersion:trace.version,sourceSnapshotVersion:source.version,
    sourceKm:source.sourceKm,lineDistanceM,trace,passageFrames,
    line:{outcome:coastDropped&&noFront?'bunch_with_coasted_dropped':
      noFront?'bunch_with_dropped_reserve':
      'separated_with_depleted_reserve',bands,
      finalRiderEnergy:trace.finalRiderEnergy,
      riders:locked.map(row=>({...row,
        energyAtLine:energy.get(row.riderId),
        bandId:bandByRider.get(row.riderId).id,
        firstPossiblePlace:bandByRider.get(row.riderId).firstPossiblePlace,
        lastPossiblePlace:bandByRider.get(row.riderId).lastPossiblePlace}))},
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function recordFinaleDepletedLastKmClock(tour){
  return recordDepletedLastKmClock(tour);
}

export function recordFinaleNoFrontDroppedLastKmClock(tour){
  return recordDepletedLastKmClock(tour,{noFront:true});
}

export function recordFinaleCoastDroppedLastKmClock(tour){
  return recordDepletedLastKmClock(tour,{coastDropped:true});
}

export function recordFinaleCoastNoFrontDroppedLastKmClock(tour){
  return recordDepletedLastKmClock(tour,{
    noFront:true,coastDropped:true});
}

export function validateFinaleCoastNoFrontDroppedLastKmClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastNoFrontDroppedLastKmClock(tour)))
    throw new Error('The coasted no-front clock does not replay.');
  return true;
}

export function validateFinaleCoastDroppedLastKmClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,recordFinaleCoastDroppedLastKmClock(tour)))
    throw new Error('The coasted last-kilometre clock does not replay.');
  return true;
}

export function validateFinaleDepletedLastKmClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,recordFinaleDepletedLastKmClock(tour)))
    throw new Error('The depleted last-kilometre clock does not replay.');
  return true;
}

export function validateFinaleNoFrontDroppedLastKmClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleNoFrontDroppedLastKmClock(tour)))
    throw new Error('The no-front dropped last-kilometre clock does not replay.');
  return true;
}
