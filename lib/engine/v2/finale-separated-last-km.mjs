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
  FINALE_COAST_DISSOLVED_FRONT_LAST_KM_VERSION,
  FINALE_COAST_DISSOLVED_ALL_FRONTS_LAST_KM_VERSION,
  FINALE_COAST_DISSOLVED_FRONT_DROPPED_LAST_KM_VERSION,
  FINALE_COAST_DISSOLVED_SINGLE_LAST_KM_VERSION,
  FINALE_COAST_FRONT_CATCH_LAST_KM_VERSION,
  FINALE_SINGLE_GROUP_LAST_KM_VERSION} from './finale-multi-run.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from './tuning.mjs';
import {LANES} from './finale-positioned-source.mjs';
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
export const FINALE_COAST_FRONT_CATCH_LAST_KM_CLOCK_VERSION=
  'v2-finale-coast-front-catch-last-km-clock-11';
export const FINALE_COAST_DISSOLVED_LEADING_LAST_KM_CLOCK_VERSION=
  'v2-finale-coast-dissolved-leading-last-km-clock-12';
export const FINALE_COAST_DISSOLVED_ALL_FRONTS_LAST_KM_CLOCK_VERSION=
  'v2-finale-coast-dissolved-all-fronts-last-km-clock-13';
export const FINALE_COAST_DISSOLVED_FRONT_DROPPED_LAST_KM_CLOCK_VERSION=
  'v2-finale-coast-dissolved-front-dropped-last-km-clock-14';
export const FINALE_COAST_DISSOLVED_SINGLE_LAST_KM_CLOCK_VERSION=
  'v2-finale-coast-dissolved-single-last-km-clock-15';
export const FINALE_COAST_DISSOLVED_SURVIVOR_PASS_CLOCK_VERSION=
  'v2-finale-coast-dissolved-survivor-pass-clock-16';
export const FINALE_COAST_DISSOLVED_THREE_FRONT_CLOCK_VERSION=
  'v2-finale-coast-dissolved-three-front-clock-17';
export const FINALE_COAST_MIXED_FRONT_CLEAR_CLOCK_VERSION=
  'v2-finale-coast-mixed-front-clear-clock-18';
export const FINALE_COAST_MIXED_FRONT_LATE_PASS_CLOCK_VERSION=
  'v2-finale-coast-mixed-front-late-pass-clock-19';
export const FINALE_COAST_MIXED_THREE_FRONT_CLEAR_CLOCK_VERSION=
  'v2-finale-coast-mixed-three-front-clear-clock-20';
export const FINALE_COAST_MIXED_FRONT_PARALLEL_PASS_CLOCK_VERSION=
  'v2-finale-coast-mixed-front-parallel-pass-clock-21';
export const FINALE_COAST_MIXED_THREE_FRONT_DROPPED_CLOCK_VERSION=
  'v2-finale-coast-mixed-three-front-dropped-clock-22';
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

// A single front group may be caught before the 500 m sprint handoff. The
// trace pays the exact pre-contact and merged travel, while the already
// isolated riders keep their independent passage times. No wheel order or
// official placing is inferred from the group merge.
export function recordFinaleCoastFrontCatchLastKmClock(tour){
  if(tour?.tuningVersion!==MOTOR_EXHAUSTION_COAST_VERSION)
    throw new Error('The front-catch clock needs a v93 source.');
  const source=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_FRONT_CATCH_LAST_KM_VERSION});
  const finishM=tour.route.distanceKm*1000;
  const contact=trace.frames.find(frame=>frame.contact)?.contact;
  const sourceFrame=tour.frames[source.sourceKm-1];
  const sourceRows=new Map(sourceFrame.riderGroups.map(row=>[row.id,row]));
  if(source.roadGroups.length!==1||
    !source.droppedRiderIds.length||
    trace.frames[0]?.contact!==contact||
    trace.frames.at(-1)?.endDistanceM!==finishM||
    contact?.groupId!==source.roadGroups[0].id||
    contact.atDistanceM<=source.startDistanceM||
    contact.atDistanceM>=finishM-500||
    trace.frames.some((frame,index)=>
      index>0&&frame.contact||
      frame.roadGroups.length||
      frame.exhaustionDrops.length||
      frame.droppedTravel?.riders.length!==source.droppedRiderIds.length))
    throw new Error('The front-catch clock needs one paid early merge.');
  const droppedTimes=new Map(source.droppedRiderIds.map(id=>{
    const row=sourceRows.get(id);
    if(row?.group!=='dropped'||!Number.isFinite(row.deficitSeconds)||
      row.deficitSeconds<=0)
      throw new Error('A front-catch dropped rider needs a source deficit.');
    return [id,row.deficitSeconds];
  }));
  const mergedIds=[...source.peloton.riderIds,
    ...source.roadGroups[0].riderIds];
  let bunchTime=0;
  const passageFrames=trace.frames.map(frame=>{
    bunchTime+=frame.bunchElapsedSeconds;
    if(frame.pelotonRiderIds.length!==mergedIds.length||
      mergedIds.some(id=>!frame.pelotonRiderIds.includes(id)))
      throw new Error('The front-catch bunch lost a merged rider.');
    const droppedPassages=frame.droppedTravel.riders.map(row=>{
      const time=droppedTimes.get(row.riderId)+row.elapsedSeconds;
      if(!Number.isFinite(time)||
        Math.abs(time-bunchTime-row.deficitSecondsAfter)>EPSILON||
        time<=bunchTime+EPSILON)
        throw new Error('The front-catch road needs isolated riders behind.');
      droppedTimes.set(row.riderId,time);
      return {riderId:row.riderId,
        passageSecondsFromBunchMarker:time,
        deficitSeconds:row.deficitSecondsAfter,
        energySpent:row.energySpent,
        curtailedEnergyDemand:row.curtailedEnergyDemand,
        sustainableFraction:row.sustainableFraction};
    });
    return {distanceM:frame.endDistanceM,
      bunchPassageSecondsFromBunchMarker:bunchTime,
      groups:[],droppedPassages};
  });
  const bands=assignFinishBandPlaces([
    {id:'peloton',kind:'peloton',riderIds:mergedIds,
      passageSecondsFromBunchMarker:bunchTime},
    {id:'dropped',kind:'unresolved_dropped',
      riderIds:[...source.droppedRiderIds],
      firstPassageSecondsFromBunchMarker:
        Math.min(...droppedTimes.values()),
      lastPassageSecondsFromBunchMarker:
        Math.max(...droppedTimes.values())}]);
  const locked=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>({riderId:rider.id,teamId:team.id})));
  const energy=new Map(trace.finalRiderEnergy.map(row=>[
    row.riderId,row.energy]));
  const bandByRider=new Map(bands.flatMap(band=>
    band.riderIds.map(id=>[id,band])));
  if(energy.size!==locked.length||
    bandByRider.size!==locked.length||
    locked.some(row=>!energy.has(row.riderId)||
      !bandByRider.has(row.riderId))||
    bands.at(-1).lastPossiblePlace!==locked.length)
    throw new Error('The front-catch line lost a locked rider.');
  return {version:FINALE_COAST_FRONT_CATCH_LAST_KM_CLOCK_VERSION,
    traceVersion:trace.version,sourceSnapshotVersion:source.version,
    sourceKm:source.sourceKm,lineDistanceM:finishM,
    contact,trace,passageFrames,
    line:{outcome:'front_caught_with_coasted_dropped',bands,
      finalRiderEnergy:trace.finalRiderEnergy,
      riders:locked.map(row=>({...row,
        energyAtLine:energy.get(row.riderId),
        bandId:bandByRider.get(row.riderId).id,
        firstPossiblePlace:
          bandByRider.get(row.riderId).firstPossiblePlace,
        lastPossiblePlace:
          bandByRider.get(row.riderId).lastPossiblePlace}))},
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleCoastFrontCatchLastKmClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastFrontCatchLastKmClock(tour)))
    throw new Error('The front-catch last-kilometre clock does not replay.');
  return true;
}

