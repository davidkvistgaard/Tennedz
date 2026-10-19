import {isDeepStrictEqual} from 'node:util';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  FINALE_SEPARATED_LAST_KM_VERSION} from './finale-multi-run.mjs';
import {assignFinishBandPlaces} from './finale-finish-order-bounds.mjs';

export const FINALE_SEPARATED_LAST_KM_CLOCK_VERSION=
  'v2-finale-separated-last-km-clock-1';
const EPSILON=1e-7;

// Align independently paid group passage times to the bunch's last-kilometre
// marker. This proves road-band order only; no group member gets a wheel order.
export function recordFinaleSeparatedLastKmClock(tour){
  const source=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_SEPARATED_LAST_KM_VERSION});
  const lineDistanceM=tour.route.distanceKm*1000;
  const groupIds=source.roadGroups.map(group=>group.id);
  if(trace.sourceKm!==source.sourceKm||
    trace.frames[0]?.startDistanceM!==source.startDistanceM||
    trace.frames.at(-1)?.endDistanceM!==lineDistanceM||
    groupIds.length<2)
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
  return {version:FINALE_SEPARATED_LAST_KM_CLOCK_VERSION,
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
