// Compare newly detached paid roads with existing rear roads and the
// bunch. This only locates the first meeting; all roads after it need
// physical repricing before a complete field kilometre can exist.
import {isDeepStrictEqual} from 'node:util';
import {completePhysicalOrderedRearLossesKmV1} from
  './physical-pace-loss-completion-v1.mjs';
import {pricePhysicalRearSoloTrackV1,
  pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {staggeredSoloTrajectoryV1} from
  './physical-staggered-solo-field-contact-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';

export const PHYSICAL_ORDERED_REAR_LOSS_BOUNDARY_VERSION=
  'v2-physical-ordered-rear-loss-boundary-1';

export function sourcePhysicalOrderedRearLossBoundaryV1({
  startInput,prior}){
  const losses=completePhysicalOrderedRearLossesKmV1({
    startInput,prior});
  const {next}=losses.sources;
  const km=losses.sourceKm;
  const existing=prior.endRearEntities.map(entity=>{
    const source={startInput,km,
      energyByRider:entity.energyByRider,
      startClock:entity.clock,groupId:entity.id};
    const track=entity.kind==='solo'?
      pricePhysicalRearSoloTrackV1({...source,
        riderId:entity.riderIds[0],
        energyBefore:entity.energyByRider[
          entity.riderIds[0]]}):
      pricePhysicalRearEventTrackV1({...source,
        riderIds:entity.riderIds,
        rotationIndex:entity.rotationIndex,
        startM:0});
    return {...track,id:entity.id,
      kind:entity.kind,domainEndM:1000};
  });
  const fresh=losses.completions.map(completion=>{
    const track=staggeredSoloTrajectoryV1({
      lossKm:km,riderId:completion.riderId,
      completion},km,next.bunchStartClock,
    next.step);
    return {...track,id:`solo-${completion.riderId}`,
      kind:'solo',riderIds:[completion.riderId],
      domainStartM:0,domainEndM:1000};
  });
  const tracks=[...existing,...fresh];
  if(new Set(tracks.map(track=>track.id)).size!==
      tracks.length||
    new Set(tracks.flatMap(track=>track.riderIds))
      .size!==tracks.reduce((sum,track)=>
        sum+track.riderIds.length,0))
    throw new Error('Loss boundary duplicates paid road.');
  const bunch={id:'peloton',riderId:'peloton',
    riderIds:[],domainStartM:0,domainEndM:1000,
    breaks:[],clockAt:metres=>
      next.bunchStartClock+
      next.step.elapsedSeconds*metres/1000};
  const events=findPhysicalOrderedBoundaryEventsV1(
    tracks,bunch,km);
  const recording={version:
    PHYSICAL_ORDERED_REAR_LOSS_BOUNDARY_VERSION,
  sourceKm:km,lossVersion:losses.version,
  priorRearRoads:existing.length,
  newSoloRoads:fresh.length,
  bunchEndClock:losses.bunchEndClock,
  firstEvent:events[0]??null,
  candidateEventCount:events.length,
  eventChangesMembership:false,
  fullKilometreUnsettled:true,
  movesGuidedRace:false,officialResults:false};
  return {recording,losses,tracks,bunch};
}

export function inspectPhysicalOrderedRearLossBoundaryV1(
  input){
  return sourcePhysicalOrderedRearLossBoundaryV1(input)
    .recording;
}

export function validatePhysicalOrderedRearLossBoundaryV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    inspectPhysicalOrderedRearLossBoundaryV1(input)))
    throw new Error('Loss boundary differs from paid source.');
  return true;
}
