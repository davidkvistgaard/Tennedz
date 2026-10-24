import {isDeepStrictEqual} from 'node:util';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {resolveFinaleMultibandPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {FINALE_COAST_MIXED_TWO_FRONT_DROPPED_CLOCK_VERSION,
  validateFinaleCoastMixedTwoFrontDroppedClock} from
  './finale-separated-last-km.mjs';
import {paidQueuedRiderAt,splitPaidQueuedBandAt} from
  './finale-late-active-wheel-contact.mjs';

export const FINALE_MIXED_TWO_FRONT_DROPPED_PRE500_AUDIT_VERSION=
  'v2-finale-mixed-two-front-dropped-pre500-wheel-audit-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_PRE500_AUDIT_VERSION=
  'v2-finale-mixed-two-front-dropped-fresh-pre500-wheel-audit-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_MANY_PRE500_AUDIT_VERSION=
  'v2-finale-mixed-two-front-dropped-many-pre500-wheel-audit-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_MULTIFRONT_PRE500_AUDIT_VERSION=
  'v2-finale-mixed-two-front-dropped-multifront-pre500-wheel-audit-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_THIRTEEN_MULTIFRONT_PRE500_AUDIT_VERSION=
  'v2-finale-mixed-two-front-dropped-thirteen-multifront-pre500-wheel-audit-1';
const EPSILON=1e-7;
const SPACING_M=2.5;

function at(frame,time){
  const row=frame.riders[0];
  return row.positionBeforeM+(time-frame.elapsedSecondsAtStart)*
    (row.positionM-row.positionBeforeM)/frame.durationSeconds;
}

function proximityIntervals(first,second){
  const intervals=[];
  for(const left of first.runner.frames)
    for(const right of second.runner.frames){
      const start=Math.max(left.elapsedSecondsAtStart,
        right.elapsedSecondsAtStart);
      const end=Math.min(left.elapsedSecondsAtStart+left.durationSeconds,
        right.elapsedSecondsAtStart+right.durationSeconds);
      if(end<start-EPSILON)continue;
      const gap=time=>at(left,time)-at(right,time);
      if(end<=start+EPSILON){
        if(Math.abs(gap(start))<=SPACING_M+EPSILON)
          intervals.push({from:start,to:start});
        continue;
      }
      const before=gap(start),after=gap(end);
      const cuts=[start,end];
      for(const edge of [-SPACING_M,SPACING_M]){
        const share=(edge-before)/(after-before);
        if(Number.isFinite(share)&&share>EPSILON&&share<1-EPSILON)
          cuts.push(start+share*(end-start));
      }
      cuts.sort((a,b)=>a-b);
      for(let index=0;index<cuts.length-1;index++){
        const from=cuts[index],to=cuts[index+1];
        if(to-from<=EPSILON||
          Math.abs(gap((from+to)/2))>SPACING_M+EPSILON)continue;
        const last=intervals.at(-1);
        if(last&&from<=last.to+EPSILON)last.to=to;
        else intervals.push({from,to});
      }
      for(const time of [start,end])
        if(Math.abs(gap(time))<=SPACING_M+EPSILON){
          const last=intervals.at(-1);
          if(last&&time<=last.to+EPSILON)
            last.to=Math.max(last.to,time);
          else intervals.push({from:time,to:time});
        }
    }
  intervals.sort((a,b)=>a.from-b.from||a.to-b.to);
  const merged=[];
  for(const interval of intervals){
    const last=merged.at(-1);
    if(last&&interval.from<=last.to+EPSILON)
      last.to=Math.max(last.to,interval.to);
    else merged.push({...interval});
  }
  return merged;
}

// The source group's riders are already adjacent. An isolated rider takes
// a distinct inferred outside lane on exit; only a NEW approach after
// separation or an approach to another source group can invalidate it.
function recordPre500Audit(tour,clock,line,{
  allowOneFresh=false,allowManyFresh=false,
  allowMultipleFronts=false,thirteenMultifront=false}={}){
  if(clock?.version!==FINALE_COAST_MIXED_TWO_FRONT_DROPPED_CLOCK_VERSION||
    line?.roadStatus!==
      'conditional_mixed_two_front_older_drops_lines')
    throw new Error('The two-front wheel audit needs its paid clock and line.');
  validateFinaleCoastMixedTwoFrontDroppedClock(tour,clock);
  const source=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  const positioned=resolveFinaleMultibandPositionedSource(tour,{
    includeDropped:true});
  const frames=clock.trace.frames.slice(0,2);
  if(source.roadGroups.length!==2||!source.droppedRiderIds.length||
    positioned.roadBands.length!==3||
    frames.length!==2||
    frames[0].endDistanceM!==source.startDistanceM+250||
    frames[1].endDistanceM!==source.startDistanceM+500||
    frames.some(frame=>frame.exhaustionDrops.length||
      frame.frontGroupDissolutions?.length))
    throw new Error('The two-front wheel audit lacks a paid 500 m handoff.');
  const sourceSlots=positioned.roadBands.flatMap(group=>
    group.slots.map(slot=>({id:slot.riderId,groupId:group.id,
      offset:source.startDistanceM-slot.positionM})));
  for(const id of source.droppedRiderIds)
    sourceSlots.push({id,groupId:'older',offset:0});
  const roster=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(row=>row.id));
  if(sourceSlots.length!==roster.length||
    new Set(sourceSlots.map(row=>row.id)).size!==roster.length||
    roster.some(id=>!sourceSlots.some(row=>row.id===id)))
    throw new Error('The two-front wheel audit lost a source rider.');
  const sourceEnergy=new Map(tour.frames[source.sourceKm-1]
    .riderGroups.map(row=>[row.id,row.energy]));
  if(sourceEnergy.size!==roster.length||
    roster.some(id=>!Number.isFinite(sourceEnergy.get(id))))
    throw new Error('The two-front wheel audit lacks source energy.');
  const groupStart=new Map(source.roadGroups.map(row=>[
    row.id,-row.gapSeconds]));
  let bunchStart=0;
  const bands=new Map(sourceSlots.map(slot=>[slot.id,{
    sourceGroupId:slot.groupId,roadBandId:`source:${slot.id}`,
    runner:{frames:[]}}]));
  for(const frame of frames){
    for(const slot of sourceSlots){
      const solo=frame.droppedTravel.riders.find(row=>
        row.riderId===slot.id);
      const group=frame.roadGroups.find(row=>row.id===slot.groupId);
      const start=solo?bunchStart+solo.deficitSecondsBefore:
        slot.groupId==='peloton'?bunchStart:groupStart.get(slot.groupId);
      const duration=solo?.elapsedSeconds??
        (slot.groupId==='peloton'?frame.bunchElapsedSeconds:
          group?.elapsedSeconds);
      const paid=frame.riders.find(row=>row.riderId===slot.id);
      const energyBefore=paid?.energy+paid?.energySpent;
      const prior=bands.get(slot.id).runner.frames.at(-1);
      if(![start,duration,energyBefore,paid?.energy,
        paid?.energySpent].every(Number.isFinite)||duration<=0||
        Math.abs(energyBefore-paid.energySpent-paid.energy)>EPSILON||
        Math.abs(energyBefore-(prior?.riders[0].energyAfter??
          sourceEnergy.get(slot.id)))>EPSILON)
        throw new Error('A two-front wheel lacks paid time or energy.');
      const metres=frame.endDistanceM-frame.startDistanceM;
      bands.get(slot.id).runner.frames.push({
        elapsedSecondsAtStart:start,durationSeconds:duration,
        riders:[{riderId:slot.id,
          positionBeforeM:frame.startDistanceM-slot.offset,
          positionM:frame.endDistanceM-slot.offset,
          activeSeconds:duration,activeDistanceM:metres,
          shelteredSeconds:0,shelteredDistanceM:0,
          energyAtDecision:energyBefore,energySpent:paid.energySpent,
          energyAfter:paid.energy}]});
    }
    for(const group of frame.roadGroups)
      groupStart.set(group.id,groupStart.get(group.id)+
        group.elapsedSeconds);
    bunchStart+=frame.bunchElapsedSeconds;
  }
  const at500=new Map(frames[1].riders.map(row=>[
    row.riderId,row.energy]));
  const lineHandoff=new Map(line.bandRunners.flatMap(band=>
    band.runner.frames[0].riders.map(row=>[
      row.riderId,row.energyAtDecision])));
  if(lineHandoff.size!==roster.length||
    roster.some(id=>!Number.isFinite(at500.get(id))||
      !Number.isFinite(lineHandoff.get(id))||
      Math.abs(at500.get(id)-lineHandoff.get(id))>EPSILON))
    throw new Error('The two-front wheel audit lost handoff energy.');
  const rows=[...bands.values()];
  let sourceAdjacentPairs=0;
  let firstFreshApproach=null;
  const freshApproaches=[];
  for(let a=0;a<rows.length;a++)for(let b=a+1;b<rows.length;b++){
    const intervals=proximityIntervals(rows[a],rows[b]);
    if(!intervals.length)continue;
    const commonStart=Math.max(...[rows[a],rows[b]].map(row=>
      row.runner.frames[0].elapsedSecondsAtStart));
    const sourceAdjacent=intervals.length===1&&
      intervals[0].from<=commonStart+EPSILON;
    const freshSameSource=(allowOneFresh||allowManyFresh)&&
      rows[a].sourceGroupId===rows[b].sourceGroupId&&
      intervals.length===1&&
      intervals[0].from>commonStart+EPSILON&&
      (allowManyFresh||!firstFreshApproach);
    if(rows[a].sourceGroupId!==rows[b].sourceGroupId||
      !sourceAdjacent&&!freshSameSource)
      throw new Error('The two-front wheels have a new unpaid approach: '+
        `${sourceSlots[a].id}/${sourceSlots[b].id} `+
        JSON.stringify(intervals));
    if(sourceAdjacent)sourceAdjacentPairs++;
    else{
      const time=intervals[0].from;
      const first=paidQueuedRiderAt(rows[a],sourceSlots[a].id,time);
      const second=paidQueuedRiderAt(rows[b],sourceSlots[b].id,time);
      if(Math.abs(Math.abs(first.positionM-second.positionM)-
        SPACING_M)>EPSILON||
        (!allowMultipleFronts&&
          sourceSlots[a].groupId!==source.roadGroups[0].id)||
        (allowMultipleFronts&&
          !source.roadGroups.some(group=>
            group.id===sourceSlots[a].groupId))||
        first.energy>EPSILON||second.energy<=EPSILON||
        first.positionM<=source.startDistanceM-sourceSlots[a].offset||
        first.positionM>=source.startDistanceM-sourceSlots[a].offset+10)
        throw new Error('The new two-front approach lacks paid spacing.');
      const approach={firstRiderId:first.riderId,
        secondRiderId:second.riderId,
        ...(allowMultipleFronts?{
          sourceRoadGroupId:sourceSlots[a].groupId}:{}),
        elapsedSecondsFromLastKmStart:time,
        firstWheelM:first.positionM,secondWheelM:second.positionM,
        firstEnergy:first.energy,secondEnergy:second.energy,
        paidSplit:{first:splitPaidQueuedBandAt(rows[a],time,
          first.positionM),second:splitPaidQueuedBandAt(rows[b],time,
          second.positionM)},contactResolved:false};
      if(allowManyFresh)freshApproaches.push(approach);
      else firstFreshApproach=approach;
    }
  }
  if(allowOneFresh&&(!firstFreshApproach||
    tour.committedInputs.teams.length!==15||
    tour.route.distanceKm!==260))
    throw new Error('The fresh two-front audit needs one 15-team approach.');
  if(allowManyFresh){
    freshApproaches.sort((a,b)=>
      a.elapsedSecondsFromLastKmStart-
      b.elapsedSecondsFromLastKmStart);
    if(tour.committedInputs.teams.length!==20||
      tour.route.distanceKm!==260||
      (thirteenMultifront?freshApproaches.length!==13:
        freshApproaches.length<2||freshApproaches.length>12))
      throw new Error('The many-fresh two-front audit needs bounded geometry.');
  }
  const leavers=clock.trace.frames.flatMap(frame=>
    frame.frontExhaustionDrops.map(row=>row.riderId));
  const isolated=clock.trace.finalDroppedRiderIds;
  if(leavers.length<2||isolated.length!==
    source.droppedRiderIds.length+leavers.length)
    throw new Error('The two-front wheel audit lost isolated riders.');
  return {version:thirteenMultifront?
    FINALE_MIXED_TWO_FRONT_DROPPED_THIRTEEN_MULTIFRONT_PRE500_AUDIT_VERSION:
    allowMultipleFronts?
    FINALE_MIXED_TWO_FRONT_DROPPED_MULTIFRONT_PRE500_AUDIT_VERSION:
    allowManyFresh?
    FINALE_MIXED_TWO_FRONT_DROPPED_MANY_PRE500_AUDIT_VERSION:
    allowOneFresh?
    FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_PRE500_AUDIT_VERSION:
    FINALE_MIXED_TWO_FRONT_DROPPED_PRE500_AUDIT_VERSION,
    status:allowManyFresh?'multiple_paid_fresh_approaches_unresolved':
      allowOneFresh?'one_paid_fresh_approach_wheel_order_unresolved':
        'source_adjacent_outside_lanes_no_fresh_approach',
    sourceAdjacentPairs,paidRiderCount:roster.length,
    ...(allowOneFresh?{firstFreshApproach}:{}),
    ...(allowManyFresh?{freshApproaches}:{}),
    handoffDistanceM:source.startDistanceM+500,
    olderDroppedRiderIds:[...source.droppedRiderIds],
    outsideLaneAssignments:isolated.map((riderId,index)=>({
      riderId,outsideLane:positioned.laneCount+index,
      noDraft:true,inferred:true})),
    contactResolved:false,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}

export function recordFinaleMixedTwoFrontDroppedPre500Audit(tour,clock,
  line){
  return recordPre500Audit(tour,clock,line);
}

// Internal diagnostic only. A paid approach does not determine occupied
// lanes or a post-approach response and cannot authorize a playtest line.
export function recordFinaleMixedTwoFrontDroppedFreshPre500Audit(tour,
  clock,line){
  return recordPre500Audit(tour,clock,line,{allowOneFresh:true});
}

// Internal diagnostic for several exact same-source approaches. It does
// not establish occupied lanes, a post-approach response, or a finish.
export function recordFinaleMixedTwoFrontDroppedManyPre500Audit(tour,
  clock,line){
  return recordPre500Audit(tour,clock,line,{allowManyFresh:true});
}

// Internal audit only: exhausted riders may leave either paid surviving
// front. This does not resolve occupied lanes or authorize a result.
export function recordFinaleMixedTwoFrontDroppedMultifrontPre500Audit(tour,
  clock,line){
  return recordPre500Audit(tour,clock,line,{
    allowManyFresh:true,allowMultipleFronts:true});
}

// Separate exact diagnostic for thirteen paid exits from two surviving
// fronts. It still does not resolve occupied-wheel order or authorize a line.
export function recordFinaleMixedTwoFrontDroppedThirteenMultifrontPre500Audit(
  tour,clock,line){
  return recordPre500Audit(tour,clock,line,{
    allowManyFresh:true,allowMultipleFronts:true,thirteenMultifront:true});
}

export function validateFinaleMixedTwoFrontDroppedPre500Audit(tour,
  clock,line,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedPre500Audit(tour,clock,line)))
    throw new Error('The two-front wheel audit does not replay.');
  return true;
}
