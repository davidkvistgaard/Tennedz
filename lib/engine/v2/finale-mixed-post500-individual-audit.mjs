import {isDeepStrictEqual} from 'node:util';
import {FINALE_COAST_MIXED_THREE_FRONT_POST500_CANDIDATE_VERSION} from
  './finale-separated-last-km.mjs';
import {FINALE_POST500_MARKER_CANDIDATE_INDIVIDUAL_LINE_VERSION} from
  './finale-depleted-individual-line.mjs';
import {recordFinalePaidCrossBandOverlap,paidQueuedRiderAt,
  splitPaidQueuedBandAt} from
  './finale-late-active-wheel-contact.mjs';
import {recordFinaleUnorderedBandOverlapAudit} from
  './finale-multiband-overlap-audit.mjs';

export const FINALE_MIXED_POST500_INDIVIDUAL_AUDIT_VERSION=
  'v2-finale-mixed-post500-individual-contact-audit-1';
export const FINALE_MIXED_POST500_OUTSIDE_LANE_AUDIT_VERSION=
  'v2-finale-mixed-post500-outside-lane-audit-1';
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

function paidEnergyToLine(band,riderId,beforeFrames,energyAtApproach){
  const spent=frames=>frames.reduce((sum,frame)=>sum+
    (frame.riders.find(row=>row.riderId===riderId)?.energySpent??0),0);
  const finisher=band.runner.finishers.find(row=>
    row.riderId===riderId);
  if(!finisher)throw new Error('An approached rider has no paid line.');
  const spentAfterApproach=spent(band.runner.frames)-
    spent(beforeFrames);
  if(spentAfterApproach<-EPSILON||
    Math.abs(energyAtApproach-spentAfterApproach-
      finisher.energyAtLine)>EPSILON)
    throw new Error('An approached rider loses paid finish energy.');
  return {riderId,energyAtApproach,spentAfterApproach,
    energyAtLine:finisher.energyAtLine};
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

// Every isolated rider retains its independently paid trajectory in a
// distinct outside lane. Only the audited former leaders may pass road-2;
// any other active-band meeting remains an unsupported geometry. This does
// not infer a drafting benefit, change energy, or certify occupied wheels.
export function recordFinaleMixedPost500OutsideLaneAudit(tour,clock,line){
  const approach=recordFinaleMixedPost500IndividualAudit(tour,clock,line);
  const allowed=new Set(approach.encounters.map(row=>
    `isolated:${row.isolatedRiderId}`));
  const isolated=line.bandRunners.filter(row=>
    row.roadBandId.startsWith('isolated:'));
  const laneStart=line.positionedSource.laneCount;
  if(!Number.isInteger(laneStart)||laneStart<1||
    isolated.length!==new Set(isolated.map(row=>row.roadBandId)).size)
    throw new Error('The post-500 outside lanes lack distinct paid riders.');
  const laneAssignments=isolated.map((row,index)=>({
    roadBandId:row.roadBandId,
    riderId:row.roadBandId.slice('isolated:'.length),
    lane:laneStart+index,
    rule:'inferred_outside_lane_no_draft'}));
  const pairwisePasses=[];
  for(let a=0;a<line.bandRunners.length;a++)
    for(let b=a+1;b<line.bandRunners.length;b++){
      const first=line.bandRunners[a],second=line.bandRunners[b];
      const meeting=recordFinaleUnorderedBandOverlapAudit([
        first,second]).firstPotentialOverlap;
      if(!meeting)continue;
      const firstIsolated=first.roadBandId.startsWith('isolated:');
      const secondIsolated=second.roadBandId.startsWith('isolated:');
      if(!firstIsolated&&!secondIsolated||
        firstIsolated!==secondIsolated&&
          (firstIsolated?second.roadBandId:first.roadBandId)!=='road-2'||
        firstIsolated!==secondIsolated&&
          !allowed.has(firstIsolated?first.roadBandId:second.roadBandId))
        throw new Error('An unpaid active-band encounter remains.');
      pairwisePasses.push({...meeting,
        rule:firstIsolated&&secondIsolated?
          'separate_isolated_outside_lanes':
          'former_leader_outside_road_2'});
    }
  for(const roadBandId of allowed)
    if(!pairwisePasses.some(row=>
      row.rule==='former_leader_outside_road_2'&&
      (row.firstRoadBandId===roadBandId||
        row.secondRoadBandId===roadBandId)))
      throw new Error('A former leader has no paid road-2 passage.');
  return {version:FINALE_MIXED_POST500_OUTSIDE_LANE_AUDIT_VERSION,
    sourceAuditVersion:approach.version,
    sourceLineVersion:line.version,
    laneAssignments,pairwisePasses,
    encounters:approach.encounters.map(row=>{
      const solo=line.bandRunners.find(band=>band.roadBandId===
        `isolated:${row.isolatedRiderId}`);
      const road2=line.bandRunners.find(band=>
        band.roadBandId==='road-2');
      return {...row,
        lane:laneAssignments.find(lane=>
          lane.riderId===row.isolatedRiderId).lane,
        laneRule:'inferred_outside_lane_no_draft',
        paidContinuation:{
          isolated:paidEnergyToLine(solo,row.isolatedRiderId,
            row.paidSplit.isolated.frames,
            row.isolatedEnergyAtApproach),
          active:paidEnergyToLine(road2,row.activeRiderId,
            row.paidSplit.active.frames,row.activeEnergyAtApproach)},
        contactResolved:false};
    }),
    status:'inferred_outside_lanes_occupied_wheels_unresolved',
    contactResolved:false,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}

export function validateFinaleMixedPost500OutsideLaneAudit(tour,clock,
  line,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedPost500OutsideLaneAudit(tour,clock,line)))
    throw new Error('The post-500 outside lanes do not replay.');
  return true;
}
