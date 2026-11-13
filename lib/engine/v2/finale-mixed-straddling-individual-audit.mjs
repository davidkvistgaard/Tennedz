import {isDeepStrictEqual} from 'node:util';
import {recordFinaleMixedStraddlingHandoffAudit} from
  './finale-mixed-straddling-handoff-audit.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION} from
  './finale-multi-run.mjs';
import {resolveFinaleMultibandPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {recordFinalePaidCrossBandOverlap,paidQueuedRiderAt,
  splitPaidQueuedBandAt} from './finale-late-active-wheel-contact.mjs';

export const FINALE_MIXED_STRADDLING_INDIVIDUAL_AUDIT_VERSION=
  'v2-finale-mixed-straddling-individual-approach-audit-1';
const EPSILON=1e-7;

function frameForRider(frame,riderId,positionOffsetM,startSeconds,
  durationSeconds){
  const paid=frame.riders.find(row=>row.riderId===riderId);
  const before=paid?.energyBefore??paid?.energy+paid?.energySpent;
  const after=paid?.energyAfter??paid?.energy;
  if(!paid||![before,after,paid.energySpent,startSeconds,
    durationSeconds].every(Number.isFinite)||
    durationSeconds<=0||Math.abs(before-paid.energySpent-after)>EPSILON)
    throw new Error('An inferred pre-500 wheel lacks paid energy.');
  const metres=frame.endDistanceM-frame.startDistanceM;
  return {startDistanceM:frame.startDistanceM,
    endDistanceM:frame.endDistanceM,
    elapsedSecondsAtStart:startSeconds,durationSeconds,
    riders:[{riderId,positionBeforeM:frame.startDistanceM-
      positionOffsetM,positionM:frame.endDistanceM-positionOffsetM,
      activeSeconds:durationSeconds,activeDistanceM:metres,
      shelteredSeconds:0,shelteredDistanceM:0,
      energyAtDecision:before,energySpent:paid.energySpent,
      energyAfter:after}]};
}

// Project source wheel offsets through the two paid 250 m passages. This
// finds first possible longitudinal spacing, including an in-slice energy
// split; lane occupation and the response after approach are still unknown.
export function recordFinaleMixedStraddlingIndividualAudit(tour){
  const handoff=recordFinaleMixedStraddlingHandoffAudit(tour);
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION});
  const positioned=resolveFinaleMultibandPositionedSource(tour,{
    includeDropped:true});
  const first=positioned.roadBands[0],road2=positioned.roadBands[1];
  const pre500=trace.frames.filter(frame=>
    frame.endDistanceM<=handoff.handoffDistanceM);
  if(pre500.length!==2||first?.id!=='road-1'||
    road2?.id!=='road-2'||
    pre500[1].endDistanceM!==handoff.handoffDistanceM)
    throw new Error('The straddling wheel audit lacks two paid halves.');
  const leavers=[...handoff.beforeHandoff,...handoff.afterHandoff];
  let bunchStart=0;
  const clocks=pre500.map(frame=>{
    const result={frame,bunchStart};
    bunchStart+=frame.bunchElapsedSeconds;
    return result;
  });
  const approaches=[];
  for(const marker of leavers){
    const slot=first.slots.find(row=>row.riderId===marker.riderId);
    if(!slot)throw new Error('A former leader has no inferred source wheel.');
    const offset=positioned.startDistanceM-slot.positionM;
    const solo={roadBandId:`isolated:${marker.riderId}`,runner:{
      frames:clocks.map(({frame,bunchStart})=>{
        const travel=frame.droppedTravel.riders.find(row=>
          row.riderId===marker.riderId);
        if(!travel)throw new Error('A former leader lacks paid solo travel.');
        return frameForRider(frame,marker.riderId,offset,
          bunchStart+travel.deficitSecondsBefore,
          travel.elapsedSeconds);
      })}};
    let earliest=null;
    for(const active of road2.slots){
      const activeOffset=positioned.startDistanceM-active.positionM;
      const band={roadBandId:road2.id,runner:{frames:clocks.map(
        ({frame,bunchStart})=>{
          const group=frame.roadGroups.find(row=>row.id===road2.id);
          if(!group)throw new Error('The second front lacks paid travel.');
          const sourceOffset=group.sourceOffsetSeconds??
            -group.gapSeconds+frame.bunchElapsedSeconds-
              group.elapsedSeconds;
          return frameForRider(frame,active.riderId,activeOffset,
            bunchStart+sourceOffset,
            group.elapsedSeconds);
        })}};
      const shifted={...solo,runner:{frames:solo.runner.frames.map(
        frame=>({...frame,riders:frame.riders.map(row=>({...row,
          positionBeforeM:row.positionBeforeM-positioned.wheelSpacingM,
          positionM:row.positionM-positioned.wheelSpacingM}))}))}};
      const possible=recordFinalePaidCrossBandOverlap(shifted,band);
      if(!possible||
        earliest&&possible.elapsedSecondsFromLastKmStart>=
          earliest.elapsedSecondsFromLastKmStart-EPSILON)continue;
      const time=possible.elapsedSecondsFromLastKmStart;
      const isolated=paidQueuedRiderAt(solo,marker.riderId,time);
      const occupied=paidQueuedRiderAt(band,active.riderId,time);
      if(isolated.positionM>=handoff.handoffDistanceM-EPSILON||
        time<=Math.max(solo.runner.frames[0].elapsedSecondsAtStart,
          band.runner.frames[0].elapsedSecondsAtStart)+EPSILON)continue;
      if(Math.abs(isolated.positionM-occupied.positionM-
        positioned.wheelSpacingM)>EPSILON)
        throw new Error('The inferred wheel spacing lacks a paid instant.');
      earliest={riderId:marker.riderId,activeRiderId:active.riderId,
        elapsedSecondsFromLastKmStart:time,
        isolatedWheelM:isolated.positionM,
        activeWheelM:occupied.positionM,
        isolatedEnergyAtApproach:isolated.energy,
        activeEnergyAtApproach:occupied.energy,
        sourceLane:slot.lane,activeLane:active.lane,
        paidSplit:{isolated:splitPaidQueuedBandAt(solo,time,
          isolated.positionM),active:splitPaidQueuedBandAt(band,time,
          occupied.positionM)},
        contactResolved:false};
    }
    if(earliest)approaches.push(earliest);
  }
  approaches.sort((a,b)=>a.elapsedSecondsFromLastKmStart-
    b.elapsedSecondsFromLastKmStart||a.riderId.localeCompare(b.riderId));
  return {version:FINALE_MIXED_STRADDLING_INDIVIDUAL_AUDIT_VERSION,
    sourceHandoffAuditVersion:handoff.version,
    sourcePositionVersion:positioned.version,
    handoffDistanceM:handoff.handoffDistanceM,
    firstPossibleApproach:approaches[0]??null,approaches,
    stillSeparatedAtHandoff:leavers.filter(row=>
      !approaches.some(event=>event.riderId===row.riderId))
      .map(row=>row.riderId),
    status:'inferred_pre500_wheels_post_contact_unresolved',
    contactResolved:false,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}

export function validateFinaleMixedStraddlingIndividualAudit(tour,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedStraddlingIndividualAudit(tour)))
    throw new Error('The straddling individual audit does not replay.');
  return true;
}
