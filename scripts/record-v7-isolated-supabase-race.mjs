// Records a completed experimental race only in the existing disposable
// Supabase auth-test project. Never accepts a production project URL.
import {createClient} from '@supabase/supabase-js';
import {readTestConfig} from '../tests/support/real-project.mjs';
import {loadGameSnapshotPositionRaceRecordingV1,
  verifyGameSnapshotPositionViewerDocumentV1} from
  '../lib/viewer/game-snapshot-position-viewer-v1.mjs';
import {encodeGameSnapshotPositionRaceArchiveV2,
  decodeGameSnapshotPositionRaceArchiveV2} from
  '../lib/viewer/game-snapshot-position-archive-v2.mjs';
import {recordedGameBroadcastV1} from
  '../lib/viewer/recorded-game-broadcast-v1.mjs';

const eventId=process.argv[2];
if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i
  .test(eventId??''))
  throw new Error('Pass the isolated test race UUID.');
const {url,serviceKey}=readTestConfig();
const db=createClient(url,serviceKey,{auth:{persistSession:false,
  autoRefreshToken:false,detectSessionInUrl:false}});
const existing=await db.from('recovery_position_race_recordings')
  .select('event_id').eq('event_id',eventId).maybeSingle();
if(existing.error)throw existing.error;
if(existing.data)
  throw new Error('The isolated race was already recorded.');
async function readSnapshot(){
  const {data,error}=await db.rpc('recovery_race_snapshot',
    {p_event:eventId});
  if(error)throw error;
  return data;
}
async function readEntries(){
  const {data,error}=await db.from('recovery_physical_entry_inputs')
    .select('event_id,team_id,schema_version,selected_riders,captain_id,orders,stake,team_style,rider_numbers')
    .eq('event_id',eventId).order('team_id');
  if(error)throw error;
  return data;
}
const recording=await loadGameSnapshotPositionRaceRecordingV1({
  readSnapshot,readEntries});
if(recording.snapshot.event.id!==eventId||
  recording.entries.length!==recording.snapshot.teams.length)
  throw new Error('The hosted game snapshot and entries differ.');
const archive=encodeGameSnapshotPositionRaceArchiveV2(
  recording.bundle);
const replay=decodeGameSnapshotPositionRaceArchiveV2({
  metadata:archive.metadata,body:archive.body});
if(replay.document.sha256!==recording.bundle.document.sha256)
  throw new Error('The hosted race archive failed replay.');
const {data:receipt,error:saveError}=await db.rpc(
  'recovery_save_position_race_recording_v1',{
    p_event:eventId,p_snapshot:recording.snapshot,
    p_entries:recording.entries,
    p_document:recording.bundle.document,
    p_archive_metadata:archive.metadata,
    p_archive_base64:archive.body.toString('base64')});
if(saveError)throw saveError;
if(receipt.already_recorded||
  receipt.event_id!==eventId||
  receipt.sha256!==recording.bundle.document.sha256)
  throw new Error('The isolated hosted recording receipt changed.');
const stored=await db.from('recovery_position_race_recordings')
  .select('document,archive_metadata,recorded_at')
  .eq('event_id',eventId).single();
if(stored.error)throw stored.error;
const document=verifyGameSnapshotPositionViewerDocumentV1(
  stored.data.document);
if(document.sha256!==receipt.sha256||
  stored.data.archive_metadata.compressedSha256!==
    archive.metadata.compressedSha256)
  throw new Error('The hosted readback changed the saved race.');
const clock=recordedGameBroadcastV1({
  recorded_at:stored.data.recorded_at,
  race_id:document.raceId,duration:document.feed.duration,
  events:document.feed.events},Date.now());
console.log(JSON.stringify({source:'isolated_auth_test_game',
  eventId,sha256:document.sha256,
  teams:recording.entries.length,
  riders:document.feed.riders.length,
  decisions:replay.race.decisionCount,
  finishes:replay.race.finishCrossings.length,
  archiveBytes:archive.body.length,
  recordingPublished:clock.recordingPublished,
  publicationAt:new Date(clock.publicationAtMs).toISOString(),
  officialResults:false,replayVerified:true,
  hostedReadbackVerified:true}));
