import {createHash} from 'node:crypto';
import {validateFeed} from '@pelotonia/race-viewer/data';
import {createPhysicalFirstSplitViewerTestRaceV1} from
  './physical-first-split-test-race-v1.mjs';
import {parsePhysicalSplitVariantV1} from
  './physical-first-split-variant-v1.mjs';

export const PHYSICAL_FIRST_RACE_DOCUMENT_VERSION=
  'motor-lab-viewer-document-v2';

const canonical=value=>Array.isArray(value)?value.map(canonical):
  value&&typeof value==='object'?
    Object.fromEntries(Object.keys(value).sort().map(key=>
      [key,canonical(value[key])])):value;
export const physicalRaceDocumentHash=payload=>createHash('sha256').update(
  JSON.stringify(canonical(JSON.parse(JSON.stringify(payload)))))
  .digest('hex');

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
  if(finishEvidence.version==='motor-lab-paid-finish-v2'){
    const groups=finishEvidence.clockGroups;
    const entries=finishEvidence.entries;
    if(!Array.isArray(groups)||!groups.length||
      groups.some((group,index)=>
        !group||!Number.isFinite(group.clockSeconds)||
        !Array.isArray(group.riderIds)||!group.riderIds.length||
        (index>0&&group.clockSeconds<=groups[index-1].clockSeconds)))
      throw new Error('Motor Lab viewer document has invalid finish clock groups.');
    const grouped=groups.flatMap(group=>group.riderIds.map(riderId=>
      ({riderId,clockSeconds:group.clockSeconds})));
    const unresolved=groups.reduce((count,group)=>
      count+(group.riderIds.length>1?group.riderIds.length:0),0);
    const feedIds=new Set(feed.riders.map(rider=>rider.id));
    if(new Set(entries.map(row=>row.riderId)).size!==feedIds.size||
      entries.some(row=>!feedIds.has(row.riderId)||
        !Number.isFinite(row.clockSeconds)||
        row.clockSeconds<=0||
        row.clockSeconds>finishEvidence.publishedAt||
        typeof row.roadId!=='string'||!row.roadId)||
      grouped.length!==entries.length||
      grouped.some((row,index)=>
        row.riderId!==entries[index].riderId||
        row.clockSeconds!==entries[index].clockSeconds)||
      unresolved!==finishEvidence.unresolvedTieRiders)
      throw new Error('Motor Lab viewer document has invalid finish clock groups.');
  }
  const payload={feed,finishEvidence,coverage,source};
  const sha256=physicalRaceDocumentHash(payload);
  return {schemaVersion:PHYSICAL_FIRST_RACE_DOCUMENT_VERSION,
    adapterVersion:version,
    raceId:feed.raceId,
    input,
    sha256,
    ...payload};
}

export function verifyPhysicalFirstRaceDocumentV2(document){
  if(document?.schemaVersion!==PHYSICAL_FIRST_RACE_DOCUMENT_VERSION||
    typeof document.sha256!=='string')
    throw new Error('Unknown physical race document.');
  const recalculated=sealPhysicalFirstRaceDocumentV2({
    feed:document.feed,finishEvidence:document.finishEvidence,
    coverage:document.coverage,source:document.source,
    version:document.adapterVersion},document.input);
  if(recalculated.sha256!==document.sha256||
    recalculated.raceId!==document.raceId)
    throw new Error('Physical race document changed after recording.');
  return document;
}
