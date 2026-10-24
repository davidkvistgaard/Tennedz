import {isDeepStrictEqual} from 'node:util';
import {recordFinaleMixedStraddlingIndividualAudit} from
  './finale-mixed-straddling-individual-audit.mjs';
import {recordFinaleUnorderedBandOverlapAudit} from
  './finale-multiband-overlap-audit.mjs';
import {FINALE_COAST_MIXED_THREE_FRONT_STRADDLING_CANDIDATE_VERSION} from
  './finale-separated-last-km.mjs';
import {FINALE_STRADDLING_MARKER_CANDIDATE_INDIVIDUAL_LINE_VERSION} from
  './finale-depleted-individual-line.mjs';
import {resolveFinaleMultibandPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {recordFinalePaidCrossBandOverlap,paidQueuedRiderAt,
  splitPaidQueuedBandAt} from
  './finale-late-active-wheel-contact.mjs';

export const FINALE_MIXED_STRADDLING_OUTSIDE_LANE_AUDIT_VERSION=
  'v2-finale-mixed-straddling-outside-lane-audit-1';
const EPSILON=1e-7;

function spent(frames,riderId){
  return frames.reduce((sum,frame)=>sum+
    (frame.riders.find(row=>row.riderId===riderId)?.energySpent??0),0);
}

function energyThroughLine(role,riderId,energyAtApproach,before,
  clock,line,energy500,crossing){
  const total=spent(clock.trace.frames.slice(0,2),riderId);
  const remaining=total-spent(before,riderId);
  const band=line.bandRunners.find(row=>
    row.runner.finishers.some(finisher=>finisher.riderId===riderId));
  const finisher=band?.runner.finishers.find(row=>
    row.riderId===riderId);
  const paidTail=spent(band?.runner.frames??[],riderId);
  const handoffEnergy=energy500.get(riderId);
  const lineEnergy=crossing.get(riderId)?.energyAtLine;
  if(!Number.isFinite(handoffEnergy)||!finisher||
    remaining<-EPSILON||paidTail<-EPSILON||
    Math.abs(energyAtApproach-remaining-handoffEnergy)>EPSILON||
    Math.abs(handoffEnergy-paidTail-lineEnergy)>EPSILON||
    Math.abs(lineEnergy-finisher.energyAtLine)>EPSILON)
    throw new Error('A straddling approach loses paid finish energy.');
  return {role,riderId,energyAtApproach,
    spentFromApproachToHandoff:remaining,
    energyAtHandoff:handoffEnergy,
    spentFromHandoffToLine:paidTail,energyAtLine:lineEnergy};
}

function paidPre500Frame(frame,riderId,offset,start,duration){
  const row=frame.riders.find(item=>item.riderId===riderId);
  const before=row?.energyBefore??row?.energy+row?.energySpent;
  const after=row?.energyAfter??row?.energy;
  if(!row||![before,after,row.energySpent,start,duration]
    .every(Number.isFinite)||duration<=0||
    Math.abs(before-row.energySpent-after)>EPSILON)
    throw new Error('A pre-500 active wheel lacks paid motion.');
  const metres=frame.endDistanceM-frame.startDistanceM;
  return {startDistanceM:frame.startDistanceM,
    endDistanceM:frame.endDistanceM,elapsedSecondsAtStart:start,
    durationSeconds:duration,riders:[{riderId,
      positionBeforeM:frame.startDistanceM-offset,
      positionM:frame.endDistanceM-offset,
      activeSeconds:duration,activeDistanceM:metres,
      shelteredSeconds:0,shelteredDistanceM:0,
      energyAtDecision:before,energySpent:row.energySpent,
      energyAfter:after}]};
}

function pre500Band(clocks,source,slot,groupId){
  const offset=source.startDistanceM-slot.positionM;
  return {roadBandId:groupId,runner:{frames:clocks.map(
    ({frame,bunchStart})=>{
      const group=frame.roadGroups.find(row=>row.id===groupId);
      const solo=frame.droppedTravel.riders.find(row=>
        row.riderId===slot.riderId);
      if(groupId.startsWith('isolated:')||groupId.startsWith('older:')||
        groupId.startsWith('rear:')){
        if(!solo)throw new Error('A source leaver lacks paid solo travel.');
        return paidPre500Frame(frame,slot.riderId,offset,
          bunchStart+solo.deficitSecondsBefore,solo.elapsedSeconds);
      }
      const duration=groupId==='peloton'?
        frame.bunchElapsedSeconds:group?.elapsedSeconds;
      const start=groupId==='peloton'?bunchStart:
        bunchStart+(group?.sourceOffsetSeconds??
          -group?.gapSeconds+frame.bunchElapsedSeconds-duration);
      return paidPre500Frame(frame,slot.riderId,offset,start,duration);
    })}};
}

function shifted(band,metres){
  return {...band,runner:{frames:band.runner.frames.map(frame=>({
    ...frame,riders:frame.riders.map(row=>({...row,
      positionBeforeM:row.positionBeforeM+metres,
      positionM:row.positionM+metres}))}))}};
}

function proximityIntervals(first,firstId,second,secondId,start,end,
  spacing){
  const frames=[...first.runner.frames,...second.runner.frames];
  const boundaries=[start,end,...frames.flatMap(frame=>[
    frame.elapsedSecondsAtStart,
    frame.elapsedSecondsAtStart+frame.durationSeconds])]
    .filter(time=>time>=start-EPSILON&&time<=end+EPSILON)
    .sort((a,b)=>a-b)
    .filter((time,index,all)=>index===0||time>all[index-1]+EPSILON);
  const gap=time=>paidQueuedRiderAt(first,firstId,time).positionM-
    paidQueuedRiderAt(second,secondId,time).positionM;
  const cuts=[...boundaries];
  for(let index=0;index<boundaries.length-1;index++){
    const a=boundaries[index],b=boundaries[index+1];
    const ga=gap(a),gb=gap(b);
    for(const target of [-spacing,spacing]){
      const share=(target-ga)/(gb-ga);
      if(Number.isFinite(share)&&share>EPSILON&&share<1-EPSILON)
        cuts.push(a+share*(b-a));
    }
  }
  cuts.sort((a,b)=>a-b);
  const intervals=[];
  for(let index=0;index<cuts.length-1;index++){
    const a=cuts[index],b=cuts[index+1];
    if(b-a<=EPSILON||Math.abs(gap((a+b)/2))>spacing+EPSILON)
      continue;
    const last=intervals.at(-1);
    if(last&&a<=last.endSeconds+EPSILON)last.endSeconds=b;
    else intervals.push({startSeconds:a,endSeconds:b});
  }
  return intervals;
}

function auditOtherActivePre500(tour,clock,approach){
  const source=resolveFinaleMultibandPositionedSource(tour,{
    includeDropped:true});
  const frames=clock.trace.frames.filter(frame=>
    frame.endDistanceM<=approach.handoffDistanceM);
  if(frames.length!==2||source.roadBands.length!==4)
    throw new Error('The pre-500 audit lacks paid active source bands.');
  let bunchStart=0;
  const clocks=frames.map(frame=>{
    const item={frame,bunchStart};
    bunchStart+=frame.bunchElapsedSeconds;
    return item;
  });
  const former=source.roadBands[0];
  const active=source.roadBands.filter(band=>
    band.id!=='road-2').flatMap(band=>band.slots
    .filter(slot=>!approach.approaches.some(event=>
      event.riderId===slot.riderId))
    .map(slot=>pre500Band(clocks,source,slot,band.id)));
  // Older isolated riders have no inferred source wheel. Giving each the
  // marker's leading position is a conservative upper bound; a clear gap
  // here cannot conceal an encounter behind that marker.
  const older=source.droppedRiderIds.map(riderId=>
    pre500Band(clocks,source,{riderId,
      positionM:source.startDistanceM},`older:${riderId}`));
  const rearIds=new Set(clock.trace.frames.flatMap(frame=>
    frame.frontExhaustionDrops.filter(row=>
      row.fromRoadGroupId==='road-2').map(row=>row.riderId)));
  const rear=source.roadBands[1].slots.filter(slot=>
    rearIds.has(slot.riderId)).map(slot=>
    pre500Band(clocks,source,slot,`rear:${slot.riderId}`));
  const encounters=[];
  for(const event of approach.approaches){
    const slot=former.slots.find(row=>row.riderId===event.riderId);
    if(!slot)throw new Error('A pre-500 approach lacks its source wheel.');
    const solo=pre500Band(clocks,source,slot,
      `isolated:${event.riderId}`);
    for(const band of [...active,...older,...rear]){
      const otherId=band.runner.frames[0].riders[0].riderId;
      const commonStart=Math.max(
        solo.runner.frames[0].elapsedSecondsAtStart,
        band.runner.frames[0].elapsedSecondsAtStart);
      const commonEnd=Math.min(...[solo,band].map(row=>
        row.runner.frames.at(-1).elapsedSecondsAtStart+
          row.runner.frames.at(-1).durationSeconds));
      if(commonStart>=commonEnd-EPSILON)continue;
      const left=paidQueuedRiderAt(solo,event.riderId,commonStart);
      const right=paidQueuedRiderAt(band,otherId,commonStart);
      const initial=Math.abs(left.positionM-right.positionM);
      const possible=initial<=source.wheelSpacingM+EPSILON||
        recordFinalePaidCrossBandOverlap(
          shifted(solo,-source.wheelSpacingM),band)||
        recordFinalePaidCrossBandOverlap(
          shifted(solo,source.wheelSpacingM),band);
      if(possible){
        const intervals=proximityIntervals(solo,event.riderId,
          band,otherId,commonStart,commonEnd,source.wheelSpacingM);
        const sourceAdjacent=initial<=source.wheelSpacingM+EPSILON;
        const fresh=intervals.find((row,index)=>
          row.startSeconds>commonStart+EPSILON||
          sourceAdjacent&&index>0);
        let firstNewEncounter=null;
        if(fresh){
          const time=fresh.startSeconds;
          const soloAt=paidQueuedRiderAt(solo,event.riderId,time);
          const activeAt=paidQueuedRiderAt(band,otherId,time);
          if(Math.abs(Math.abs(soloAt.positionM-activeAt.positionM)-
            source.wheelSpacingM)>EPSILON)
            throw new Error('A new source-group approach lacks paid spacing.');
          firstNewEncounter={elapsedSecondsFromLastKmStart:time,
            isolatedWheelM:soloAt.positionM,
            activeWheelM:activeAt.positionM,
            isolatedEnergyAtApproach:soloAt.energy,
            activeEnergyAtApproach:activeAt.energy,
            paidSplit:{isolated:splitPaidQueuedBandAt(solo,time,
              soloAt.positionM),active:splitPaidQueuedBandAt(band,time,
              activeAt.positionM)},contactResolved:false};
        }
        encounters.push({isolatedRiderId:event.riderId,
          activeRiderId:otherId,activeRoadBandId:band.roadBandId,
          initialSpacingM:initial,nearIntervals:intervals,
          sourceAdjacent,laterFreshEncounter:Boolean(fresh),
          firstNewEncounter});
      }
    }
  }
  return {checkedActiveRiders:active.length,
    checkedOlderDropMarkerBounds:older.length,
    checkedRearIsolatedRiders:rear.length,encounters};
}

// This internal audit pays the known source-wheel approaches and guards
// other active bands before 500 m plus all bands afterward. Potential
// encounters with the riders' former road-1 group remain unresolved, so
// this cannot become a user-facing conditional finish yet.
export function recordFinaleMixedStraddlingOutsideLaneAudit(tour,clock,line){
  const approach=recordFinaleMixedStraddlingIndividualAudit(tour);
  const finishM=tour.route.distanceKm*1000;
  const roster=tour.committedInputs.teams.flatMap(team=>team.riders);
  const passes=clock?.markerPasses;
  const isolated=line?.bandRunners?.filter(row=>
    row.roadBandId.startsWith('isolated:'))??[];
  const approachIds=new Set(approach.approaches.map(row=>row.riderId));
  if(clock?.version!==
      FINALE_COAST_MIXED_THREE_FRONT_STRADDLING_CANDIDATE_VERSION||
    line?.version!==
      FINALE_STRADDLING_MARKER_CANDIDATE_INDIVIDUAL_LINE_VERSION||
    line.sourceClockVersion!==clock.version||
    !Array.isArray(passes)||passes.length!==7||
    passes.filter(row=>row.markerDistanceM<finishM-500).length!==3||
    passes.filter(row=>row.markerDistanceM>finishM-500).length!==4||
    passes.some(row=>row.contactResolved!==false||
      !approachIds.has(row.riderId))||
    approachIds.size!==7||approach.stillSeparatedAtHandoff.length||
    line.conditionalCrossings.length!==roster.length||
    !line.bandRunners.some(row=>row.roadBandId==='road-2')||
    isolated.length!==new Set(isolated.map(row=>row.roadBandId)).size)
    throw new Error('The straddling outside lanes lack paid source riders.');
  const at500=clock.trace.frames.find(frame=>
    frame.endDistanceM===finishM-500);
  const energy500=new Map(at500?.riders.map(row=>[
    row.riderId,row.energy])??[]);
  const crossing=new Map(line.conditionalCrossings.map(row=>[
    row.riderId,row]));
  const finishers=line.bandRunners.flatMap(band=>
    band.runner.finishers.map(row=>({roadBandId:band.roadBandId,...row})));
  const finished=new Map(finishers.map(row=>[row.riderId,row]));
  if(energy500.size!==roster.length||crossing.size!==roster.length||
    finished.size!==roster.length||finishers.length!==roster.length||
    roster.some(rider=>!energy500.has(rider.id)||
      !crossing.has(rider.id)||!finished.has(rider.id))||
    line.conditionalCrossings.some(row=>{
      const paid=finished.get(row.riderId);
      return paid.roadBandId!==row.roadBandId||
        Math.abs(paid.elapsedSecondsFromLastKmStart-
          row.elapsedSecondsFromLastKmStart)>EPSILON||
        Math.abs(paid.energyAtLine-row.energyAtLine)>EPSILON;
    }))
    throw new Error('The straddling handoff lost a paid rider.');
  const laneAssignments=isolated.map((band,index)=>({
    roadBandId:band.roadBandId,
    riderId:band.roadBandId.slice('isolated:'.length),
    lane:line.positionedSource.laneCount+index,
    rule:'inferred_outside_lane_no_draft'}));
  if(!Number.isInteger(line.positionedSource.laneCount)||
    laneAssignments.some(row=>!Number.isInteger(row.lane)||
      row.lane<line.positionedSource.laneCount))
    throw new Error('The straddling lanes have no distinct inferred position.');
  const energyContinuity=approach.approaches.map(event=>{
    const values=[['isolated',event.riderId,
      event.isolatedEnergyAtApproach],
    ['active',event.activeRiderId,event.activeEnergyAtApproach]];
    return {riderId:event.riderId,
      riders:values.map(([role,riderId,energyAtApproach])=>
        energyThroughLine(role,riderId,energyAtApproach,
          event.paidSplit[role].frames,clock,line,energy500,crossing))};
  });
  const pairwisePasses=[];
  for(let a=0;a<line.bandRunners.length;a++)
    for(let b=a+1;b<line.bandRunners.length;b++){
      const first=line.bandRunners[a],second=line.bandRunners[b];
      const meeting=recordFinaleUnorderedBandOverlapAudit([
        first,second]).firstPotentialOverlap;
      if(!meeting)continue;
      const firstSolo=first.roadBandId.startsWith('isolated:');
      const secondSolo=second.roadBandId.startsWith('isolated:');
      const solo=firstSolo?first:second;
      const active=firstSolo?second:first;
      if(!firstSolo&&!secondSolo||firstSolo!==secondSolo&&
        (active.roadBandId!=='road-2'||
        !approachIds.has(solo.roadBandId.slice('isolated:'.length))))
        throw new Error('An unpaid straddling active-band encounter remains.');
      pairwisePasses.push({...meeting,
        rule:firstSolo&&secondSolo?
          'separate_isolated_outside_lanes':
          'former_leader_outside_road_2'});
    }
  const pre500OtherActive=auditOtherActivePre500(tour,clock,approach);
  if(pre500OtherActive.encounters.some(row=>
    row.activeRoadBandId!=='road-1'))
    throw new Error('An unpaid pre-500 active-band encounter remains.');
  const freshSourceGroupEnergy=pre500OtherActive.encounters
    .filter(row=>row.laterFreshEncounter).map(row=>{
      const event=row.firstNewEncounter;
      if(!event)throw new Error('A fresh road-1 approach lacks paid split.');
      return {isolatedRiderId:row.isolatedRiderId,
        activeRiderId:row.activeRiderId,
        riders:[energyThroughLine('isolated',row.isolatedRiderId,
          event.isolatedEnergyAtApproach,
          event.paidSplit.isolated.frames,clock,line,energy500,crossing),
        energyThroughLine('active',row.activeRiderId,
          event.activeEnergyAtApproach,
          event.paidSplit.active.frames,clock,line,energy500,crossing)]};
    });
  return {version:FINALE_MIXED_STRADDLING_OUTSIDE_LANE_AUDIT_VERSION,
    sourceClockVersion:clock.version,sourceLineVersion:line.version,
    sourceApproachVersion:approach.version,
    laneAssignments,energyContinuity,post500PairwisePasses:pairwisePasses,
    pre500OtherActive,freshSourceGroupEnergy,
    approachCount:approach.approaches.length,
    pre500OtherBandsStatus:
      'former_road1_source_exit_contacts_unresolved',
    status:'inferred_outside_lanes_occupied_wheels_unresolved',
    contactResolved:false,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}

export function validateFinaleMixedStraddlingOutsideLaneAudit(tour,clock,
  line,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedStraddlingOutsideLaneAudit(tour,clock,line)))
    throw new Error('The straddling outside lanes do not replay.');
  return true;
}
