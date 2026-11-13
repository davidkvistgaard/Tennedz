import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentNextBoundaryFromTour} from
  './finale-concurrent-next-boundary.mjs';
import {recordFinaleConcurrentNextSlicePlanFromTour} from
  './finale-concurrent-next-slice-plan.mjs';
import {recordFinaleConcurrentBunch500ArrivalFromTour} from
  './finale-concurrent-bunch-500-arrival.mjs';
import {recordFinaleConcurrentRearCatchFollowupFromTour} from
  './finale-concurrent-rear-catch-followup.mjs';
import {recordFinaleConcurrentRearBunchArrivalFromTour} from
  './finale-concurrent-rear-bunch-arrival.mjs';
import {recordFinaleConcurrentDoubleCatchMergeFromTour} from
  './finale-concurrent-double-catch-merge.mjs';

export const FINALE_CONCURRENT_SELECTIVE_500_STATE_VERSION=
  'v2-finale-concurrent-selective-500-state-1';

// Normalize only branches whose whole field has paid to the same 500 m
// boundary. An earlier attacker-attacker meeting cannot enter this handoff:
// its later road and work decisions have not yet been established.
export function recordFinaleConcurrentSelective500StateFromTour(tour){
  const next=recordFinaleConcurrentNextBoundaryFromTour(tour);
  const plan=recordFinaleConcurrentNextSlicePlanFromTour(tour);
  let branch;
  let source;
  if(next.event==='first_attacker_at_next_boundary'){
    branch='two_split';
    source=recordFinaleConcurrentBunch500ArrivalFromTour(tour);
    if(source.event!=='bunch_at_500_boundary')
      throw new Error('Two-split branch has not paid the whole field to 500 m.');
  }else if(next.event===
    'second_attacker_bunch_contact_uncontinued'){
    const rear=recordFinaleConcurrentRearCatchFollowupFromTour(tour);
    if(rear.event==='front_at_next_boundary'){
      branch='solo_ahead';
      source=recordFinaleConcurrentRearBunchArrivalFromTour(tour);
      if(source.event!=='bunch_at_second_slice_boundary')
        throw new Error('Rear-catch branch has not paid the bunch to 500 m.');
    }else if(rear.event==='front_bunch_contact_uncontinued'){
      branch='both_caught';
      source=recordFinaleConcurrentDoubleCatchMergeFromTour(tour);
      if(source.event!=='bunch_at_next_boundary')
        throw new Error('Double-catch branch has not paid the bunch to 500 m.');
    }else throw new Error('Rear-catch branch has no supported 500 m handoff.');
  }else throw new Error('Selective 500 m handoff needs a paid supported branch.');
  const energyAtBoundary=row=>row.energyAtEvent??row.energyAtBoundary;
  const riders=source.riders.map(row=>({
    riderId:row.riderId,role:row.role,
    positionM:row.positionM,energyAtBoundary:energyAtBoundary(row)}));
  const expectedIds=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  const actualIds=riders.map(row=>row.riderId);
  const bands=source.roadBands;
  const bunch=bands.at(-1);
  if(!Number.isFinite(source.elapsedSinceLaunchSeconds)||
    !(source.elapsedSinceLaunchSeconds>next.elapsedSinceLaunchSeconds)||
    !Array.isArray(bands)||bands.length!==
      (branch==='two_split'?3:branch==='solo_ahead'?2:1)||
    bunch.kind!=='bunch'||
    Math.abs(bunch.positionM-plan.endDistanceM)>1e-8||
    actualIds.length!==expectedIds.length||
    new Set(actualIds).size!==actualIds.length||
    expectedIds.some(id=>!actualIds.includes(id))||
    bands.flatMap(band=>band.riderIds).length!==riders.length||
    new Set(bands.flatMap(band=>band.riderIds)).size!==riders.length||
    bands.some(band=>band.riderIds.some(id=>{
      const row=riders.find(rider=>rider.riderId===id);
      return !row||Math.abs(row.positionM-band.positionM)>1e-8;
    }))||
    riders.some(row=>!Number.isFinite(row.positionM)||
      !Number.isFinite(row.energyAtBoundary)||row.energyAtBoundary<0)||
    !isDeepStrictEqual(source.riderAttackLoad,next.riderAttackLoad))
    throw new Error('Selective 500 m handoff lost paid riders or road bands.');
  return {version:FINALE_CONCURRENT_SELECTIVE_500_STATE_VERSION,
    sourceEventVersion:next.version,sourceBranchVersion:source.version,
    sourcePlanVersion:plan.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,branch,
    boundaryM:plan.endDistanceM,
    elapsedSinceLaunchSeconds:source.elapsedSinceLaunchSeconds,
    frontRiderId:next.firstRiderId,
    rearRiderId:next.secondRiderId,
    roadBands:bands,riders,
    riderAttackLoad:source.riderAttackLoad,
    draftStatus:'unresolved',resultStatus:'unclassified',
    pointsStatus:'withheld'};
}

export function validateFinaleConcurrentSelective500StateFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentSelective500StateFromTour(tour)))
    throw new Error('Concurrent selective 500 m handoff does not replay.');
  return true;
}
