import {ENGINE_VERSION} from '../race/cycle.mjs';
import {generateLockedWeather} from '../weather/weatherModel.js';
import {manifestFromCommittedPhysicalEntriesV1} from
  './committed-physical-manifest-v1.mjs';
import {createGameSnapshotPaidViewerDocumentV1} from
  './game-snapshot-paid-viewer-v1.mjs';
import {sealPhysicalFirstRaceDocumentV3} from
  './physical-first-race-document-v3.mjs';

export const PHYSICAL_GAME_RACE_SOURCE_VERSION=
  'physical-game-race-source-v1';

// Use precisely the current official engine's deterministic seed and weather
// inputs. A preview does not write them to the event or publish a result.
export function createPhysicalGameRaceDocumentV1(snapshot,entries){
  const event=snapshot?.event;
  if(!event||snapshot.finished)
    throw new Error('A physical preview needs an unfinished game race.');
  const manifest=manifestFromCommittedPhysicalEntriesV1(
    snapshot,entries);
  const seed=event.seed||`${event.id}:${ENGINE_VERSION}`;
  const weather=event.weather_locked||generateLockedWeather({
    event_id:event.id,country_code:event.country_code,
    game_date_iso:snapshot.game_date,deadline_iso:event.deadline});
  const document=createGameSnapshotPaidViewerDocumentV1({
    ...snapshot,event:{...event,seed},weather},manifest);
  return sealPhysicalFirstRaceDocumentV3(document,{
    ...document.input,
    physicalSourceVersion:PHYSICAL_GAME_RACE_SOURCE_VERSION,
    seedProvenance:event.seed?'event-seed':'official-engine-fallback',
    weatherProvenance:event.weather_locked?
      'event-locked-weather':'official-engine-deterministic-fallback'});
}

// The official snapshot RPC checks the event deadline and locks its own
// transaction. Read it again after private entry rows to reject a changed
// race instead of mixing two game states into one viewer document.
export async function loadPhysicalGameRaceRecordInputV1({
  readSnapshot,readEntries}){
  const before=await readSnapshot();
  if(before?.finished)
    throw new Error('This race is already finished.');
  const rows=await readEntries(before.event.id);
  const after=await readSnapshot();
  if(JSON.stringify(after)!==JSON.stringify(before))
    throw new Error('The race changed while loading viewer data.');
  return {snapshot:before,entries:rows,
    document:createPhysicalGameRaceDocumentV1(before,rows)};
}

export async function loadPhysicalGameRaceDocumentV1(readers){
  return (await loadPhysicalGameRaceRecordInputV1(readers)).document;
}