// The kilometre motor lets exhausted riders continue after their reserve
// reaches zero. This separate, non-awarding version carries that saturation
// visibly instead of claiming the remaining work was paid from energy.
function recordDepletedLastKmClock(tour,{noFront=false,coastDropped=false,
  dynamicNoFront=false,dynamicFront=false,dynamicActive=false,
  dynamicSingle=false,dissolvedLeading=false,dissolvedAllFronts=false,
  dissolvedLeadingDropped=false,dissolvedSingle=false,
  dissolvedLeadingPass=false,dissolvedThreeFront=false,
  mixedFrontClear=false,mixedFrontLatePass=false,
  mixedThreeFrontClear=false,mixedFrontParallelPass=false,
  mixedThreeFrontDropped=false}={}){
  const leadingDissolution=dissolvedLeading||dissolvedLeadingDropped||
    dissolvedLeadingPass||dissolvedThreeFront;
  dynamicFront=dynamicFront||dynamicActive||dynamicSingle||
    leadingDissolution||dissolvedAllFronts||dissolvedSingle;
  if(dynamicNoFront&&(!noFront||!coastDropped))
    throw new Error('Dynamic dropped travel needs a coasted no-front road.');
  if(dynamicFront&&(noFront||!coastDropped))
    throw new Error('Dynamic front travel needs a coasted front road.');
  if(coastDropped&&tour.tuningVersion!==MOTOR_EXHAUSTION_COAST_VERSION)
    throw new Error('The coasted last-kilometre clock needs a v93 source.');
  const source=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:dissolvedSingle?
      FINALE_COAST_DISSOLVED_SINGLE_LAST_KM_VERSION:
      dissolvedAllFronts?
      FINALE_COAST_DISSOLVED_ALL_FRONTS_LAST_KM_VERSION:
      dissolvedLeadingDropped?
      FINALE_COAST_DISSOLVED_FRONT_DROPPED_LAST_KM_VERSION:
      dissolvedLeading||dissolvedLeadingPass||dissolvedThreeFront?
      FINALE_COAST_DISSOLVED_FRONT_LAST_KM_VERSION:
      dynamicSingle?
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
        !(leadingDissolution||dissolvedAllFronts||dissolvedSingle?
          groupIds.includes(row.fromRoadGroupId):
          frame.roadGroups.some(group=>group.id===row.fromRoadGroupId))||
        row.initialDeficitSeconds>=0||
        droppedTimes.has(row.riderId))
        throw new Error('The front drop needs a unique recorded boundary.');
      droppedTimes.set(row.riderId,
        startBunchTime+row.initialDeficitSeconds);
    }
    if(leadingDissolution||dissolvedAllFronts||dissolvedSingle)
      for(const row of frame.frontGroupDissolutions){
      if(!(dissolvedAllFronts||dissolvedSingle?
        groupIds.includes(row.groupId):
        row.groupId===groupIds[0])||
        row.atDistanceM!==source.startDistanceM||
        !groupTimes.delete(row.groupId))
        throw new Error('The leading front dissolved outside its paid boundary.');
    }
    const activeGroupIds=dissolvedAllFronts||dissolvedSingle?[]:
      leadingDissolution?groupIds.slice(1):groupIds;
    if(frame.roadGroups.length!==activeGroupIds.length||
      frame.roadGroups.some((group,index)=>
        group.id!==activeGroupIds[index])||
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
  const frontLeaversAhead=frontExits.length>0&&groupIds.length>=1&&
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
  // A split from each of two fronts can leave one set safely between the
  // groups while the other is passed by the bunch. Keep those riders in
  // separate unresolved bands only when every paid marker proves the same
  // ordering and the rear pass is explicitly recorded in the first slice.
  const leadingExits=frontExits.filter(row=>
    row.fromRoadGroupId===groupIds[0]);
  const rearExits=frontExits.filter(row=>
    row.fromRoadGroupId===groupIds[1]);
  const dissolvedLeadingFront=leadingDissolution&&groupIds.length===2&&
    (dissolvedLeadingDropped?source.droppedRiderIds.length>0:
      source.droppedRiderIds.length===0)&&
    trace.frames[0].frontGroupDissolutions.length===1&&
    trace.frames[0].frontGroupDissolutions[0].groupId===groupIds[0]&&
    trace.frames.slice(1).every(frame=>
      frame.frontGroupDissolutions.length===0&&
      frame.frontExhaustionDrops.length===0)&&
    leadingExits.length===source.roadGroups[0].riderIds.length&&
    frontExits.length===leadingExits.length+rearExits.length&&
    (!dissolvedLeadingDropped||rearExits.length===0)&&
    frontExits.every(row=>row.atDistanceM===source.startDistanceM)&&
    trace.frames.every(frame=>!frame.exhaustionDrops.length)&&
    passageFrames.every((frame,index)=>{
      const group=frame.groups[0];
      if(!group||group.id!==groupIds[1]||
        group.passageSecondsFromBunchMarker>=
          frame.bunchPassageSecondsFromBunchMarker-EPSILON)
        return false;
      return source.droppedRiderIds.every(id=>{
        const row=frame.droppedPassages.find(value=>value.riderId===id);
        return row?.contactDistanceM===null&&
          row.passageSecondsFromBunchMarker>
            frame.bunchPassageSecondsFromBunchMarker+EPSILON;
      })&&leadingExits.every(exit=>{
        const row=frame.droppedPassages.find(value=>
          value.riderId===exit.riderId);
        return row?.contactDistanceM===null&&
          row.passageSecondsFromBunchMarker<
            group.passageSecondsFromBunchMarker-EPSILON;
      })&&rearExits.every(exit=>{
        const row=frame.droppedPassages.find(value=>
          value.riderId===exit.riderId);
        return index===0?
          row?.contactStatus==='bunch_passed_unassisted'&&
            row.contactDistanceM>source.startDistanceM&&
            row.contactDistanceM<frame.distanceM&&
            row.passageSecondsFromBunchMarker>
              frame.bunchPassageSecondsFromBunchMarker+EPSILON:
          row?.contactDistanceM===null&&
            row.passageSecondsFromBunchMarker>
              frame.bunchPassageSecondsFromBunchMarker+EPSILON;
      });
    });
  // A third, separate singleton front can remain near the bunch. It must
  // stay behind every former leader for the entire paid kilometre, even
  // when road-2 passes those leaders. No group membership is inferred.
  const threeFrontBasis=dissolvedThreeFront&&groupIds.length===3&&
    source.roadGroups.slice(1).every(group=>group.riderIds.length===1)&&
    trace.frames[0].frontGroupDissolutions.length===1&&
    trace.frames[0].frontGroupDissolutions[0].groupId===groupIds[0]&&
    trace.frames.slice(1).every(frame=>
      !frame.frontGroupDissolutions.length&&
      !frame.frontExhaustionDrops.length)&&
    leadingExits.length===source.roadGroups[0].riderIds.length&&
    frontExits.length===leadingExits.length&&
    frontExits.every(row=>row.atDistanceM===source.startDistanceM)&&
    trace.frames.every(frame=>!frame.exhaustionDrops.length)&&
    passageFrames.every(frame=>frame.groups.length===2&&
      frame.groups[0].id===groupIds[1]&&
      frame.groups[1].id===groupIds[2]&&
      frame.groups[0].passageSecondsFromBunchMarker<
        frame.groups[1].passageSecondsFromBunchMarker-EPSILON&&
      frame.groups[1].passageSecondsFromBunchMarker<
        frame.bunchPassageSecondsFromBunchMarker-EPSILON&&
      leadingExits.every(exit=>{
        const row=frame.droppedPassages.find(value=>
          value.riderId===exit.riderId);
        return row?.contactDistanceM===null&&
          row.passageSecondsFromBunchMarker<
            frame.groups[1].passageSecondsFromBunchMarker-EPSILON;
      })&&source.droppedRiderIds.every(id=>{
        const row=frame.droppedPassages.find(value=>value.riderId===id);
        return row?.contactDistanceM===null&&
          row.passageSecondsFromBunchMarker>
            frame.bunchPassageSecondsFromBunchMarker+EPSILON;
      }));
  const threeFrontClear=threeFrontBasis&&passageFrames.every(frame=>
    leadingExits.every(exit=>frame.droppedPassages.find(row=>
      row.riderId===exit.riderId).passageSecondsFromBunchMarker<
      frame.groups[0].passageSecondsFromBunchMarker-EPSILON));
  const survivorPasses=(dissolvedLeadingPass||dissolvedThreeFront)&&
    (dissolvedThreeFront?threeFrontBasis:groupIds.length===2)&&
    (dissolvedThreeFront||source.droppedRiderIds.length===0)&&
    source.roadGroups[1].riderIds.length===1&&
    trace.frames[0].frontGroupDissolutions.length===1&&
    trace.frames[0].frontGroupDissolutions[0].groupId===groupIds[0]&&
    trace.frames.slice(1).every(frame=>
      !frame.frontGroupDissolutions.length&&
      !frame.frontExhaustionDrops.length)&&
    leadingExits.length===source.roadGroups[0].riderIds.length&&
    frontExits.length===leadingExits.length&&
    frontExits.every(row=>row.atDistanceM===source.startDistanceM)&&
    trace.frames.every(frame=>!frame.exhaustionDrops.length)&&
    passageFrames.every(frame=>
      frame.groups.length===(dissolvedThreeFront?2:1)&&
      frame.groups[0].id===groupIds[1]&&
      frame.groups[0].passageSecondsFromBunchMarker<
        frame.bunchPassageSecondsFromBunchMarker-EPSILON&&
      leadingExits.every(exit=>{
        const row=frame.droppedPassages.find(value=>
          value.riderId===exit.riderId);
        return row?.contactDistanceM===null&&
          row.passageSecondsFromBunchMarker<
            frame.bunchPassageSecondsFromBunchMarker-EPSILON;
      }))?leadingExits.map((exit,index)=>{
      let beforeDistance=source.startDistanceM;
      let beforeGroup=-source.roadGroups[1].gapSeconds;
      let beforeSolo=-source.roadGroups[0].gapSeconds;
      let pass=null;
      for(const frame of passageFrames){
        const afterGroup=frame.groups[0].passageSecondsFromBunchMarker;
        const afterSolo=frame.droppedPassages.find(row=>
          row.riderId===exit.riderId).passageSecondsFromBunchMarker;
        const beforeGap=beforeSolo-beforeGroup;
        const afterGap=afterSolo-afterGroup;
        if(beforeGap<-EPSILON&&afterGap>EPSILON){
          if(pass!==null)return null;
          const fraction=-beforeGap/(afterGap-beforeGap);
          pass={riderId:exit.riderId,groupId:groupIds[1],
            atDistanceM:beforeDistance+
              fraction*(frame.distanceM-beforeDistance),
            outsideLane:LANES+index,
            status:'survivor_passed_unassisted'};
        }else if(Math.abs(afterGap)<=EPSILON||
          beforeGap>EPSILON&&afterGap<-EPSILON)return null;
        beforeDistance=frame.distanceM;
        beforeGroup=afterGroup;
        beforeSolo=afterSolo;
      }
      return pass;
    }):null;
  const paidSurvivorPasses=survivorPasses?.length===leadingExits.length&&
    survivorPasses.every(Boolean)?survivorPasses:null;
  if(dissolvedLeadingPass&&!paidSurvivorPasses)
    throw new Error('The dissolved riders lack paid survivor passes.');
  if(leadingDissolution&&!dissolvedLeadingFront&&!paidSurvivorPasses&&
    !threeFrontClear)
    throw new Error('The dissolved leading front lacks separated paid lanes.');
  const allFrontsDissolved=dissolvedAllFronts&&groupIds.length===2&&
    source.droppedRiderIds.length===0&&
    trace.frames[0].frontGroupDissolutions.length===2&&
    groupIds.every(id=>trace.frames[0].frontGroupDissolutions.some(row=>
      row.groupId===id))&&
    trace.frames.slice(1).every(frame=>
      frame.frontGroupDissolutions.length===0&&
      frame.frontExhaustionDrops.length===0)&&
    leadingExits.length===source.roadGroups[0].riderIds.length&&
    rearExits.length===source.roadGroups[1].riderIds.length&&
    frontExits.length===leadingExits.length+rearExits.length&&
    frontExits.every(row=>row.atDistanceM===source.startDistanceM)&&
    trace.frames.every(frame=>!frame.exhaustionDrops.length&&
      frame.roadGroups.length===0)&&
    passageFrames.every((frame,index)=>
      frame.groups.length===0&&
      leadingExits.every(exit=>{
        const row=frame.droppedPassages.find(value=>
          value.riderId===exit.riderId);
        return row?.contactDistanceM===null&&
          row.passageSecondsFromBunchMarker<
            frame.bunchPassageSecondsFromBunchMarker-EPSILON;
      })&&rearExits.every(exit=>{
        const row=frame.droppedPassages.find(value=>
          value.riderId===exit.riderId);
        return index===0?
          row?.contactStatus==='bunch_passed_unassisted'&&
            row.contactDistanceM>source.startDistanceM&&
            row.contactDistanceM<frame.distanceM&&
            row.passageSecondsFromBunchMarker>
              frame.bunchPassageSecondsFromBunchMarker+EPSILON:
          row?.contactDistanceM===null&&
            row.passageSecondsFromBunchMarker>
              frame.bunchPassageSecondsFromBunchMarker+EPSILON;
      }));
  if(dissolvedAllFronts&&!allFrontsDissolved)
    throw new Error('Both dissolved fronts lack separated paid lanes.');
  const singleFrontDissolved=dissolvedSingle&&groupIds.length===1&&
    source.droppedRiderIds.length===0&&
    trace.frames[0].frontGroupDissolutions.length===1&&
    trace.frames[0].frontGroupDissolutions[0].groupId===groupIds[0]&&
    trace.frames.slice(1).every(frame=>
      frame.frontGroupDissolutions.length===0&&
      frame.frontExhaustionDrops.length===0)&&
    leadingExits.length===source.roadGroups[0].riderIds.length&&
    frontExits.length===leadingExits.length&&
    leadingExits.every(row=>row.atDistanceM===source.startDistanceM)&&
    trace.frames.every(frame=>!frame.exhaustionDrops.length&&
      frame.roadGroups.length===0)&&
    passageFrames.every(frame=>frame.groups.length===0&&
      leadingExits.every(exit=>{
        const row=frame.droppedPassages.find(value=>
          value.riderId===exit.riderId);
        return row?.contactDistanceM===null&&
          row.passageSecondsFromBunchMarker<
            frame.bunchPassageSecondsFromBunchMarker-EPSILON;
      }));
  if(dissolvedSingle&&!singleFrontDissolved)
    throw new Error('The dissolved single front lacks separated paid lanes.');
  const mixedFrontLeavers=dynamicFront&&!dynamicActive&&!dynamicSingle&&
    !dissolvedLeading&&
    groupIds.length===2&&source.droppedRiderIds.length===0&&
    leadingExits.length>0&&rearExits.length>0&&
    frontExits.length===leadingExits.length+rearExits.length&&
    frontExits.every(row=>row.atDistanceM===source.startDistanceM)&&
    trace.frames.every(frame=>!frame.exhaustionDrops.length)&&
    passageFrames.every((frame,index)=>{
      const [first,second]=frame.groups;
      if(!first||!second||
        first.passageSecondsFromBunchMarker>=
          second.passageSecondsFromBunchMarker-EPSILON||
        second.passageSecondsFromBunchMarker>=
          frame.bunchPassageSecondsFromBunchMarker-EPSILON)
        return false;
      return leadingExits.every(exit=>{
        const row=frame.droppedPassages.find(value=>
          value.riderId===exit.riderId);
        return row?.contactDistanceM===null&&
          first.passageSecondsFromBunchMarker<
            row.passageSecondsFromBunchMarker-EPSILON&&
          row.passageSecondsFromBunchMarker<
            second.passageSecondsFromBunchMarker-EPSILON;
      })&&rearExits.every(exit=>{
        const row=frame.droppedPassages.find(value=>
          value.riderId===exit.riderId);
        return index===0?
          row?.contactStatus==='bunch_passed_unassisted'&&
            row.contactDistanceM>source.startDistanceM&&
            row.contactDistanceM<frame.distanceM&&
            row.passageSecondsFromBunchMarker>
              frame.bunchPassageSecondsFromBunchMarker+EPSILON:
          row?.contactDistanceM===null&&
            row.passageSecondsFromBunchMarker>
              frame.bunchPassageSecondsFromBunchMarker+EPSILON;
      });
    });
  // Both fronts can shed a rider without either isolated rider meeting a
  // surviving group or the bunch. Keep each source group with its leavers
  // in an unresolved range; require the same measured road order at every
  // paid marker before allowing an individual continuation.
  const paidMixedFrontClear=mixedFrontClear&&dynamicFront&&
    !dynamicActive&&!dynamicSingle&&groupIds.length===2&&
    source.droppedRiderIds.length===0&&leadingExits.length>0&&
    rearExits.length>0&&
    frontExits.length===leadingExits.length+rearExits.length&&
    frontExits.every(row=>row.atDistanceM===source.startDistanceM)&&
    trace.frames.every(frame=>!frame.exhaustionDrops.length&&
      !(frame.frontGroupDissolutions??[]).length)&&
    passageFrames.every(frame=>{
      const [first,second]=frame.groups;
      if(!first||!second||
        first.passageSecondsFromBunchMarker>=
          second.passageSecondsFromBunchMarker-EPSILON||
        second.passageSecondsFromBunchMarker>=
          frame.bunchPassageSecondsFromBunchMarker-EPSILON)
        return false;
      return leadingExits.every(exit=>{
        const row=frame.droppedPassages.find(value=>
          value.riderId===exit.riderId);
        return row?.contactDistanceM===null&&
          first.passageSecondsFromBunchMarker<
            row.passageSecondsFromBunchMarker-EPSILON&&
          row.passageSecondsFromBunchMarker<
            second.passageSecondsFromBunchMarker-EPSILON;
      })&&rearExits.every(exit=>{
        const row=frame.droppedPassages.find(value=>
          value.riderId===exit.riderId);
        return row?.contactDistanceM===null&&
          second.passageSecondsFromBunchMarker<
            row.passageSecondsFromBunchMarker-EPSILON&&
          row.passageSecondsFromBunchMarker<
            frame.bunchPassageSecondsFromBunchMarker-EPSILON;
      });
    });
  if(mixedFrontClear&&!paidMixedFrontClear)
    throw new Error('The mixed front leavers lack separate paid lanes.');
  const paidMixedThreeFrontClear=mixedThreeFrontClear&&dynamicFront&&
    !dynamicActive&&!dynamicSingle&&groupIds.length===3&&
    source.droppedRiderIds.length===0&&leadingExits.length>0&&
    rearExits.length>0&&
    frontExits.length===leadingExits.length+rearExits.length&&
    frontExits.every(row=>row.atDistanceM===source.startDistanceM)&&
    trace.frames.every(frame=>!frame.exhaustionDrops.length&&
      !(frame.frontGroupDissolutions??[]).length)&&
    passageFrames.every(frame=>{
      const [first,second,third]=frame.groups;
      if(!first||!second||!third||frame.groups.length!==3||
        first.id!==groupIds[0]||second.id!==groupIds[1]||
        third.id!==groupIds[2]||
        first.passageSecondsFromBunchMarker>=
          second.passageSecondsFromBunchMarker-EPSILON||
        second.passageSecondsFromBunchMarker>=
          third.passageSecondsFromBunchMarker-EPSILON||
        third.passageSecondsFromBunchMarker>=
          frame.bunchPassageSecondsFromBunchMarker-EPSILON)
        return false;
      return leadingExits.every(exit=>{
        const row=frame.droppedPassages.find(value=>
          value.riderId===exit.riderId);
        return row?.contactDistanceM===null&&
          first.passageSecondsFromBunchMarker<
            row.passageSecondsFromBunchMarker-EPSILON&&
          row.passageSecondsFromBunchMarker<
            second.passageSecondsFromBunchMarker-EPSILON;
      })&&rearExits.every(exit=>{
        const row=frame.droppedPassages.find(value=>
          value.riderId===exit.riderId);
        return row?.contactDistanceM===null&&
          second.passageSecondsFromBunchMarker<
            row.passageSecondsFromBunchMarker-EPSILON&&
          row.passageSecondsFromBunchMarker<
            third.passageSecondsFromBunchMarker-EPSILON;
      });
    });
  if(mixedThreeFrontClear&&!paidMixedThreeFrontClear)
    throw new Error('The third mixed front lacks separate paid lanes.');
  // Previously dropped riders can remain on a separate rear road while
  // leavers from the first two of three fronts stay between their former
  // groups. Require every paid marker to prove all five gaps and no pass.
  const paidMixedThreeFrontDropped=mixedThreeFrontDropped&&dynamicFront&&
    !dynamicActive&&!dynamicSingle&&groupIds.length===3&&
    source.droppedRiderIds.length>0&&leadingExits.length>0&&
    rearExits.length>0&&
    frontExits.length===leadingExits.length+rearExits.length&&
    frontExits.every(row=>row.atDistanceM===source.startDistanceM)&&
    trace.frames.every(frame=>!frame.exhaustionDrops.length&&
      !(frame.frontGroupDissolutions??[]).length)&&
    passageFrames.every(frame=>{
      const [first,second,third]=frame.groups;
      if(!first||!second||!third||frame.groups.length!==3||
        first.id!==groupIds[0]||second.id!==groupIds[1]||
        third.id!==groupIds[2]||
        first.passageSecondsFromBunchMarker>=
          second.passageSecondsFromBunchMarker-EPSILON||
        second.passageSecondsFromBunchMarker>=
          third.passageSecondsFromBunchMarker-EPSILON||
        third.passageSecondsFromBunchMarker>=
          frame.bunchPassageSecondsFromBunchMarker-EPSILON)
        return false;
      return leadingExits.every(exit=>{
        const row=frame.droppedPassages.find(value=>
          value.riderId===exit.riderId);
        return row?.contactDistanceM===null&&
          first.passageSecondsFromBunchMarker<
            row.passageSecondsFromBunchMarker-EPSILON&&
          row.passageSecondsFromBunchMarker<
            second.passageSecondsFromBunchMarker-EPSILON;
      })&&rearExits.every(exit=>{
        const row=frame.droppedPassages.find(value=>
          value.riderId===exit.riderId);
        return row?.contactDistanceM===null&&
          second.passageSecondsFromBunchMarker<
            row.passageSecondsFromBunchMarker-EPSILON&&
          row.passageSecondsFromBunchMarker<
            third.passageSecondsFromBunchMarker-EPSILON;
      })&&source.droppedRiderIds.every(id=>{
        const row=frame.droppedPassages.find(value=>value.riderId===id);
        return row?.contactDistanceM===null&&
          row.passageSecondsFromBunchMarker>
            frame.bunchPassageSecondsFromBunchMarker+EPSILON;
      });
    });
  if(mixedThreeFrontDropped&&!paidMixedThreeFrontDropped)
    throw new Error('The mixed fronts and older drops lack separate paid lanes.');
  // The rear leaver starts between its former group and the bunch. The
  // kilometre motor must record its one unassisted bunch pass after the
  // paid 500 m handoff; all other passages retain their measured order.
  const rearContactFrames=passageFrames.flatMap((frame,index)=>
    frame.droppedPassages.filter(row=>
      rearExits.some(exit=>exit.riderId===row.riderId)&&
      row.contactDistanceM!==null).map(row=>({index,row})));
  const paidMixedFrontLatePass=mixedFrontLatePass&&dynamicFront&&
    !dynamicActive&&!dynamicSingle&&groupIds.length===2&&
    source.droppedRiderIds.length===0&&leadingExits.length===1&&
    rearExits.length===1&&frontExits.length===2&&
    frontExits.every(row=>row.atDistanceM===source.startDistanceM)&&
    trace.frames.every(frame=>!frame.exhaustionDrops.length&&
      !(frame.frontGroupDissolutions??[]).length)&&
    rearContactFrames.length===1&&
    rearContactFrames[0].row.riderId===rearExits[0].riderId&&
    rearContactFrames[0].row.contactStatus==='bunch_passed_unassisted'&&
    rearContactFrames[0].row.contactDistanceM>lineDistanceM-500&&
    rearContactFrames[0].row.contactDistanceM<lineDistanceM&&
    passageFrames.every((frame,index)=>{
      const [first,second]=frame.groups;
      const leading=frame.droppedPassages.find(row=>
        row.riderId===leadingExits[0].riderId);
      const rear=frame.droppedPassages.find(row=>
        row.riderId===rearExits[0].riderId);
      if(!first||!second||!leading||!rear||
        first.passageSecondsFromBunchMarker>=
          second.passageSecondsFromBunchMarker-EPSILON||
        second.passageSecondsFromBunchMarker>=
          frame.bunchPassageSecondsFromBunchMarker-EPSILON||
        leading.contactDistanceM!==null||
        leading.passageSecondsFromBunchMarker<=
          first.passageSecondsFromBunchMarker+EPSILON||
        leading.passageSecondsFromBunchMarker>=
          second.passageSecondsFromBunchMarker-EPSILON)
        return false;
      if(index<rearContactFrames[0].index)
        return rear.contactDistanceM===null&&
          rear.passageSecondsFromBunchMarker>
            second.passageSecondsFromBunchMarker+EPSILON&&
          rear.passageSecondsFromBunchMarker<
            frame.bunchPassageSecondsFromBunchMarker-EPSILON;
      if(index===rearContactFrames[0].index&&
        (rear.contactDistanceM<=trace.frames[index].startDistanceM||
        rear.contactDistanceM>=frame.distanceM))return false;
      return rear.passageSecondsFromBunchMarker>
        frame.bunchPassageSecondsFromBunchMarker+EPSILON;
    });
  if(mixedFrontLatePass&&!paidMixedFrontLatePass)
    throw new Error('The late mixed-front bunch pass lacks paid lanes.');
  // Two rear leavers may share a passage clock and meet the bunch at the
  // same paid point. Keep both on their own isolated paths; the equal clock
  // gives neither rider a wheel order or an official placing.
  const paidMixedFrontParallelPass=mixedFrontParallelPass&&dynamicFront&&
    !dynamicActive&&!dynamicSingle&&groupIds.length===2&&
    source.droppedRiderIds.length===0&&leadingExits.length===1&&
    rearExits.length===2&&frontExits.length===3&&
    frontExits.every(row=>row.atDistanceM===source.startDistanceM)&&
    trace.frames.every(frame=>!frame.exhaustionDrops.length&&
      !(frame.frontGroupDissolutions??[]).length)&&
    rearContactFrames.length===2&&
    rearExits.every(exit=>rearContactFrames.some(({row})=>
      row.riderId===exit.riderId))&&
    rearContactFrames.every(({index,row})=>
      index===rearContactFrames[0].index&&
      row.contactStatus==='bunch_passed_unassisted'&&
      Math.abs(row.contactDistanceM-
        rearContactFrames[0].row.contactDistanceM)<=EPSILON&&
      row.contactDistanceM>lineDistanceM-500&&
      row.contactDistanceM<lineDistanceM)&&
    passageFrames.every((frame,index)=>{
      const [first,second]=frame.groups;
      const leading=frame.droppedPassages.find(row=>
        row.riderId===leadingExits[0].riderId);
      const rear=rearExits.map(exit=>frame.droppedPassages.find(row=>
        row.riderId===exit.riderId));
      if(!first||!second||frame.groups.length!==2||!leading||
        rear.some(row=>!row)||
        first.passageSecondsFromBunchMarker>=
          second.passageSecondsFromBunchMarker-EPSILON||
        second.passageSecondsFromBunchMarker>=
          frame.bunchPassageSecondsFromBunchMarker-EPSILON||
        leading.contactDistanceM!==null||
        leading.passageSecondsFromBunchMarker<=
          first.passageSecondsFromBunchMarker+EPSILON||
        leading.passageSecondsFromBunchMarker>=
          second.passageSecondsFromBunchMarker-EPSILON||
        Math.abs(rear[0].passageSecondsFromBunchMarker-
          rear[1].passageSecondsFromBunchMarker)>EPSILON)
        return false;
      if(index<rearContactFrames[0].index)
        return rear.every(row=>row.contactDistanceM===null&&
          row.passageSecondsFromBunchMarker>
            second.passageSecondsFromBunchMarker+EPSILON&&
          row.passageSecondsFromBunchMarker<
            frame.bunchPassageSecondsFromBunchMarker-EPSILON);
      if(index===rearContactFrames[0].index&&rear.some(row=>
        row.contactDistanceM<=trace.frames[index].startDistanceM||
        row.contactDistanceM>=frame.distanceM))return false;
      return rear.every(row=>row.passageSecondsFromBunchMarker>
        frame.bunchPassageSecondsFromBunchMarker+EPSILON);
    });
  if(mixedFrontParallelPass&&!paidMixedFrontParallelPass)
    throw new Error('The parallel mixed-front bunch pass lacks paid lanes.');
  const bands=threeFrontClear?assignFinishBandPlaces([
    {id:'leading_isolated_front',kind:'unresolved_front_leavers',
      riderIds:leadingExits.map(row=>row.riderId)},
    ...line.roadGroups.map(group=>({id:group.id,kind:'road_group',
      riderIds:[...group.riderIds],
      passageSecondsFromBunchMarker:groupTimes.get(group.id)})),
    {id:'peloton',kind:'peloton',riderIds:[...line.pelotonRiderIds],
      passageSecondsFromBunchMarker:bunchTime},
    ...(source.droppedRiderIds.length?[{
      id:'dropped',kind:'unresolved_dropped',
      riderIds:[...source.droppedRiderIds],
      firstPassageSecondsFromBunchMarker:Math.min(...source.droppedRiderIds
        .map(id=>droppedTimes.get(id))),
      lastPassageSecondsFromBunchMarker:Math.max(...source.droppedRiderIds
        .map(id=>droppedTimes.get(id)))}]:[])]):
    singleFrontDissolved?assignFinishBandPlaces([
    {id:'leading_isolated_front',kind:'unresolved_front_leavers',
      riderIds:leadingExits.map(row=>row.riderId)},
    {id:'peloton',kind:'peloton',
      riderIds:[...line.pelotonRiderIds],
      passageSecondsFromBunchMarker:bunchTime}]):
    allFrontsDissolved?assignFinishBandPlaces([
    {id:'leading_isolated_front',kind:'unresolved_front_leavers',
      riderIds:leadingExits.map(row=>row.riderId)},
    {id:'peloton',kind:'peloton',
      riderIds:[...line.pelotonRiderIds],
      passageSecondsFromBunchMarker:bunchTime},
    {id:'dropped',kind:'unresolved_dropped',
      riderIds:rearExits.map(row=>row.riderId),
      firstPassageSecondsFromBunchMarker:Math.min(...rearExits.map(row=>
        droppedTimes.get(row.riderId))),
      lastPassageSecondsFromBunchMarker:Math.max(...rearExits.map(row=>
        droppedTimes.get(row.riderId)))}]):
    paidSurvivorPasses?assignFinishBandPlaces([
    {id:groupIds[1],kind:'road_group',
      riderIds:[...line.roadGroups[0].riderIds],
      passageSecondsFromBunchMarker:groupTimes.get(groupIds[1])},
    {id:'passed_isolated_front',kind:'unresolved_front_leavers',
      riderIds:leadingExits.map(row=>row.riderId)},
    ...(dissolvedThreeFront?[{id:groupIds[2],kind:'road_group',
      riderIds:[...line.roadGroups[1].riderIds],
      passageSecondsFromBunchMarker:groupTimes.get(groupIds[2])}]:[]),
    {id:'peloton',kind:'peloton',
      riderIds:[...line.pelotonRiderIds],
      passageSecondsFromBunchMarker:bunchTime},
    ...(dissolvedThreeFront&&source.droppedRiderIds.length?[{
      id:'dropped',kind:'unresolved_dropped',
      riderIds:[...source.droppedRiderIds],
      firstPassageSecondsFromBunchMarker:Math.min(...source.droppedRiderIds
        .map(id=>droppedTimes.get(id))),
      lastPassageSecondsFromBunchMarker:Math.max(...source.droppedRiderIds
        .map(id=>droppedTimes.get(id)))}]:[])]):
    dissolvedLeadingFront?assignFinishBandPlaces([
    {id:'leading_isolated_front',kind:'unresolved_front_leavers',
      riderIds:leadingExits.map(row=>row.riderId)},
    {id:groupIds[1],kind:'road_group',
      riderIds:[...line.roadGroups[0].riderIds],
      passageSecondsFromBunchMarker:groupTimes.get(groupIds[1])},
    {id:'peloton',kind:'peloton',
      riderIds:[...line.pelotonRiderIds],
      passageSecondsFromBunchMarker:bunchTime},
    ...(rearExits.length||source.droppedRiderIds.length?[{
      id:'dropped',kind:'unresolved_dropped',
      riderIds:[...rearExits.map(row=>row.riderId),
        ...source.droppedRiderIds],
      firstPassageSecondsFromBunchMarker:Math.min(...[
        ...rearExits.map(row=>row.riderId),...source.droppedRiderIds]
        .map(id=>droppedTimes.get(id))),
      lastPassageSecondsFromBunchMarker:Math.max(...[
        ...rearExits.map(row=>row.riderId),...source.droppedRiderIds]
        .map(id=>droppedTimes.get(id)))}]:[])]):dynamicSingle?assignFinishBandPlaces([{
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
          .map(id=>droppedTimes.get(id)))}]:[])]):
    paidMixedFrontClear||paidMixedThreeFrontClear||
      paidMixedThreeFrontDropped?
    assignFinishBandPlaces([
      {id:'front_with_leavers',kind:'unresolved_front_with_leavers',
        riderIds:[...line.roadGroups[0].riderIds,
          ...leadingExits.map(row=>row.riderId)]},
      {id:'rear_front_with_leavers',kind:'unresolved_front_with_leavers',
        riderIds:[...line.roadGroups[1].riderIds,
          ...rearExits.map(row=>row.riderId)]},
      ...(paidMixedThreeFrontClear||paidMixedThreeFrontDropped?[{
        id:line.roadGroups[2].id,
        kind:'road_group',riderIds:[...line.roadGroups[2].riderIds],
        passageSecondsFromBunchMarker:groupTimes.get(groupIds[2])}]:[]),
      {id:'peloton',kind:'peloton',
        riderIds:[...line.pelotonRiderIds],
        passageSecondsFromBunchMarker:bunchTime},
      ...(paidMixedThreeFrontDropped?[{
        id:'dropped',kind:'unresolved_dropped',
        riderIds:[...source.droppedRiderIds],
        firstPassageSecondsFromBunchMarker:Math.min(
          ...source.droppedRiderIds.map(id=>droppedTimes.get(id))),
        lastPassageSecondsFromBunchMarker:Math.max(
          ...source.droppedRiderIds.map(id=>droppedTimes.get(id)))}]:[])]) :
    paidMixedFrontLatePass||paidMixedFrontParallelPass?
    assignFinishBandPlaces([
      {id:'front_with_leavers',kind:'unresolved_front_with_leavers',
        riderIds:[...line.roadGroups[0].riderIds,
          leadingExits[0].riderId]},
      {id:line.roadGroups[1].id,kind:'road_group',
        riderIds:[...line.roadGroups[1].riderIds],
        passageSecondsFromBunchMarker:groupTimes.get(groupIds[1])},
      {id:'peloton',kind:'peloton',
        riderIds:[...line.pelotonRiderIds],
        passageSecondsFromBunchMarker:bunchTime},
      {id:'rear_isolated',kind:'unresolved_dropped',
        riderIds:rearExits.map(row=>row.riderId),
        firstPassageSecondsFromBunchMarker:Math.min(...rearExits.map(row=>
          droppedTimes.get(row.riderId))),
        lastPassageSecondsFromBunchMarker:Math.max(...rearExits.map(row=>
          droppedTimes.get(row.riderId)))}]):mixedFrontLeavers?
    assignFinishBandPlaces([
      {id:'front_with_leavers',kind:'unresolved_front_with_leavers',
        riderIds:[...line.roadGroups[0].riderIds,
          ...leadingExits.map(row=>row.riderId)]},
      {id:line.roadGroups[1].id,kind:'road_group',
        riderIds:[...line.roadGroups[1].riderIds],
        passageSecondsFromBunchMarker:groupTimes.get(groupIds[1])},
      {id:'peloton',kind:'peloton',
        riderIds:[...line.pelotonRiderIds],
        passageSecondsFromBunchMarker:bunchTime},
      {id:'dropped',kind:'unresolved_dropped',
        riderIds:rearExits.map(row=>row.riderId),
        firstPassageSecondsFromBunchMarker:Math.min(...rearExits.map(row=>
          droppedTimes.get(row.riderId))),
        lastPassageSecondsFromBunchMarker:Math.max(...rearExits.map(row=>
          droppedTimes.get(row.riderId)))}]):assignFinishBandPlaces([
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
  if(!dynamicSingle&&!frontLeaversAhead&&!mixedFrontLeavers&&
    !paidMixedFrontClear&&!paidMixedThreeFrontClear&&
    !paidMixedThreeFrontDropped&&
    !paidMixedFrontLatePass&&!paidMixedFrontParallelPass&&
    !dissolvedLeadingFront&&!paidSurvivorPasses&&!threeFrontClear&&
    !allFrontsDissolved&&
    !singleFrontDissolved&&
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
  return {version:paidMixedThreeFrontDropped?
    FINALE_COAST_MIXED_THREE_FRONT_DROPPED_CLOCK_VERSION:
    paidMixedFrontParallelPass?
    FINALE_COAST_MIXED_FRONT_PARALLEL_PASS_CLOCK_VERSION:
    paidMixedThreeFrontClear?
    FINALE_COAST_MIXED_THREE_FRONT_CLEAR_CLOCK_VERSION:
    paidMixedFrontLatePass?
    FINALE_COAST_MIXED_FRONT_LATE_PASS_CLOCK_VERSION:
    paidMixedFrontClear?
    FINALE_COAST_MIXED_FRONT_CLEAR_CLOCK_VERSION:
    dissolvedThreeFront?
    FINALE_COAST_DISSOLVED_THREE_FRONT_CLOCK_VERSION:
    paidSurvivorPasses?
    FINALE_COAST_DISSOLVED_SURVIVOR_PASS_CLOCK_VERSION:
    singleFrontDissolved?
    FINALE_COAST_DISSOLVED_SINGLE_LAST_KM_CLOCK_VERSION:
    allFrontsDissolved?
    FINALE_COAST_DISSOLVED_ALL_FRONTS_LAST_KM_CLOCK_VERSION:
    dissolvedLeadingDropped?
    FINALE_COAST_DISSOLVED_FRONT_DROPPED_LAST_KM_CLOCK_VERSION:
    dissolvedLeadingFront?
    FINALE_COAST_DISSOLVED_LEADING_LAST_KM_CLOCK_VERSION:
    dynamicSingle?
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
    ...(paidSurvivorPasses?{survivorPasses:paidSurvivorPasses}:{}),
    line:{outcome:paidMixedThreeFrontDropped?
      'mixed_three_front_leavers_with_older_drops_clear':
      paidMixedFrontParallelPass?
      'mixed_front_parallel_rear_bunch_pass':
      paidMixedThreeFrontClear?
      'mixed_three_front_leavers_clear':
      paidMixedFrontLatePass?
      'mixed_front_rear_leaver_passed_late':
      paidMixedFrontClear?
      'mixed_front_leavers_clear_of_bunch':
      dissolvedThreeFront&&paidSurvivorPasses?
      'dissolved_three_front_survivor_passed_outside':
      threeFrontClear?'dissolved_three_front_clear':
      paidSurvivorPasses?
      'dissolved_front_survivor_passed_outside':
      singleFrontDissolved?
      'single_front_dissolved_leading_isolated':
      allFrontsDissolved?
      'all_fronts_dissolved_leading_and_rear_isolated':
      dissolvedLeadingDropped?
      'dissolved_leading_front_with_prior_dropped':
      dissolvedLeadingFront?
      rearExits.length?
        'dissolved_leading_front_with_rear_bunch_pass':
        'dissolved_leading_front_clear':
      dynamicSingle?'single_front_with_coasted_drops':
      dynamicActive?'front_with_coasted_bunch_drops':
      frontLeaversAhead?'front_leavers_ahead_of_bunch_contact_unresolved':
      mixedFrontLeavers?'mixed_front_leavers_ahead_and_behind_bunch':
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

export function recordFinaleCoastDissolvedLeadingLastKmClock(tour){
  return recordDepletedLastKmClock(tour,{
    coastDropped:true,dissolvedLeading:true});
}

export function recordFinaleCoastDissolvedSurvivorPassClock(tour){
  return recordDepletedLastKmClock(tour,{
    coastDropped:true,dissolvedLeadingPass:true});
}

export function recordFinaleCoastDissolvedThreeFrontClock(tour){
  return recordDepletedLastKmClock(tour,{
    coastDropped:true,dissolvedThreeFront:true});
}

export function validateFinaleCoastDissolvedThreeFrontClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastDissolvedThreeFrontClock(tour)))
    throw new Error('The dissolved three-front clock does not replay.');
  return true;
}

export function recordFinaleCoastMixedFrontClearClock(tour){
  return recordDepletedLastKmClock(tour,{
    coastDropped:true,dynamicFront:true,mixedFrontClear:true});
}

export function validateFinaleCoastMixedFrontClearClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastMixedFrontClearClock(tour)))
    throw new Error('The mixed front clear clock does not replay.');
  return true;
}

