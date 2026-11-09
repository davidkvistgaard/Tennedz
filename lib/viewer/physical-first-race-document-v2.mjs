import {createHash} from 'node:crypto';
import {validateFeed} from '@pelotonia/race-viewer/data';
import {createPhysicalFirstSplitViewerTestRaceV1} from
  './physical-first-split-test-race-v1.mjs';
import {parsePhysicalSplitVariantV1} from
  './physical-first-split-variant-v1.mjs';

export const PHYSICAL_FIRST_RACE_DOCUMENT_VERSION=
  'motor-lab-viewer-document-v2';

// This document is the transport boundary. The feed stays a direct export
// of paid motor evidence; the scenic layer belongs to presentation only.
export function createPhysicalFirstRaceDocumentV2(category,options={}){
  const variant=parsePhysicalSplitVariantV1(options);
  const race=createPhysicalFirstSplitViewerTestRaceV1(category,variant);
  return sealPhysicalFirstRaceDocumentV2(race,
    {category,...variant});
}

export function sealPhysicalFirstRaceDocumentV2(race,input){
  const {feed,finishEvidence,coverage,version,source}=race;
  validateFeed(feed);
  const distanceKm=feed.route.profile.samples.at(-1)[0]/1000;
  if(feed.results!==undefined||
    !Number.isInteger(distanceKm)||distanceKm<1||
    input?.category!==feed.riderCategory||
    !source?.raceSeed||
    !/^[a-f0-9]{64}$/.test(source.commitmentHash)||
    source.validatedKm!==distanceKm||
    source.validatedRiderKilometres!==
      feed.riders.length*distanceKm||
    finishEvidence?.publishedAt!==feed.duration||
    finishEvidence?.entries?.length!==feed.riders.length||
    coverage?.paidRiderKilometres!==
      feed.riders.length*distanceKm)
    throw new Error('Motor Lab viewer document lacks paid race evidence.');
  const payload={feed,finishEvidence,coverage,source};
  const sha256=createHash('sha256').update(JSON.stringify(payload))
    .digest('hex');
  return {schemaVersion:PHYSICAL_FIRST_RACE_DOCUMENT_VERSION,
    adapterVersion:version,
    raceId:feed.raceId,
    input,
    sha256,
    ...payload};
}
