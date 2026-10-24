import {isDeepStrictEqual} from 'node:util';
import {recordFinaleMixedStraddlingIndividualAudit} from
  './finale-mixed-straddling-individual-audit.mjs';
import {recordFinaleUnorderedBandOverlapAudit} from
  './finale-multiband-overlap-audit.mjs';
import {FINALE_COAST_MIXED_THREE_FRONT_STRADDLING_CANDIDATE_VERSION} from
  './finale-separated-last-km.mjs';
import {FINALE_STRADDLING_MARKER_CANDIDATE_INDIVIDUAL_LINE_VERSION} from
  './finale-depleted-individual-line.mjs';

export const FINALE_MIXED_STRADDLING_OUTSIDE_LANE_AUDIT_VERSION=
  'v2-finale-mixed-straddling-outside-lane-audit-1';
const EPSILON=1e-7;

function spent(frames,riderId){
  return frames.reduce((sum,frame)=>sum+
    (frame.riders.find(row=>row.riderId===riderId)?.energySpent??0),0);
}

// This internal audit pays the known source-wheel approaches and guards
// post-500 band meetings. Other pre-500 pairings still need an audit before
// this can become a user-facing conditional finish.
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
      riders:values.map(([role,riderId,energyAtApproach])=>{
        const before=event.paidSplit[role].frames;
        const total=spent(clock.trace.frames.slice(0,2),riderId);
        const spentToApproach=spent(before,riderId);
        const remaining=total-spentToApproach;
        const band=line.bandRunners.find(row=>
          row.runner.finishers.some(finisher=>
            finisher.riderId===riderId));
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
      })};
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
  return {version:FINALE_MIXED_STRADDLING_OUTSIDE_LANE_AUDIT_VERSION,
    sourceClockVersion:clock.version,sourceLineVersion:line.version,
    sourceApproachVersion:approach.version,
    laneAssignments,energyContinuity,post500PairwisePasses:pairwisePasses,
    approachCount:approach.approaches.length,
    pre500OtherBandsStatus:'not_audited_no_result',
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
