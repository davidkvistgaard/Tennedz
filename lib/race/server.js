import "server-only";
import { raceErrorMessage } from "./messages.mjs";
import { NextResponse } from "next/server";
import { AuthError } from "../auth/policy.mjs";
import {
  databaseClient,
  requireAdministrator,
  requireGameWrites,
  authFailure,
  privateHeaders,
} from "../auth/server";
import { buildRace } from "./cycle.mjs";
import { withRecordedAppearanceV1 } from "../viewer/recorded-appearance-v1.mjs";
import {positionRaceTargetV1} from './position-race-target-v1.mjs';
import {physicalEntryEnabledForEventV1} from
  './physical-entry-target-v1.mjs';
import {loadGameSnapshotPositionRaceRecordingV1} from
  '../viewer/game-snapshot-position-viewer-v1.mjs';
import {encodeGameSnapshotPositionRaceArchiveV2} from
  '../viewer/game-snapshot-position-archive-v2.mjs';
import {commitMissingDefaultPhysicalEntriesV1} from
  './default-physical-runner-v1.mjs';
export function uuid(value) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
  )
    throw new AuthError("INVALID_ID", "Invalid race or rider ID.", 400);
  return value;
}
export async function rpc(db, name, args) {
  const { data, error } = await db.rpc(name, args);
  if (error) {
    const status = /^PT(400|403|404|409)$/.test(error.code)
      ? Number(error.code.slice(2))
      : 503;
    throw new AuthError(
      "RACE_UNAVAILABLE",
      status === 503
        ? "The race service could not save your changes. Please try again."
        : raceErrorMessage(error.message),
      status,
    );
  }
  return data;
}

async function executePositionRace(db,id,snapshot){
  const {data:existing,error:existingError}=await db.from(
    'recovery_position_race_recordings')
    .select('archive_metadata').eq('event_id',id).maybeSingle();
  if(existingError)throw new AuthError('RACE_UNAVAILABLE',
    'Could not check the saved position race.',503);
  const commitDb=databaseClient({timeoutMs:120000});
  if(existing)return rpc(commitDb,
    'recovery_finalize_position_race_v1',{
      p_event:id,
      p_sha256:existing.archive_metadata?.viewerDocumentSha256});
  try{
    await commitMissingDefaultPhysicalEntriesV1({
      db,rpc,snapshot});
  }catch(error){
    if(error instanceof AuthError)throw error;
    throw new AuthError('DEFAULT_ENTRY_UNAVAILABLE',
      error.message,409);
  }
  const readSnapshot=()=>rpc(db,'recovery_race_snapshot',
    {p_event:id});
  const readEntries=async eventId=>{
    const {data,error}=await db.from(
      'recovery_physical_entry_inputs')
      .select('event_id,team_id,schema_version,selected_riders,captain_id,orders,stake,team_style,rider_numbers')
      .eq('event_id',eventId).order('team_id');
    if(error)throw new AuthError('RACE_UNAVAILABLE',
      'Could not read committed race tactics.',503);
    return data;
  };
  let recording,archive;
  try{
    recording=await loadGameSnapshotPositionRaceRecordingV1({
      readSnapshot,readEntries});
    archive=encodeGameSnapshotPositionRaceArchiveV2(
      recording.bundle);
  }catch(error){
    if(error instanceof AuthError)throw error;
    throw new AuthError('INVALID_POSITION_RACE',error.message,409);
  }
  const receipt=await rpc(commitDb,
    'recovery_save_position_race_recording_v1',{
      p_event:id,
      p_snapshot:recording.snapshot,
      p_entries:recording.entries,
      p_document:recording.bundle.document,
      p_archive_metadata:archive.metadata,
      p_archive_base64:archive.body.toString('base64')});
  return rpc(commitDb,'recovery_finalize_position_race_v1',{
    p_event:id,p_sha256:receipt.sha256});
}
export async function executeRace(db, id) {
  const snapshot = await rpc(db, "recovery_race_snapshot", { p_event: id });
  if (snapshot.finished) return { ...snapshot.summary, already_finished: true };
  if(positionRaceTargetV1(id,process.env))
    return executePositionRace(db,id,snapshot);
  if(physicalEntryEnabledForEventV1(id,process.env))
    throw new AuthError('POSITION_RACE_NOT_ENABLED',
      'Physical race entry is enabled, but its race engine is not. The race cannot run.',
      409);
  let output;
  try {
    output = buildRace(snapshot);
  } catch (e) {
    throw new AuthError("INVALID_RACE", e.message, 409);
  }
  const teamIds = snapshot.teams.map(team => team.id);
  const identities = [];
  for (let start = 0; start < teamIds.length; start += 40) {
    const { data, error } = await db.from("club_identities")
      .select("team_id,palette,pattern")
      .in("team_id", teamIds.slice(start, start + 40));
    if (error) throw new AuthError("RACE_UNAVAILABLE",
      "Could not save the teams' race appearance. Please try again.", 503);
    identities.push(...data);
  }
  output = withRecordedAppearanceV1(output, identities);
  return rpc(db, "recovery_finish_race", {
    p_event: id,
    p_snapshot: snapshot,
    p_output: output,
  });
}
export async function runEvent(req) {
  try {
    await requireAdministrator(req);
    requireGameWrites();
    const body = await req.json().catch(() => ({}));
    const id = uuid(body.event_id);
    const db = databaseClient();
    const result = await executeRace(db, id);
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (e) {
    return authFailure(e);
  }
}
