import {createPhysicalFirstRaceDocumentV2,
  sealPhysicalFirstRaceDocumentV2,
  verifyPhysicalFirstRaceDocumentV2,
  physicalRaceDocumentHash} from
  './physical-first-race-document-v2.mjs';

export const PHYSICAL_FIRST_RACE_DOCUMENT_V3_VERSION=
  'motor-lab-viewer-document-v3';

// V3 binds the committed input metadata to the paid race evidence. V2
// remains readable for historic recordings, with its original digest.
export function sealPhysicalFirstRaceDocumentV3(race,input){
  const checked=sealPhysicalFirstRaceDocumentV2({
    ...race,version:race.version??race.adapterVersion},input);
  const {feed,finishEvidence,coverage,source}=checked;
  const sha256=physicalRaceDocumentHash({input,feed,
    finishEvidence,coverage,source});
  return {...checked,
    schemaVersion:PHYSICAL_FIRST_RACE_DOCUMENT_V3_VERSION,
    sha256};
}

export function createPhysicalFirstRaceDocumentV3(category,options={}){
  const old=createPhysicalFirstRaceDocumentV2(category,options);
  return sealPhysicalFirstRaceDocumentV3(old,old.input);
}

export function verifyPhysicalFirstRaceDocumentV3(document){
  if(document?.schemaVersion!==
      PHYSICAL_FIRST_RACE_DOCUMENT_V3_VERSION||
    typeof document.sha256!=='string')
    throw new Error('Unknown physical race document.');
  const recalculated=sealPhysicalFirstRaceDocumentV3(document,
    document.input);
  if(recalculated.sha256!==document.sha256||
    recalculated.raceId!==document.raceId)
    throw new Error('Physical race document changed after recording.');
  return document;
}

export function verifyPhysicalFirstRaceDocument(document){
  if(document?.schemaVersion===
      PHYSICAL_FIRST_RACE_DOCUMENT_V3_VERSION)
    return verifyPhysicalFirstRaceDocumentV3(document);
  return verifyPhysicalFirstRaceDocumentV2(document);
}
