// Read-only whole-race witness for unequal-strength field refusals.
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from '../lib/engine/v2/tuning.mjs';
import {probeFinaleSeparatedGroupsFromTour,FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION} from '../lib/engine/v2/finale-multi-run.mjs';
import {finaleSnapshotFromTour} from '../lib/engine/v2/finale-snapshot.mjs';
import {auditDissolvedFrontPaidContact} from '../lib/engine/v2/finale-dissolved-front-paid-contact.mjs';
import {createV93PlayableTest} from '../lib/engine/v2/playtest-v93-coasted.mjs';
import {recordFinaleCoastMixedTwoFrontDroppedClock} from
  '../lib/engine/v2/finale-separated-last-km.mjs';
import {recordFinaleCoastedIndividualLine} from
  '../lib/engine/v2/finale-depleted-individual-line.mjs';
import {recordFinaleMixedTwoFrontDroppedPre500Audit,
  recordFinaleMixedTwoFrontDroppedFreshPre500Audit} from
  '../lib/engine/v2/finale-mixed-two-front-dropped-pre500-audit.mjs';
import {recordFinaleMixedTwoFrontDroppedFreshFinal500Audit} from
  '../lib/engine/v2/finale-mixed-two-front-dropped-final500-audit.mjs';
import {recordFinaleAllBandOverlapAudit,
  recordFinaleUnorderedBandOverlapAudit} from
  '../lib/engine/v2/finale-multiband-overlap-audit.mjs';
import {resolveFinaleMultibandPositionedSource} from
  '../lib/engine/v2/finale-multiband-positioned-source.mjs';
import {recordFinalePaidCrossBandOverlap,paidQueuedRiderAt,
  splitPaidQueuedBandAt} from
  '../lib/engine/v2/finale-late-active-wheel-contact.mjs';

const teamCount=Number(process.argv[2]??4);
const gender=process.argv[3]??'M';
const terrain=process.argv[4]??'flat';
const fatigue=Number(process.argv[5]??30);
const settings={distanceKm:260,teamCount,gender,terrain,fatigue,
  seed:`v93-heterogeneous-${teamCount}-${gender}-${terrain}-${fatigue}`,
  defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
  managerTactics:Array.from({length:teamCount-1},(_,index)=>({
    effort:['hard','steady','conserve'][index%3],
    attack:index%3===0?'repeated':'selective',
    chase:index%3===1?'all':'selective'})),
  teamOverrides:[{teamId:'you',level:45},
    ...Array.from({length:teamCount-1},(_,index)=>({
      teamId:`rival-${index+1}`,level:index%2===0?25:65}))],
  managerFinaleOrders:[
    {teamId:'you',atKm:255,effort:'steady',chase:'all'},
    {teamId:'rival-1',atKm:255,effort:'hard'}]};
