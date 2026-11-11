// Experimental future-race preview from a committed game snapshot.
// Existing official results and historic group-clock recordings are untouched.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {validateFeed} from '@pelotonia/race-viewer/data';
import {manifestFromCommittedPhysicalEntriesV1} from
  './committed-physical-manifest-v1.mjs';
import {preparePhysicalGameSnapshotV1,
  PHYSICAL_GAME_RACE_SOURCE_VERSION} from
  './physical-game-race-source-v1.mjs';
import {prepareGameSnapshotPaidViewerInputV1,
  GAME_SNAPSHOT_PAID_VIEWER_VERSION} from
  './game-snapshot-paid-viewer-v1.mjs';
import {PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../engine/v2/physical-first-position-start-v2.mjs';
import {recordPhysicalFirstPositionGeneralRaceV7} from
  '../engine/v2/physical-first-position-general-race-v1.mjs';
import {adaptPhysicalFirstPositionRaceV2,
  PHYSICAL_FIRST_POSITION_VIEWER_ADAPTER_V2_VERSION} from
  './physical-first-position-adapter-v1.mjs';

export const GAME_SNAPSHOT_POSITION_VIEWER_VERSION=
  'motor-lab-game-position-viewer-document-v1';
export const GAME_SNAPSHOT_POSITION_RACE_BUNDLE_VERSION=
  'motor-lab-game-position-race-bundle-v1';
export const GAME_SNAPSHOT_POSITION_GRID_VERSION=
  'motor-lab-abstract-position-grid-1';
const GRID=Object.freeze({laneCount:4,
  wheelSpacingM:2.5,laneStaggerM:.08});

const canonical=value=>Array.isArray(value)?
  value.map(canonical):value&&typeof value==='object'?
    Object.fromEntries(Object.keys(value).sort().map(key=>
      [key,canonical(value[key])])):value;
const hash=document=>createHash('sha256').update(
  JSON.stringify(canonical(document))).digest('hex');

function documentFromRace({request,race,eventId,category,
  teamStyles,riderNumbers,seedProvenance,
  weatherProvenance}){
  const input=request.input;
  const {version,feed,finishEvidence,coverage,source}=
    adaptPhysicalFirstPositionRaceV2({
      request,race,
      raceId:`${eventId}:position-preview`,
      category,teamStyles,riderNumbers,
      fixtureKind:'committed_game_snapshot',
      teamKitSource:'committed-game-manifest',
      riderNumberSource:'committed-game-manifest'});
  const document={schemaVersion:
    GAME_SNAPSHOT_POSITION_VIEWER_VERSION,
  adapterVersion:version,raceId:feed.raceId,
  input:{eventId,category,officialResults:false,
    physicalSourceVersion:PHYSICAL_GAME_RACE_SOURCE_VERSION,
    seedProvenance,weatherProvenance,
    positionGridVersion:
      GAME_SNAPSHOT_POSITION_GRID_VERSION,
    grid:{...GRID}},
  feed,finishEvidence,coverage,
  source:{...source,
    inputBridgeVersion:GAME_SNAPSHOT_PAID_VIEWER_VERSION,
    validatedKm:input.kilometres.length,
    validatedRiderKilometres:
      race.decisionCount}};
  return {...document,sha256:hash(document)};
}

export function createGameSnapshotPositionRaceBundleV1(
  snapshot,manifest){
  if(snapshot?.finished)
    throw new Error('Position preview needs an unfinished game race.');
  const resolved=preparePhysicalGameSnapshotV1(snapshot);
  const {input,category,teamStyles,riderNumbers,eventId}=
    prepareGameSnapshotPaidViewerInputV1(
      resolved.snapshot,manifest);
  const request={input:{...input,
    positionModelVersion:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION,
    positionPassingCorridorCount:1},
  grid:{...GRID}};
  const race=recordPhysicalFirstPositionGeneralRaceV7(request);
  const document=documentFromRace({request,race,eventId,
    category,teamStyles,riderNumbers,
    seedProvenance:resolved.seedProvenance,
    weatherProvenance:resolved.weatherProvenance});
  return {version:GAME_SNAPSHOT_POSITION_RACE_BUNDLE_VERSION,
    request,race,
    presentation:{eventId,category,
      teamStyles:structuredClone(teamStyles),
      riderNumbers:structuredClone(riderNumbers),
      seedProvenance:resolved.seedProvenance,
      weatherProvenance:resolved.weatherProvenance},
    document};
}

export function createGameSnapshotPositionViewerDocumentV1(
  snapshot,manifest){
  return createGameSnapshotPositionRaceBundleV1(
    snapshot,manifest).document;
}

export function verifyGameSnapshotPositionViewerDocumentV1(
  document){
  const {sha256,...payload}=document??{};
  if(document?.schemaVersion!==
      GAME_SNAPSHOT_POSITION_VIEWER_VERSION||
    document.adapterVersion!==
      PHYSICAL_FIRST_POSITION_VIEWER_ADAPTER_V2_VERSION||
    document.raceId!==
      `${document.input?.eventId}:position-preview`||
    !/^[a-f0-9]{64}$/.test(sha256??'')||
    document.raceId!==document.feed?.raceId||
    document.input?.category!==
      document.feed?.riderCategory||
    document.input?.officialResults!==false||
    document.input?.physicalSourceVersion!==
      PHYSICAL_GAME_RACE_SOURCE_VERSION||
    !['event-seed','official-engine-fallback'].includes(
      document.input?.seedProvenance)||
    !['event-locked-weather',
      'official-engine-deterministic-fallback'].includes(
      document.input?.weatherProvenance)||
    document.input?.positionGridVersion!==
      GAME_SNAPSHOT_POSITION_GRID_VERSION||
    JSON.stringify(document.input?.grid)!==
      JSON.stringify(GRID)||
    document.feed?.synthetic!==false||
    document.feed?.results!==undefined||
    document.coverage?.fixtureKind!==
      'committed_game_snapshot'||
    document.coverage?.officialResults!==false||
    document.coverage?.riderCount!==
      document.feed?.riders?.length||
    document.coverage?.paidRiderKilometres!==
      document.source?.validatedRiderKilometres||
    document.source?.validatedKm!==
      document.feed?.route?.profile?.samples?.at(-1)?.[0]/1000||
    document.source?.validatedRiderKilometres!==
      document.source?.validatedKm*
        document.feed?.riders?.length||
    document.coverage?.recordedBoundaryFrames!==
      document.source?.validatedKm+1||
    document.coverage?.renderedFrames!==
      document.feed?.frames?.length||
    document.source?.inputBridgeVersion!==
      GAME_SNAPSHOT_PAID_VIEWER_VERSION||
    document.source?.replayed!==true||
    !/^[a-f0-9]{64}$/.test(
      document.source?.inputHash??'')||
    document.finishEvidence?.publishedAt!==
      document.feed?.duration||
    document.finishEvidence?.entries?.length!==
      document.feed?.riders?.length||
    hash(payload)!==sha256)
    throw new Error('Position viewer document changed or lacks paid evidence.');
  validateFeed(document.feed);
  const riderIds=new Set(document.feed.riders.map(row=>row.id));
  const entries=document.finishEvidence.entries;
  if(document.feed.frames[0].time!==0||
    document.feed.frames.at(-1).time!==
      document.feed.duration||
    document.feed.frames.some(frame=>
      frame.positions.length!==riderIds.size||
      new Set(frame.positions.map(row=>row.riderId)).size!==
        riderIds.size||
      frame.positions.some(row=>!riderIds.has(row.riderId)))||
    new Set(entries.map(row=>row.riderId)).size!==
      riderIds.size||
    entries.some((row,index)=>
      !riderIds.has(row.riderId)||
      !Number.isFinite(row.clockSeconds)||
      row.clockSeconds<=0||
      row.clockSeconds>document.feed.duration||
      index>0&&row.clockSeconds<
        entries[index-1].clockSeconds))
    throw new Error('Position viewer document lacks a rider sample.');
  return document;
}

export function verifyGameSnapshotPositionRaceBundleV1(bundle){
  const {request,race,presentation,document}=bundle??{};
  verifyGameSnapshotPositionViewerDocumentV1(document);
  if(bundle.version!==
      GAME_SNAPSHOT_POSITION_RACE_BUNDLE_VERSION||
    request?.input?.positionModelVersion!==
      PHYSICAL_FIRST_POSITION_START_V2_VERSION||
    request?.input?.positionPassingCorridorCount!==1||
    !isDeepStrictEqual(request.grid,GRID)||
    presentation?.eventId!==document.input.eventId||
    presentation?.category!==document.input.category||
    presentation?.seedProvenance!==
      document.input.seedProvenance||
    presentation?.weatherProvenance!==
      document.input.weatherProvenance||
    document.source.inputHash!==race?.inputHash||
    document.source.validatedRiderKilometres!==
      race?.decisionCount)
    throw new Error('Position race bundle changed its motor source.');
  const regenerated=documentFromRace({request,race,
    ...presentation});
  if(!isDeepStrictEqual(regenerated,document))
    throw new Error('Position race bundle changed its viewer projection.');
  return bundle;
}

export async function loadGameSnapshotPositionRaceRecordingV1({
  readSnapshot,readEntries}){
  const before=await readSnapshot();
  if(!before?.event?.id||before.finished)
    throw new Error('Position preview needs an unfinished game race.');
  const entries=await readEntries(before.event.id);
  const afterInputs=await readSnapshot();
  if(JSON.stringify(afterInputs)!==JSON.stringify(before))
    throw new Error('The game race changed while loading positions.');
  const manifest=manifestFromCommittedPhysicalEntriesV1(
    before,entries);
  const bundle=createGameSnapshotPositionRaceBundleV1(
    before,manifest);
  const afterRun=await readSnapshot();
  const afterEntries=await readEntries(before.event.id);
  if(JSON.stringify(afterRun)!==JSON.stringify(before)||
    JSON.stringify(afterEntries)!==JSON.stringify(entries))
    throw new Error('The game race changed during position simulation.');
  verifyGameSnapshotPositionViewerDocumentV1(bundle.document);
  return {snapshot:structuredClone(before),
    entries:structuredClone(entries),bundle};
}

export async function loadGameSnapshotPositionRaceBundleV1(readers){
  return (await loadGameSnapshotPositionRaceRecordingV1(
    readers)).bundle;
}

export async function loadGameSnapshotPositionViewerDocumentV1(readers){
  return (await loadGameSnapshotPositionRaceBundleV1(
    readers)).document;
}
