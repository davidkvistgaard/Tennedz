// Lossless storage codec for V7's repeated contact topology. The motor
// record is restored before replay; the viewer never reads this archive.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {gzipSync,gunzipSync} from 'node:zlib';
import {PHYSICAL_FIRST_POSITION_GENERAL_RACE_V7_VERSION} from
  '../engine/v2/physical-first-position-general-race-v1.mjs';
import {verifyGameSnapshotPositionRaceBundleV1} from
  './game-snapshot-position-viewer-v1.mjs';

export const GAME_SNAPSHOT_POSITION_ARCHIVE_V2_VERSION=
  'motor-lab-game-position-race-archive-v2';
export const GAME_SNAPSHOT_POSITION_ARCHIVE_V2_PACKING=
  'contact-topology-index-v1';
const MAX_JSON_BYTES=96*1024*1024;
const EVENT_KEYS=[
  'components','observedAfterPaidStepSeconds',
  'observedAtClockSeconds','sourceKm','type','version'];
const sha256=bytes=>createHash('sha256').update(bytes)
  .digest('hex');

function riderIdsFor(request){
  const ids=request?.input?.start?.riders?.map(row=>
    row.riderId);
  if(!Array.isArray(ids)||ids.length<1||
    ids.length>255||new Set(ids).size!==ids.length)
    throw new Error('Position archive lacks a bounded rider grid.');
  return ids;
}

function packEvent(event,step,byId){
  const groups=event?.components;
  if(!isDeepStrictEqual(Object.keys(event).sort(),
      EVENT_KEYS)||
    event.version!==step.sharedRoad.version||
    event.type!=='paid_contact_topology_observation'||
    event.sourceKm!==step.sourceKm||
    !Number.isFinite(event.observedAtClockSeconds)||
    !Number.isFinite(event.observedAfterPaidStepSeconds)||
    !Array.isArray(groups)||groups.length>255||
    groups.some(group=>!Array.isArray(group)||
      group.length>255||group.some(id=>!byId.has(id))))
    throw new Error('Position archive cannot pack contact topology.');
  const indexes=groups.flatMap(group=>
    group.map(id=>byId.get(id)));
  if(new Set(indexes).size!==indexes.length)
    throw new Error('Position archive contact repeats a rider.');
  const bytes=Buffer.from([groups.length,
    ...groups.map(group=>group.length),...indexes]);
  return [event.observedAtClockSeconds,
    event.observedAfterPaidStepSeconds,
    bytes.toString('base64')];
}

function unpackEvent(tuple,step,ids){
  if(!Array.isArray(tuple)||tuple.length!==3||
    !Number.isFinite(tuple[0])||
    !Number.isFinite(tuple[1])||
    typeof tuple[2]!=='string'||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      tuple[2]))
    throw new Error('Position archive contact tuple changed.');
  const bytes=Buffer.from(tuple[2],'base64');
  if(bytes.toString('base64')!==tuple[2]||
    !bytes.length)
    throw new Error('Position archive contact bytes changed.');
  const groupCount=bytes[0];
  const lengths=[...bytes.subarray(1,1+groupCount)];
  if(lengths.length!==groupCount||
    1+groupCount+lengths.reduce((a,b)=>a+b,0)!==
      bytes.length)
    throw new Error('Position archive contact groups changed.');
  let offset=1+groupCount;
  const indexes=[];
  const groups=lengths.map(length=>{
    const group=[];
    for(let index=0;index<length;index++){
      const riderIndex=bytes[offset++];
      if(riderIndex>=ids.length)
        throw new Error('Position archive contact rider changed.');
      indexes.push(riderIndex);
      group.push(ids[riderIndex]);
    }
    return group;
  });
  if(new Set(indexes).size!==indexes.length)
    throw new Error('Position archive contact repeats a rider.');
  return {version:step.sharedRoad.version,
    type:'paid_contact_topology_observation',
    sourceKm:step.sourceKm,
    observedAtClockSeconds:tuple[0],
    observedAfterPaidStepSeconds:tuple[1],
    components:groups};
}

function compactBundle(bundle){
  const {request,race}=bundle;
  if(race?.version!==
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V7_VERSION)
    throw new Error('Position archive V2 requires V7 movement.');
  const ids=riderIdsFor(request);
  const byId=new Map(ids.map((id,index)=>[id,index]));
  const contactEvents=race.steps.flatMap(step=>
    step.sharedRoad.contactEvents);
  const checkpointCrossings=[
    ...race.steps.flatMap(step=>
      step.sharedRoad.checkpointCrossings),
    ...race.tail.checkpointCrossings];
  if(!isDeepStrictEqual(contactEvents,
      race.contactEvents)||
    !isDeepStrictEqual(checkpointCrossings,
      race.checkpointCrossings))
    throw new Error('Position archive lost repeated motor evidence.');
  const steps=race.steps.map(step=>{
    const {contactEvents:events,...sharedRoad}=step.sharedRoad;
    return {...step,sharedRoad:{...sharedRoad,
      contactEventsPacked:events.map(event=>
        packEvent(event,step,byId))}};
  });
  const {contactEvents:unusedContacts,
    checkpointCrossings:unusedCrossings,...rest}=race;
  void unusedContacts;
  void unusedCrossings;
  return {...bundle,race:{...rest,steps}};
}

