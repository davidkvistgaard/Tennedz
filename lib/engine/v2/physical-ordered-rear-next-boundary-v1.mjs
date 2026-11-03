// Compare the next paid rear roads with each other and the sourced
// bunch. A crossing is a candidate until its physical choice is paid.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalOrderedRearNextBunchKmV1} from
  './physical-ordered-rear-next-bunch-v1.mjs';
import {pricePhysicalRearSoloTrackV1,
  pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';

export const PHYSICAL_ORDERED_REAR_NEXT_BOUNDARY_VERSION=
  'v2-physical-ordered-rear-next-boundary-1';

export function sourcePhysicalOrderedRearNextBoundaryV1(
  input){
  const next=replayPhysicalOrderedRearNextBunchKmV1(
    input);
  const {startInput}=input;
  const km=next.sourceKm;
  if(next.step.splits.length||
    next.step.attack)
    throw new Error(
      'Next rear boundary needs separately paid new split.');
  const tracks=next.sources.prior.endRearEntities
    .map(entity=>{
      const source={startInput,
        energyByRider:entity.energyByRider,
        km,startClock:entity.clock,
        groupId:entity.id};
      return entity.kind==='solo'?
        pricePhysicalRearSoloTrackV1({
          ...source,
          riderId:entity.riderIds[0],
          energyBefore:entity.energyByRider[
            entity.riderIds[0]]}):
        pricePhysicalRearEventTrackV1({
          ...source,
          riderIds:entity.riderIds,
          rotationIndex:entity.rotationIndex,
          startM:0});
    }).map(track=>({...track,id:track.groupId,
      kind:track.riderIds.length===1?
        'solo':'group',domainEndM:1000}));
  const bunch={id:'peloton',
    riderId:'peloton',riderIds:[],
    domainStartM:0,domainEndM:1000,
    breaks:[],
    clockAt:metres=>next.bunchStartClock+
      next.step.elapsedSeconds*metres/1000};
  const events=findPhysicalOrderedBoundaryEventsV1(
    tracks,bunch,km);
  const recording={version:
    PHYSICAL_ORDERED_REAR_NEXT_BOUNDARY_VERSION,
  sourceKm:km,
  sourceVersion:next.version,
  rearRoads:tracks.map(track=>({
    id:track.id,kind:track.kind,
    riderIds:[...track.riderIds],
    startClock:track.startClock,
    endClock:track.endClock,
    leaderRiderId:track.leaderRiderId,
    riders:track.rows.map(row=>({
      riderId:row.riderId,role:row.role,
      decision:row.decision,
      energyBefore:row.energyBefore,
      energySpent:row.energySpent,
      draftFraction:row.draftFraction,
      energyAfter:row.energyAfter}))})),
  bunchStartClock:next.bunchStartClock,
  bunchEndClock:next.bunchStartClock+
    next.step.elapsedSeconds,
  firstEvent:events[0]??null,
  candidateEventCount:events.length,
  eventChangesMembership:false,
  fullKilometreUnsettled:events.length>0,
  movesGuidedRace:false,
  officialResults:false};
  return {recording,tracks,bunch,next};
}

export function inspectPhysicalOrderedRearNextBoundaryV1(
  input){
  return sourcePhysicalOrderedRearNextBoundaryV1(
    input).recording;
}

export function validatePhysicalOrderedRearNextBoundaryV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    inspectPhysicalOrderedRearNextBoundaryV1(input)))
    throw new Error(
      'Next rear boundary differs from paid source.');
  return true;
}
