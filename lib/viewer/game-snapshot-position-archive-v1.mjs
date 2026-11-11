// Server-side storage envelope for a replayable experimental V7 race.
// The viewer document remains separate so page views need not fetch the ledger.
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {verifyGameSnapshotPositionRaceBundleV1} from
  './game-snapshot-position-viewer-v1.mjs';

export const GAME_SNAPSHOT_POSITION_ARCHIVE_VERSION=
  'motor-lab-game-position-race-archive-v1';
const MAX_JSON_BYTES=64*1024*1024;
const sha256=bytes=>createHash('sha256').update(bytes)
  .digest('hex');

export function encodeGameSnapshotPositionRaceArchiveV1(bundle){
  verifyGameSnapshotPositionRaceBundleV1(bundle);
  const json=Buffer.from(JSON.stringify(bundle));
  if(json.length>MAX_JSON_BYTES)
    throw new Error('Position race archive exceeds its storage limit.');
  const body=gzipSync(json,{level:9});
  return {metadata:{version:
    GAME_SNAPSHOT_POSITION_ARCHIVE_VERSION,
  encoding:'gzip',contentType:'application/json',
  uncompressedBytes:json.length,
  uncompressedSha256:sha256(json),
  compressedBytes:body.length,
  compressedSha256:sha256(body),
  eventId:bundle.document.input.eventId,
  viewerDocumentSha256:bundle.document.sha256},
  body};
}

export function decodeGameSnapshotPositionRaceArchiveV1(
  {metadata,body}={}){
  if(metadata?.version!==
      GAME_SNAPSHOT_POSITION_ARCHIVE_VERSION||
    metadata.encoding!=='gzip'||
    metadata.contentType!=='application/json'||
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
    throw new Error('Position race archive metadata changed.');
  let json;
  try{
    json=gunzipSync(body,{maxOutputLength:
      MAX_JSON_BYTES});
  }catch{
    throw new Error('Position race archive cannot decompress.');
  }
  if(json.length!==metadata.uncompressedBytes||
    sha256(json)!==metadata.uncompressedSha256)
    throw new Error('Position race archive content changed.');
  let bundle;
  try{bundle=JSON.parse(json.toString('utf8'));}
  catch{
    throw new Error('Position race archive is not JSON.');
  }
  if(bundle?.document?.input?.eventId!==
      metadata.eventId||
    bundle?.document?.sha256!==
      metadata.viewerDocumentSha256)
    throw new Error('Position race archive references another document.');
  return verifyGameSnapshotPositionRaceBundleV1(bundle);
}
