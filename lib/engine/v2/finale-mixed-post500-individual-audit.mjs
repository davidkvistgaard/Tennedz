import {isDeepStrictEqual} from 'node:util';
import {FINALE_COAST_MIXED_THREE_FRONT_POST500_CANDIDATE_VERSION} from
  './finale-separated-last-km.mjs';
import {FINALE_POST500_MARKER_CANDIDATE_INDIVIDUAL_LINE_VERSION} from
  './finale-depleted-individual-line.mjs';
import {recordFinalePaidCrossBandOverlap,paidQueuedRiderAt,
  splitPaidQueuedBandAt} from
  './finale-late-active-wheel-contact.mjs';

export const FINALE_MIXED_POST500_INDIVIDUAL_AUDIT_VERSION=
  'v2-finale-mixed-post500-individual-contact-audit-1';
const EPSILON=1e-7;

function singleRider(band,riderId,shiftM=0){
  return {roadBandId:band.roadBandId,runner:{frames:
    band.runner.frames.map(frame=>({...frame,riders:frame.riders
      .filter(row=>row.riderId===riderId).map(row=>({...row,
        positionBeforeM:row.positionBeforeM+shiftM,
        positionM:row.positionM+shiftM,
        ...(row.motionSegments?{motionSegments:row.motionSegments.map(
          part=>({...part,startPositionM:part.startPositionM+shiftM,
            endPositionM:part.endPositionM+shiftM}))}:{})}))}))}};
}

// This audit begins with independently paid 500 m runners. It locates the
// first possible wheel spacing for each former leader and splits both paid
// riders at that instant. Lane occupation and post-contact response remain
// unresolved; this is evidence for a later continuation, not a finish.
export function recordFinaleMixedPost500IndividualAudit(tour,clock,line){
  const finishM=tour.route.distanceKm*1000;
  const spacing=line?.positionedSource?.wheelSpacingM;
  const road2=line?.bandRunners?.find(row=>row.roadBandId==='road-2');
  const passes=clock?.markerPasses;
  if(clock?.version!==
      FINALE_COAST_MIXED_THREE_FRONT_POST500_CANDIDATE_VERSION||
    line?.version!==
      FINALE_POST500_MARKER_CANDIDATE_INDIVIDUAL_LINE_VERSION||
    !Array.isArray(passes)||!passes.length||!road2||
    !Number.isFinite(spacing)||spacing<=0||
    line.conditionalCrossings.length!==
      tour.committedInputs.teams.reduce((sum,team)=>
        sum+team.riders.length,0))
    throw new Error('The post-500 audit needs a complete candidate line.');
  const encounters=passes.map(pass=>{
    const solo=line.bandRunners.find(row=>
      row.roadBandId===`isolated:${pass.riderId}`);
    if(!solo||pass.groupId!=='road-2'||
      pass.markerDistanceM<=finishM-500||
      pass.contactResolved!==false)
      throw new Error('A marker candidate has no isolated paid rider.');
    const commonStart=Math.max(
      solo.runner.frames[0].elapsedSecondsAtStart,
      road2.runner.frames[0].elapsedSecondsAtStart);
    const soloAtStart=paidQueuedRiderAt(solo,pass.riderId,
      commonStart);
    if(road2.runner.frames[0].riders.some(row=>
      soloAtStart.positionM-paidQueuedRiderAt(road2,row.riderId,
        commonStart).positionM<=spacing+EPSILON))
      throw new Error('The individual approach has overlapping source wheels.');
    const shifted=singleRider(solo,pass.riderId,-spacing);
    const contact=recordFinalePaidCrossBandOverlap(shifted,road2);
    if(!contact||contact.firstRiderId!==pass.riderId||
      contact.elapsedSecondsFromLastKmStart<=commonStart+EPSILON||
      contact.distanceM<=finishM-500||
      contact.distanceM>=finishM)
      throw new Error('A marker candidate has no post-500 individual approach.');
    const time=contact.elapsedSecondsFromLastKmStart;
    const soloAt=paidQueuedRiderAt(solo,pass.riderId,time);
    const activeAt=paidQueuedRiderAt(road2,contact.secondRiderId,time);
    if(Math.abs(soloAt.positionM-activeAt.positionM-spacing)>EPSILON)
      throw new Error('The individual approach lacks paid wheel spacing.');
    const soloBefore=splitPaidQueuedBandAt(
      singleRider(solo,pass.riderId),time,soloAt.positionM);
    const activeBefore=splitPaidQueuedBandAt(
      singleRider(road2,contact.secondRiderId),time,
      activeAt.positionM);
    const soloLast=soloBefore.frames.at(-1).riders[0];
    const activeLast=activeBefore.frames.at(-1).riders[0];
    if(Math.abs(soloLast.energyAfter-soloAt.energy)>EPSILON||
      Math.abs(activeLast.energyAfter-activeAt.energy)>EPSILON)
      throw new Error('The individual approach lost paid energy.');
    return {isolatedRiderId:pass.riderId,
      activeRiderId:contact.secondRiderId,
      elapsedSecondsFromLastKmStart:time,
      isolatedWheelM:soloAt.positionM,
      activeWheelM:activeAt.positionM,
      isolatedEnergyAtApproach:soloAt.energy,
      activeEnergyAtApproach:activeAt.energy,
      markerDistanceM:pass.markerDistanceM,
      paidSplit:{isolated:{riderId:pass.riderId,
        frames:soloBefore.frames,energyAtApproach:soloAt.energy},
      active:{riderId:contact.secondRiderId,
        frames:activeBefore.frames,energyAtApproach:activeAt.energy}},
      contactResolved:false};
  });
  encounters.sort((a,b)=>a.elapsedSecondsFromLastKmStart-
    b.elapsedSecondsFromLastKmStart||
    a.isolatedRiderId.localeCompare(b.isolatedRiderId));
  return {version:FINALE_MIXED_POST500_INDIVIDUAL_AUDIT_VERSION,
    sourceClockVersion:clock.version,sourceLineVersion:line.version,
    firstPossibleApproach:encounters[0],encounters,
    status:'paid_individual_approach_wheel_order_unresolved',
    contactResolved:false,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}

export function validateFinaleMixedPost500IndividualAudit(tour,clock,line,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedPost500IndividualAudit(tour,clock,line)))
    throw new Error('The mixed post-500 individual audit does not replay.');
  return true;
}