export function recordFinaleCoastMixedFrontLatePassClock(tour){
  return recordDepletedLastKmClock(tour,{
    coastDropped:true,dynamicFront:true,mixedFrontLatePass:true});
}

export function validateFinaleCoastMixedFrontLatePassClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastMixedFrontLatePassClock(tour)))
    throw new Error('The mixed front late-pass clock does not replay.');
  return true;
}

export function recordFinaleCoastMixedThreeFrontClearClock(tour){
  return recordDepletedLastKmClock(tour,{
    coastDropped:true,dynamicFront:true,mixedThreeFrontClear:true});
}

export function validateFinaleCoastMixedThreeFrontClearClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastMixedThreeFrontClearClock(tour)))
    throw new Error('The mixed three-front clock does not replay.');
  return true;
}

export function recordFinaleCoastMixedThreeFrontDroppedClock(tour){
  return recordDepletedLastKmClock(tour,{
    coastDropped:true,dynamicFront:true,mixedThreeFrontDropped:true});
}

export function validateFinaleCoastMixedThreeFrontDroppedClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastMixedThreeFrontDroppedClock(tour)))
    throw new Error('The mixed three-front older-drop clock does not replay.');
  return true;
}

export function recordFinaleCoastMixedFrontParallelPassClock(tour){
  return recordDepletedLastKmClock(tour,{
    coastDropped:true,dynamicFront:true,mixedFrontParallelPass:true});
}

