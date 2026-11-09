import {createHash} from 'node:crypto';
import {validateFeed} from '@pelotonia/race-viewer/data';
import {createPhysicalFirstSplitViewerTestRaceV1} from
  './physical-first-split-test-race-v1.mjs';
import {parsePhysicalSplitVariantV1} from
  './physical-first-split-variant-v1.mjs';

export const PHYSICAL_FIRST_RACE_DOCUMENT_VERSION=
  'motor-lab-viewer-document-v1';

// This document is the transport boundary. The feed stays a direct export
// of paid motor evidence; the scenic layer belongs to presentation only.
export function createPhysicalFirstRaceDocumentV1(category,options={}){
  const variant=parsePhysicalSplitVariantV1(options);
  const race=createPhysicalFirstSplitViewerTestRaceV1(category,variant);
  const {feed,finishEvidence,coverage,version}=race;
  validateFeed(feed);
  if(feed.results!==undefined||
    finishEvidence.publishedAt!==feed.duration||
    finishEvidence.entries.length!==feed.riders.length||
    coverage.paidRiderKilometres!==feed.riders.length*120)
    throw new Error('Motor Lab viewer document lacks paid race evidence.');
  const payload={feed,finishEvidence,coverage};
  const sha256=createHash('sha256').update(JSON.stringify(payload))
    .digest('hex');
  return {schemaVersion:PHYSICAL_FIRST_RACE_DOCUMENT_VERSION,
    adapterVersion:version,
    raceId:feed.raceId,
    input:{category,...variant},
    sha256,
    ...payload};
}
