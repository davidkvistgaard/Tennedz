import {verifyPhysicalFirstRaceDocumentV2} from
  './physical-first-race-document-v2.mjs';
import {scenicPresentationV1} from
  './scenic-presentation-v1.mjs';

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
export function physicalSpectatorFeedV1(document,eventId){
  const saved=verifiedForEvent(document,eventId);
  return {version:PHYSICAL_SPECTATOR_PROJECTION_VERSION,
    raceId:saved.raceId,sha256:saved.sha256,
    adapterVersion:saved.adapterVersion,
    coverage:saved.coverage,
    feed:scenicPresentationV1({...saved.feed,events:[]})};
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