export function validateFinaleCoastMixedFrontParallelPassClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastMixedFrontParallelPassClock(tour)))
    throw new Error('The mixed front parallel-pass clock does not replay.');
  return true;
}

export function validateFinaleCoastDissolvedSurvivorPassClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastDissolvedSurvivorPassClock(tour)))
    throw new Error('The dissolved survivor-pass clock does not replay.');
  return true;
}

export function recordFinaleCoastDissolvedLeadingDroppedLastKmClock(tour){
  return recordDepletedLastKmClock(tour,{
    coastDropped:true,dissolvedLeadingDropped:true});
}

export function validateFinaleCoastDissolvedLeadingDroppedLastKmClock(tour,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastDissolvedLeadingDroppedLastKmClock(tour)))
    throw new Error('The dissolved leading-front dropped clock does not replay.');
  return true;
}

export function recordFinaleCoastDissolvedAllFrontsLastKmClock(tour){
  return recordDepletedLastKmClock(tour,{
    coastDropped:true,dissolvedAllFronts:true});
}

export function validateFinaleCoastDissolvedAllFrontsLastKmClock(tour,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastDissolvedAllFrontsLastKmClock(tour)))
    throw new Error('The dissolved all-fronts clock does not replay.');
  return true;
}

export function recordFinaleCoastDissolvedSingleLastKmClock(tour){
  return recordDepletedLastKmClock(tour,{
    coastDropped:true,dissolvedSingle:true});
}

export function validateFinaleCoastDissolvedSingleLastKmClock(tour,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastDissolvedSingleLastKmClock(tour)))
    throw new Error('The dissolved single-front clock does not replay.');
  return true;
}

export function validateFinaleCoastDissolvedLeadingLastKmClock(tour,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastDissolvedLeadingLastKmClock(tour)))
    throw new Error('The dissolved leading-front clock does not replay.');
  return true;
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
