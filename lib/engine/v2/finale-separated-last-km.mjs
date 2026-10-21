import {isDeepStrictEqual} from 'node:util';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  FINALE_SEPARATED_LAST_KM_VERSION,
  FINALE_DEPLETED_LAST_KM_VERSION,
  FINALE_NO_FRONT_DROPPED_LAST_KM_VERSION,
  FINALE_COAST_DROPPED_LAST_KM_VERSION,
  FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_VERSION,
  FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_VERSION,
  FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION,
  FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_VERSION,
  FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_VERSION,
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
export const FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_CLOCK_VERSION=
  'v2-finale-coast-dynamic-no-front-last-km-clock-7';
export const FINALE_COAST_DYNAMIC_FRONT_LAST_KM_CLOCK_VERSION=
  'v2-finale-coast-dynamic-front-last-km-clock-8';
export const FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_CLOCK_VERSION=
  'v2-finale-coast-dynamic-active-last-km-clock-9';
export const FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_CLOCK_VERSION=
  'v2-finale-coast-dynamic-single-last-km-clock-10';
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
function recordDepletedLastKmClock(tour,{noFront=false,coastDropped=false,
  dynamicNoFront=false,dynamicFront=false,dynamicActive=false,
  dynamicSingle=false}={}){
  dynamicFront=dynamicFront||dynamicActive||dynamicSingle;
  if(dynamicNoFront&&(!noFront||!coastDropped))
    throw new Error('Dynamic dropped travel needs a coasted no-front road.');
  if(dynamicFront&&(noFront||!coastDropped))
    throw new Error('Dynamic front travel needs a coasted front road.');
  if(coastDropped&&tour.tuningVersion!==MOTOR_EXHAUSTION_COAST_VERSION)
    throw new Error('The coasted last-kilometre clock needs a v93 source.');
  const source=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:dynamicSingle?
      FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_VERSION:
      dynamicActive?
      FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_VERSION:
      dynamicFront?
      FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION:
      dynamicNoFront?
      FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_VERSION:
      coastDropped&&noFront?
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
  if((noFront?groupIds.length!==0:groupIds.length<1)||
    !dynamicFront&&!dropped.length||
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
    const startBunchTime=bunchTime;
    bunchTime+=frame.bunchElapsedSeconds;
    if(dynamicNoFront||dynamicFront)for(const row of frame.exhaustionDrops){
      if(row.atDistanceM!==frame.startDistanceM||
        droppedTimes.has(row.riderId))
        throw new Error('The dynamic drop needs a unique recorded boundary.');
      droppedTimes.set(row.riderId,startBunchTime);
    }
    if(dynamicFront)for(const row of frame.frontExhaustionDrops){
      if(row.atDistanceM!==frame.startDistanceM||
        !frame.roadGroups.some(group=>group.id===row.fromRoadGroupId)||
        row.initialDeficitSeconds>=0||
        droppedTimes.has(row.riderId))
        throw new Error('The front drop needs a unique recorded boundary.');
      droppedTimes.set(row.riderId,
        startBunchTime+row.initialDeficitSeconds);
    }
    if(frame.roadGroups.length!==groupIds.length||
      frame.roadGroups.some((group,index)=>group.id!==groupIds[index])||
      frame.droppedTravel?.riders.length!==droppedTimes.size)
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
          sustainableFraction:row.sustainableFraction,
          ...(dynamicFront?{contactDistanceM:row.contactDistanceM,
            contactStatus:row.contactStatus}:{})}:
          {unmetEnergyDemand:row.unmetEnergyDemand})};
    });
    return {distanceM:frame.endDistanceM,
      bunchPassageSecondsFromBunchMarker:bunchTime,
      groups,droppedPassages};
  });
  const line=trace.frames.at(-1);
  const finalDropped=dynamicNoFront||dynamicFront?
    trace.finalDroppedRiderIds:
    source.droppedRiderIds;
  if((dynamicNoFront||dynamicFront)&&(!Array.isArray(finalDropped)||
    finalDropped.length!==droppedTimes.size||
    finalDropped.some(id=>!droppedTimes.has(id))))
    throw new Error('The dynamic line lost a recorded dropped rider.');
  if(dynamicSingle&&[...droppedTimes.values()].some(time=>
    time>=bunchTime-EPSILON))
    throw new Error('The dynamic single-front line needs a separate bunch-pass contact.');
  const frontExits=dynamicFront&&!dynamicActive&&!dynamicSingle?
    trace.frames.flatMap(frame=>frame.frontExhaustionDrops??[]):[];
  // A leaver who stays ahead is not part of the rear dropped band. Keep all
  // fronts and their leavers in one unresolved range: the source recorded no
  // wheel order at the split, even when every paid passage clears the bunch.
  const frontLeaversAhead=frontExits.length>0&&groupIds.length>=2&&
    frontExits.every(row=>row.atDistanceM===source.startDistanceM&&
      row.fromRoadGroupId===groupIds[0])&&
    trace.frames.every(frame=>!frame.exhaustionDrops.length)&&
    passageFrames.every(frame=>
      frame.groups.every(group=>group.passageSecondsFromBunchMarker<
        frame.bunchPassageSecondsFromBunchMarker-EPSILON)&&
      frontExits.every(exit=>{
        const row=frame.droppedPassages.find(value=>
          value.riderId===exit.riderId);
        return row&&row.contactDistanceM===null&&
          row.passageSecondsFromBunchMarker<
            frame.bunchPassageSecondsFromBunchMarker-EPSILON;
      })&&source.droppedRiderIds.every(id=>
        frame.droppedPassages.find(row=>row.riderId===id)
          ?.passageSecondsFromBunchMarker>
          frame.bunchPassageSecondsFromBunchMarker+EPSILON));
  const bands=dynamicSingle?assignFinishBandPlaces([{
    id:'unresolved_finale_contact',kind:'unresolved_contact',
    riderIds:tour.committedInputs.teams.flatMap(team=>
      team.riders.map(rider=>rider.id))}]):frontLeaversAhead?
    assignFinishBandPlaces([
      {id:'front_with_leavers',kind:'unresolved_front_with_leavers',
        riderIds:[...line.roadGroups.flatMap(group=>group.riderIds),
          ...frontExits.map(row=>row.riderId)]},
      {id:'peloton',kind:'peloton',riderIds:[...line.pelotonRiderIds],
        passageSecondsFromBunchMarker:bunchTime},
      ...(source.droppedRiderIds.length?[{id:'dropped',kind:'unresolved_dropped',
        riderIds:[...source.droppedRiderIds],
        firstPassageSecondsFromBunchMarker:Math.min(...source.droppedRiderIds
          .map(id=>droppedTimes.get(id))),
        lastPassageSecondsFromBunchMarker:Math.max(...source.droppedRiderIds
          .map(id=>droppedTimes.get(id)))}]:[])]):assignFinishBandPlaces([
    ...line.roadGroups.map(group=>({id:group.id,kind:'road_group',
      riderIds:[...group.riderIds],
      passageSecondsFromBunchMarker:groupTimes.get(group.id)})),
    {id:'peloton',kind:'peloton',riderIds:[...line.pelotonRiderIds],
      passageSecondsFromBunchMarker:bunchTime},
    {id:'dropped',kind:'unresolved_dropped',
      riderIds:[...finalDropped],
      firstPassageSecondsFromBunchMarker:
        Math.min(...droppedTimes.values()),
      lastPassageSecondsFromBunchMarker:
        Math.max(...droppedTimes.values())}]);
  if(!dynamicSingle&&!frontLeaversAhead&&
    (bands.slice(0,-2).some((band,index)=>index>0&&
    band.passageSecondsFromBunchMarker<=
      bands[index-1].passageSecondsFromBunchMarker+EPSILON)||
    groupIds.length>0&&
      bands.at(-3).passageSecondsFromBunchMarker>=bunchTime-EPSILON||
    bands.at(-1).firstPassageSecondsFromBunchMarker<=bunchTime+EPSILON))
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
  return {version:dynamicSingle?
    FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_CLOCK_VERSION:
    dynamicActive?
    FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_CLOCK_VERSION:
    dynamicFront?
    FINALE_COAST_DYNAMIC_FRONT_LAST_KM_CLOCK_VERSION:
    dynamicNoFront?
    FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_CLOCK_VERSION:
    coastDropped&&noFront?
    FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_CLOCK_VERSION:
    coastDropped?FINALE_COAST_DROPPED_LAST_KM_CLOCK_VERSION:
    noFront?FINALE_NO_FRONT_DROPPED_LAST_KM_CLOCK_VERSION:
    FINALE_DEPLETED_LAST_KM_CLOCK_VERSION,
    traceVersion:trace.version,sourceSnapshotVersion:source.version,
    sourceKm:source.sourceKm,lineDistanceM,trace,passageFrames,
    line:{outcome:dynamicSingle?'single_front_with_coasted_drops':
      dynamicActive?'front_with_coasted_bunch_drops':
      frontLeaversAhead?'front_leavers_ahead_of_bunch_contact_unresolved':
      dynamicFront?'front_with_coasted_new_drops':
      dynamicNoFront?'bunch_with_coasted_new_drops':
      coastDropped&&noFront?'bunch_with_coasted_dropped':
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

export function recordFinaleCoastDynamicNoFrontLastKmClock(tour){
  return recordDepletedLastKmClock(tour,{
    noFront:true,coastDropped:true,dynamicNoFront:true});
}

export function recordFinaleCoastDynamicFrontLastKmClock(tour){
  return recordDepletedLastKmClock(tour,{
    coastDropped:true,dynamicFront:true});
}

export function recordFinaleCoastDynamicActiveLastKmClock(tour){
  return recordDepletedLastKmClock(tour,{
    coastDropped:true,dynamicActive:true});
}

export function recordFinaleCoastDynamicSingleLastKmClock(tour){
  return recordDepletedLastKmClock(tour,{
    coastDropped:true,dynamicSingle:true});
}

export function validateFinaleCoastDynamicSingleLastKmClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastDynamicSingleLastKmClock(tour)))
    throw new Error('The dynamic single-front clock does not replay.');
  return true;
}

export function validateFinaleCoastDynamicActiveLastKmClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastDynamicActiveLastKmClock(tour)))
    throw new Error('The dynamic active clock does not replay.');
  return true;
}

export function validateFinaleCoastDynamicFrontLastKmClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastDynamicFrontLastKmClock(tour)))
    throw new Error('The dynamic front clock does not replay.');
  return true;
}

export function validateFinaleCoastDynamicNoFrontLastKmClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastDynamicNoFrontLastKmClock(tour)))
    throw new Error('The dynamic no-front clock does not replay.');
  return true;
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