const {stage,weather,teams,seed}=prepareV91Playtest(settings);
const recording=simulateTacticalTour({stage,weather,teams,seed,
  motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
const source=finaleSnapshotFromTour(recording,{remainingKm:1,
  includeAttackLoad:true});
const sourcePosition=resolveFinaleMultibandPositionedSource(recording,{
  includeDropped:true});
const trace=probeFinaleSeparatedGroupsFromTour(recording,{
  version:FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION});
const contact=auditDissolvedFrontPaidContact(trace);
const sourceSlots=sourcePosition.roadBands.flatMap(group=>
  group.slots.map(slot=>({id:slot.riderId,groupId:group.id,
    offset:source.startDistanceM-slot.positionM})));
for(const id of source.droppedRiderIds)
  sourceSlots.push({id,groupId:'older',offset:0});
const starts=new Map(source.roadGroups.map(row=>[row.id,
  -row.gapSeconds]));
const sourceEnergy=new Map(recording.frames[source.sourceKm-1]
  .riderGroups.map(row=>[row.id,row.energy]));
let bunchStart=0;
const paidPre500=new Map(sourceSlots.map(slot=>[slot.id,{
  sourceGroupId:slot.groupId,roadBandId:`source:${slot.id}`,
  runner:{frames:[]}}]));
for(const frame of trace.frames.slice(0,2)){
  for(const slot of sourceSlots){
    const solo=frame.droppedTravel.riders.find(row=>
      row.riderId===slot.id);
    const group=frame.roadGroups.find(row=>row.id===slot.groupId);
    const start=solo?bunchStart+solo.deficitSecondsBefore:
      slot.groupId==='peloton'?bunchStart:starts.get(slot.groupId);
    const duration=solo?.elapsedSeconds??
      (slot.groupId==='peloton'?frame.bunchElapsedSeconds:
        group?.elapsedSeconds);
    if(!Number.isFinite(start)||!Number.isFinite(duration))
      throw new Error('An unequal-field rider lacks paid pre-500 travel.');
    const paid=frame.riders.find(row=>row.riderId===slot.id);
    const before=paid?.energy+paid?.energySpent;
    const previous=paidPre500.get(slot.id).runner.frames.at(-1);
    if(![before,paid?.energy,paid?.energySpent].every(Number.isFinite)||
      Math.abs(before-(previous?.riders[0].energyAfter??
        sourceEnergy.get(slot.id)))>1e-7)
      throw new Error('An unequal-field rider lacks paid source energy.');
    const metres=frame.endDistanceM-frame.startDistanceM;
    paidPre500.get(slot.id).runner.frames.push({
      elapsedSecondsAtStart:start,durationSeconds:duration,
      riders:[{riderId:slot.id,
        positionBeforeM:frame.startDistanceM-slot.offset,
        positionM:frame.endDistanceM-slot.offset,
        activeSeconds:duration,activeDistanceM:metres,
        shelteredSeconds:0,shelteredDistanceM:0,
        energyAtDecision:before,energySpent:paid.energySpent,
        energyAfter:paid.energy}]});
  }
  for(const group of frame.roadGroups)
    starts.set(group.id,starts.get(group.id)+group.elapsedSeconds);
  bunchStart+=frame.bunchElapsedSeconds;
}
const possiblePre500=[];
const proximityPre500=[];
const bands=[...paidPre500.values()];
const at=(frame,time)=>frame.riders[0].positionBeforeM+
  (time-frame.elapsedSecondsAtStart)*
  (frame.riders[0].positionM-frame.riders[0].positionBeforeM)/
    frame.durationSeconds;
for(let a=0;a<bands.length;a++)for(let b=a+1;b<bands.length;b++){
  const event=recordFinalePaidCrossBandOverlap(bands[a],bands[b]);
  if(event)possiblePre500.push({first:event.firstRiderId,
    second:event.secondRiderId,distanceM:event.distanceM,
    sameSourceGroup:bands[a].sourceGroupId===bands[b].sourceGroupId});
  const intervals=[];
  for(const left of bands[a].runner.frames)
    for(const right of bands[b].runner.frames){
      const start=Math.max(left.elapsedSecondsAtStart,
        right.elapsedSecondsAtStart);
      const end=Math.min(left.elapsedSecondsAtStart+left.durationSeconds,
        right.elapsedSecondsAtStart+right.durationSeconds);
      if(end<=start+1e-7)continue;
      const gap=time=>at(left,time)-at(right,time);
      const before=gap(start),after=gap(end);
      const cuts=[start,end];
      for(const edge of [-2.5,2.5]){
        const share=(edge-before)/(after-before);
        if(Number.isFinite(share)&&share>1e-7&&share<1-1e-7)
          cuts.push(start+share*(end-start));
      }
      cuts.sort((x,y)=>x-y);
      for(let index=0;index<cuts.length-1;index++){
        const from=cuts[index],to=cuts[index+1];
        if(to-from<=1e-7||Math.abs(gap((from+to)/2))>2.5+1e-7)
          continue;
        const last=intervals.at(-1);
        if(last&&from<=last.to+1e-7)last.to=to;
        else intervals.push({from,to});
      }
    }
  if(intervals.length){
    const leftId=bands[a].runner.frames[0].riders[0].riderId;
    const rightId=bands[b].runner.frames[0].riders[0].riderId;
    const commonStart=Math.max(...[bands[a],bands[b]].map(row=>
      row.runner.frames[0].elapsedSecondsAtStart));
    const fresh=intervals.find((row,index)=>index>0||
      row.from>commonStart+1e-7);
    let firstFreshApproach=null;
    if(fresh){
      const time=fresh.from;
      const first=paidQueuedRiderAt(bands[a],leftId,time);
      const second=paidQueuedRiderAt(bands[b],rightId,time);
      firstFreshApproach={time,first,second,
        spacingM:Math.abs(first.positionM-second.positionM),
        paidSplit:{first:splitPaidQueuedBandAt(bands[a],time,
          first.positionM),second:splitPaidQueuedBandAt(bands[b],time,
          second.positionM)}};
    }
    proximityPre500.push({first:leftId,second:rightId,
      sourceAdjacent:intervals[0].from<=commonStart+1e-7,
      freshApproaches:intervals.filter((row,index)=>index>0||
        row.from>commonStart+1e-7).length,
      sameSourceGroup:bands[a].sourceGroupId===bands[b].sourceGroupId,
      firstFreshApproach});
  }
}
let candidate;
try{const clock=recordFinaleCoastMixedTwoFrontDroppedClock(recording);
  candidate={version:clock.version,outcome:clock.line.outcome,
    bands:clock.line.bands.map(row=>({id:row.id,
      count:row.riderIds.length}))};
  try{const line=recordFinaleCoastedIndividualLine(recording,clock);
    const final500=recordFinaleAllBandOverlapAudit(line.bandRunners);
    const sourceBandByRider=new Map(clock.line.bands.flatMap(band=>
      band.riderIds.map(id=>[id,band.id])));
    const pairwise=[];
    for(let a=0;a<line.bandRunners.length;a++)
      for(let b=a+1;b<line.bandRunners.length;b++){
        const audit=recordFinaleUnorderedBandOverlapAudit([
          line.bandRunners[a],line.bandRunners[b]]);
        const event=audit.firstPotentialOverlap;
        if(event)pairwise.push({first:event.firstRiderId,
          second:event.secondRiderId,distanceM:event.distanceM,
          sameSourceBand:sourceBandByRider.get(event.firstRiderId)===
            sourceBandByRider.get(event.secondRiderId)});
      }
    candidate.line={version:line.version,
      crossings:line.conditionalCrossings.length,
      replayBands:line.bandRunners.length,
      status:line.roadStatus,
      sourceBands:line.positionedSource.roadBands.map(row=>({id:row.id,
        count:row.slots.length})),
      sourceDropped:line.positionedSource.droppedRiderIds.length,
      final500Overlap:final500.firstPotentialOverlap,
      final500Pairwise:{possible:pairwise.length,
        crossSourceBand:pairwise.filter(row=>!row.sameSourceBand)}};
    try{const audit=recordFinaleMixedTwoFrontDroppedPre500Audit(
      recording,clock,line);
      candidate.pre500Audit={status:audit.status,
        sourceAdjacentPairs:audit.sourceAdjacentPairs,
        paidRiderCount:audit.paidRiderCount};}
    catch(error){
      candidate.pre500Audit={reason:error.message};
      if(teamCount===15){
        try{
          const fresh=recordFinaleMixedTwoFrontDroppedFreshPre500Audit(
            recording,clock,line);
          candidate.freshPre500Audit={status:fresh.status,
            firstFreshApproach:{
              firstRiderId:fresh.firstFreshApproach.firstRiderId,
              secondRiderId:fresh.firstFreshApproach.secondRiderId,
              firstWheelM:fresh.firstFreshApproach.firstWheelM,
              secondWheelM:fresh.firstFreshApproach.secondWheelM,
              firstEnergy:fresh.firstFreshApproach.firstEnergy,
              secondEnergy:fresh.firstFreshApproach.secondEnergy}};
          try{const final=recordFinaleMixedTwoFrontDroppedFreshFinal500Audit(
            recording,clock,line,fresh);
            candidate.freshFinal500Audit={status:final.status,
              freshApproaches:final.freshApproaches.map(row=>({
                firstRiderId:row.firstRiderId,
                secondRiderId:row.secondRiderId,
                elapsedSecondsFromLastKmStart:
                  row.elapsedSecondsFromLastKmStart,
                firstWheelM:row.firstWheelM,
                secondWheelM:row.secondWheelM,
                firstEnergy:row.firstEnergy,
                secondEnergy:row.secondEnergy}))};}
          catch(reason){candidate.freshFinal500Audit={reason:reason.message};}
        }catch(reason){candidate.freshPre500Audit={reason:reason.message};}
      }
    }}
  catch(error){candidate.line={reason:error.message};}}
catch(error){candidate={reason:error.message};}
const groupTimes=new Map(source.roadGroups.map(row=>[row.id,
  -row.gapSeconds]));
const sourceRows=new Map(recording.frames[source.sourceKm-1]
  .riderGroups.map(row=>[row.id,row]));
const droppedTimes=new Map(source.droppedRiderIds.map(id=>[
  id,sourceRows.get(id)?.deficitSeconds]));
let bunchTime=0;
const markerOrder=trace.frames.map(frame=>{
  const oldBunchTime=bunchTime;
  bunchTime+=frame.bunchElapsedSeconds;
  for(const row of frame.frontExhaustionDrops)
    droppedTimes.set(row.riderId,
      oldBunchTime+row.initialDeficitSeconds);
  for(const row of frame.exhaustionDrops)
    droppedTimes.set(row.riderId,oldBunchTime);
  for(const group of frame.roadGroups)
    groupTimes.set(group.id,groupTimes.get(group.id)+group.elapsedSeconds);
  for(const rider of frame.droppedTravel.riders)
    droppedTimes.set(rider.riderId,
      droppedTimes.get(rider.riderId)+rider.elapsedSeconds);
  const isolated=[...droppedTimes].sort((a,b)=>a[1]-b[1]);
  return {distanceM:frame.endDistanceM,
    groups:[...groupTimes].map(([id,time])=>({id,
      secondsFromBunch:time-bunchTime})),
    isolated:isolated.map(([id,time])=>({id,
      secondsFromBunch:time-bunchTime}))};
});
let playable;
try{const race=createV93PlayableTest(settings);
  playable={version:race.version,
    crossings:race.individualLine?.conditionalCrossings.length};}
catch(error){playable={reason:error.roadPreview?.unsupportedReason??
  error.message};}
console.log(JSON.stringify({seed:settings.seed,playable,candidate,
  sourceGroups:source.roadGroups.map(row=>({id:row.id,
    count:row.riderIds.length,gapSeconds:row.gapSeconds})),
  sourcePositionBands:sourcePosition.roadBands.map(row=>({id:row.id,
    slots:row.slots.map(slot=>({id:slot.riderId,
      positionM:slot.positionM}))})),
  possiblePre500:{count:possiblePre500.length,
    crossSourceGroup:possiblePre500.filter(row=>
      !row.sameSourceGroup),
    sameSourceGroup:possiblePre500.filter(row=>
      row.sameSourceGroup)},
  proximityPre500:{count:proximityPre500.length,
    fresh:proximityPre500.filter(row=>row.freshApproaches>0),
    crossSourceGroup:proximityPre500.filter(row=>
      !row.sameSourceGroup)},
  priorDropped:source.droppedRiderIds.length,
  trace:trace.frames.map(row=>({distanceM:row.endDistanceM,
    groups:row.roadGroups.map(group=>({id:group.id,
      count:group.riderIds.length})),
    frontExits:row.frontExhaustionDrops.map(exit=>({id:exit.riderId,
      from:exit.fromRoadGroupId})),
    bunchExits:row.exhaustionDrops.map(exit=>exit.riderId),
    isolated:row.droppedTravel.riders.map(rider=>({id:rider.riderId,
      contactM:rider.contactDistanceM,
      status:rider.contactStatus}))})),
  paidFirstFrame:{groups:trace.frames[0].roadGroups,
    bunchElapsedSeconds:trace.frames[0].bunchElapsedSeconds,
    droppedTravel:trace.frames[0].droppedTravel.riders.slice(0,2),
    riders:trace.frames[0].riders.slice(0,2)},
  paidMarkerEncounters:contact.encounters.map(row=>({rider:row.riderId,
    band:row.activeBandId,distanceM:row.distanceM})),
  markerOrder},null,2));