function expandBundle(bundle){
  const ids=riderIdsFor(bundle?.request);
  const packedRace=bundle?.race;
  if(packedRace?.version!==
      PHYSICAL_FIRST_POSITION_GENERAL_RACE_V7_VERSION||
    !Array.isArray(packedRace.steps)||
    packedRace.contactEvents!==undefined||
    packedRace.checkpointCrossings!==undefined)
    throw new Error('Position archive V2 motor shape changed.');
  const steps=packedRace.steps.map(step=>{
    const {contactEventsPacked,...sharedRoad}=step.sharedRoad??{};
    if(!Array.isArray(contactEventsPacked)||
      sharedRoad.contactEvents!==undefined)
      throw new Error('Position archive contact list changed.');
    return {...step,sharedRoad:{...sharedRoad,
      contactEvents:contactEventsPacked.map(tuple=>
        unpackEvent(tuple,step,ids))}};
  });
  const race={...packedRace,steps,
    checkpointCrossings:[
      ...steps.flatMap(step=>
        step.sharedRoad.checkpointCrossings),
      ...packedRace.tail.checkpointCrossings],
    contactEvents:steps.flatMap(step=>
      step.sharedRoad.contactEvents)};
  return {...bundle,race};
}

export function encodeGameSnapshotPositionRaceArchiveV2(bundle){
  verifyGameSnapshotPositionRaceBundleV1(bundle);
  const json=Buffer.from(JSON.stringify(
    compactBundle(bundle)));
  if(json.length>MAX_JSON_BYTES)
    throw new Error(`Position race archive exceeds its V2 storage limit: ${json.length} bytes.`);
  const body=gzipSync(json,{level:9});
  return {metadata:{version:
    GAME_SNAPSHOT_POSITION_ARCHIVE_V2_VERSION,
  encoding:'gzip',contentType:'application/json',
  packing:GAME_SNAPSHOT_POSITION_ARCHIVE_V2_PACKING,
  uncompressedBytes:json.length,
  uncompressedSha256:sha256(json),
  compressedBytes:body.length,
  compressedSha256:sha256(body),
  eventId:bundle.document.input.eventId,
  viewerDocumentSha256:bundle.document.sha256},
  body};
}

export function decodeGameSnapshotPositionRaceArchiveV2(
  {metadata,body}={}){
  if(metadata?.version!==
      GAME_SNAPSHOT_POSITION_ARCHIVE_V2_VERSION||
    metadata.encoding!=='gzip'||
    metadata.contentType!=='application/json'||
    metadata.packing!==
      GAME_SNAPSHOT_POSITION_ARCHIVE_V2_PACKING||
    !Number.isSafeInteger(metadata.uncompressedBytes)||
    metadata.uncompressedBytes<1||
    metadata.uncompressedBytes>MAX_JSON_BYTES||
    !Number.isSafeInteger(metadata.compressedBytes)||
    metadata.compressedBytes<1||
    !/^[a-f0-9]{64}$/.test(
      metadata.uncompressedSha256??'')||
    !/^[a-f0-9]{64}$/.test(
      metadata.compressedSha256??'')||
    typeof metadata.eventId!=='string'||
    !/^[a-f0-9]{64}$/.test(
      metadata.viewerDocumentSha256??'')||
    !Buffer.isBuffer(body)||
    body.length!==metadata.compressedBytes||
    sha256(body)!==metadata.compressedSha256)
    throw new Error('Position race V2 archive metadata changed.');
  let json;
  try{json=gunzipSync(body,{maxOutputLength:
    MAX_JSON_BYTES});}
  catch{throw new Error(
    'Position race V2 archive cannot decompress.');}
  if(json.length!==metadata.uncompressedBytes||
    sha256(json)!==metadata.uncompressedSha256)
    throw new Error('Position race V2 archive content changed.');
  let compact;
  try{compact=JSON.parse(json.toString('utf8'));}
  catch{throw new Error(
    'Position race V2 archive is not JSON.');}
  if(compact?.document?.input?.eventId!==
      metadata.eventId||
    compact?.document?.sha256!==
      metadata.viewerDocumentSha256)
    throw new Error(
      'Position race V2 archive references another document.');
  return verifyGameSnapshotPositionRaceBundleV1(
    expandBundle(compact));
}
