import {verifyPhysicalFirstRaceDocumentV2} from
  './physical-first-race-document-v2.mjs';
import {scenicPresentationV1} from
  './scenic-presentation-v1.mjs';
import {validateFeed} from '@pelotonia/race-viewer/data';

export const PHYSICAL_SPECTATOR_PROJECTION_VERSION=
  'physical-spectator-projection-v1';

function verifiedForEvent(document,eventId){
  const saved=verifyPhysicalFirstRaceDocumentV2(document);
  if(saved.input?.eventId!==eventId||
    saved.input?.officialResults!==false||
    saved.coverage?.officialResults!==false)
    throw new Error('Physical viewer recording does not match this event.');
  return saved;
}

// Only these display fields cross the server/client boundary. The immutable
// input snapshot, committed orders, race seed, source ledger and future events
// remain on the server. Scenery is explicitly synthetic presentation data.
export function physicalSpectatorFeedV1(document,eventId,elapsed){
  const saved=verifiedForEvent(document,eventId);
  if(!Number.isFinite(elapsed)||elapsed<0||
    elapsed>saved.feed.duration)
    throw new Error('Spectator feed needs the shared race time.');
  const frames=saved.feed.frames.filter(frame=>
    frame.time<=elapsed);
  if(!frames.length||frames[0].time!==0)
    throw new Error('Spectator feed lacks the starting frame.');
  if(frames.at(-1).time<saved.feed.duration)
    frames.push({time:saved.feed.duration,positions:[]});
  const feed=scenicPresentationV1({...saved.feed,frames,events:[],
    streaming:true});
  validateFeed(feed);
  return {version:PHYSICAL_SPECTATOR_PROJECTION_VERSION,
    raceId:saved.raceId,sha256:saved.sha256,
    adapterVersion:saved.adapterVersion,
    coverage:saved.coverage,
    feed,availableThrough:frames.at(-1).positions.length?
      frames.at(-1).time:frames.at(-2).time};
}

// Incremental updates contain only checkpoint frames already reached by
// the one shared server clock. Empty future placeholders never cross here.
export function physicalSpectatorFramesV1(document,eventId,
  elapsed,afterTime){
  const saved=verifiedForEvent(document,eventId);
  if(!Number.isFinite(elapsed)||elapsed<0||
    elapsed>saved.feed.duration||
    !Number.isFinite(afterTime)||afterTime<0||
    afterTime>saved.feed.duration)
    throw new Error('Spectator frames need valid race times.');
  const frames=saved.feed.frames.filter(frame=>
    frame.time>afterTime&&frame.time<=elapsed);
  return {version:PHYSICAL_SPECTATOR_PROJECTION_VERSION,
    raceId:saved.raceId,sha256:saved.sha256,
    frames,availableThrough:frames.at(-1)?.time??afterTime};
}

// Called only after the shared server clock has reached the measured finish.
// No official placing, points or awards are inferred from equal clocks.
export function physicalSpectatorFinishV1(document,eventId,broadcast){
  const saved=verifiedForEvent(document,eventId);
  if(broadcast?.raceId!==saved.raceId||
    !broadcast.recordingPublished||!broadcast.finishPublished)
    throw new Error('Physical finish has not been published.');
  return {version:PHYSICAL_SPECTATOR_PROJECTION_VERSION,
    raceId:saved.raceId,sha256:saved.sha256,
    finishEvidence:saved.finishEvidence};
}
