import {isDeepStrictEqual} from 'node:util';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {resolveFinaleMultibandPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  FINALE_COAST_DISSOLVED_FRONT_LAST_KM_VERSION} from
  './finale-multi-run.mjs';
import {recordDissolvedFrontFirstWheel} from
  './finale-dissolved-front-wheel-audit.mjs';

export const FINALE_DISSOLVED_FRONT_SHOULDER_ROAD_VERSION=
  'v2-finale-dissolved-front-shoulder-road-1';
const EPSILON=1e-7;

// A fully exhausted source front peels into distinct outside lanes at the
// recorded boundary. The active group and bunch can pass without offering
// a wheel, draft or speed change. This only accepts a road whose leavers
// have all been passed by the first paid marker; individual sprint remains
// a separate continuation.
export function recordFinaleDissolvedFrontShoulderRoad(tour){
  const snapshot=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  const positioned=resolveFinaleMultibandPositionedSource(tour,
    {includeDropped:true});
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_DISSOLVED_FRONT_LAST_KM_VERSION});
  const unshiftedWheelAudit=recordDissolvedFrontFirstWheel(tour,trace);
  const sourceFrame=tour.frames[snapshot.sourceKm-1];
  const sourceById=new Map(sourceFrame.riderGroups.map(row=>[row.id,row]));
  const front=positioned.roadBands[0];
  const first=trace.frames[0];
  const exits=first.frontExhaustionDrops;
  const dissolution=first.frontGroupDissolutions?.[0];
  if(!dissolution||dissolution.groupId!==front.id||
    exits.length!==front.slots.length||
    exits.some(row=>!front.slots.some(slot=>
      slot.riderId===row.riderId))||
    trace.frames.slice(1).some(frame=>
      frame.frontExhaustionDrops.length||
      frame.frontGroupDissolutions.length)||
    trace.frames.some(frame=>frame.exhaustionDrops.length)||
    !unshiftedWheelAudit.firstPotentialWheelContact)
    throw new Error('The shoulder road needs one exhausted source-front exit.');
  const leaverIds=new Set(exits.map(row=>row.riderId));
  if(trace.contactAudit.encounters.some(row=>
    !leaverIds.has(row.riderId)))
    throw new Error('The shoulder road has an unrelated active-isolated contact.');
  const laneAssignments=front.slots.map((slot,index)=>({
    riderId:slot.riderId,sourceLane:slot.lane,
    outsideLane:positioned.laneCount+index,
    atDistanceM:snapshot.startDistanceM,
    rule:'exhausted_leaver_outside_no_draft'}));
  const groupTimes=new Map(snapshot.roadGroups.map(row=>[
    row.id,-row.gapSeconds]));
  const droppedTimes=new Map(snapshot.droppedRiderIds.map(id=>{
    const row=sourceById.get(id);
    if(row?.group!=='dropped'||
      !Number.isFinite(row.deficitSeconds)||
      row.deficitSeconds<=0)
      throw new Error('A source-isolated rider lacks a passage time.');
    return [id,row.deficitSeconds];
  }));
  let bunchTime=0;
  const passages=[];
  for(const frame of trace.frames){
    const startBunchTime=bunchTime;
    const beforeSolo=new Map(droppedTimes);
    bunchTime+=frame.bunchElapsedSeconds;
    for(const exit of frame.frontExhaustionDrops){
      const groupTime=groupTimes.get(exit.fromRoadGroupId);
      if(!Number.isFinite(groupTime)||droppedTimes.has(exit.riderId))
        throw new Error('A front leaver lacks a unique source passage.');
      droppedTimes.set(exit.riderId,groupTime);
      beforeSolo.set(exit.riderId,groupTime);
    }
    for(const lost of frame.frontGroupDissolutions){
      if(!groupTimes.delete(lost.groupId))
        throw new Error('A dissolved road group was already absent.');
    }
    if(frame.roadGroups.length!==groupTimes.size||
      frame.roadGroups.some(group=>!groupTimes.has(group.id))||
      frame.droppedTravel.riders.length!==droppedTimes.size)
      throw new Error('The shoulder road lost a rider or active group.');
    const roadGroups=frame.roadGroups.map(group=>{
      const time=groupTimes.get(group.id)+group.elapsedSeconds;
      groupTimes.set(group.id,time);
      if(Math.abs(bunchTime-time-group.gapSeconds)>EPSILON||
        time>=bunchTime-EPSILON)
        throw new Error('An active group reached the bunch without a merge.');
      return {id:group.id,riderIds:[...group.riderIds],
        passageSecondsFromBunchMarker:time,
        gapSeconds:group.gapSeconds};
    });
    const isolated=frame.droppedTravel.riders.map(row=>{
      const before=beforeSolo.get(row.riderId);
      const time=before+row.elapsedSeconds;
      if(!Number.isFinite(before)||
        Math.abs(time-bunchTime-row.deficitSecondsAfter)>EPSILON||
        !Number.isFinite(row.energyAfter)||
        row.energyAfter<-EPSILON)
        throw new Error('An isolated shoulder passage lost time or energy.');
      droppedTimes.set(row.riderId,time);
      return {riderId:row.riderId,
        passageSecondsFromBunchMarker:time,
        energyAfter:row.energyAfter,
        laneRule:leaverIds.has(row.riderId)?
          'exhausted_leaver_outside_no_draft':
          'source_isolated_no_draft'};
    });
    // Earlier, equally timed leavers occupy distinct outside lanes. No
    // later reversal among solo passage clocks is allowed in this version.
    for(let a=0;a<isolated.length;a++)for(let b=a+1;b<isolated.length;b++){
      const left=isolated[a].riderId,right=isolated[b].riderId;
      const before=beforeSolo.get(left)-beforeSolo.get(right);
      const after=droppedTimes.get(left)-droppedTimes.get(right);
      if(before*after<-EPSILON)
        throw new Error('Isolated riders need a separate passing rule.');
    }
    if(isolated.some(row=>
      roadGroups.some(group=>
        Math.abs(group.passageSecondsFromBunchMarker-
          row.passageSecondsFromBunchMarker)<EPSILON)))
      throw new Error('A shoulder rider ties an active group marker.');
    const onRoad=[...roadGroups.flatMap(group=>group.riderIds),
      ...frame.pelotonRiderIds,...isolated.map(row=>row.riderId)];
    const riderEnergy=frame.riders.map(row=>({riderId:row.riderId,
      energy:row.energy,role:row.role}));
    if(new Set(onRoad).size!==onRoad.length||
      riderEnergy.length!==onRoad.length||
      new Set(riderEnergy.map(row=>row.riderId)).size!==onRoad.length||
      riderEnergy.some(row=>!onRoad.includes(row.riderId)||
        !Number.isFinite(row.energy)||row.energy<0))
      throw new Error('A shoulder passage lost its paid rider energy.');
    passages.push({distanceM:frame.endDistanceM,
      bunchPassageSecondsFromBunchMarker:bunchTime,
      roadGroups,pelotonRiderIds:[...frame.pelotonRiderIds],
      isolated,riderEnergy});
    if(frame===first&&isolated.some(row=>
      leaverIds.has(row.riderId)&&
      row.passageSecondsFromBunchMarker<=bunchTime+EPSILON))
      throw new Error('The shoulder road needs all leavers passed in the first slice.');
    if(frame!==first&&isolated.some(row=>
      row.passageSecondsFromBunchMarker<=bunchTime+EPSILON))
      throw new Error('An isolated rider reached the bunch after the pass.');
    if(frame===first&&startBunchTime!==0)
      throw new Error('The shoulder road has no source marker.');
  }
  const last=passages.at(-1);
  const locked=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  const seen=[...last.roadGroups.flatMap(row=>row.riderIds),
    ...trace.frames.at(-1).pelotonRiderIds,
    ...last.isolated.map(row=>row.riderId)];
  if(seen.length!==locked.length||new Set(seen).size!==locked.length||
    locked.some(id=>!seen.includes(id))||
    last.distanceM!==tour.route.distanceKm*1000)
    throw new Error('The shoulder road has no complete locked field.');
  return {version:FINALE_DISSOLVED_FRONT_SHOULDER_ROAD_VERSION,
    sourceTraceVersion:trace.version,
    sourcePositionVersion:positioned.version,
    sourceUnshiftedWheelAuditVersion:unshiftedWheelAudit.version,
    sourceKm:snapshot.sourceKm,
    laneAssignments,unshiftedWheelAudit,trace,passages,
    lineRoad:{roadGroups:last.roadGroups,
      pelotonRiderIds:[...trace.frames.at(-1).pelotonRiderIds],
      bunchPassageSecondsFromBunchMarker:
        last.bunchPassageSecondsFromBunchMarker,
      isolated:last.isolated,riderEnergy:last.riderEnergy},
    status:'paid_shoulder_pass_road_individual_finish_pending',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleDissolvedFrontShoulderRoad(tour,recording){
  if(!isDeepStrictEqual(recording,
    recordFinaleDissolvedFrontShoulderRoad(tour)))
    throw new Error('The dissolved-front shoulder road does not replay.');
  return true;
}
