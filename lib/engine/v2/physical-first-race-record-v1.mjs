// Source-independent race recording boundary. The paid trace is recomputed
// from committed inputs before any finish crossing can be exported.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalFirstWholeRaceProbeV1} from
  './physical-first-whole-race-probe-v1.mjs';
import {replayPhysicalFirstWholeRaceV1} from
  './physical-first-whole-race-replay-v1.mjs';

export const PHYSICAL_FIRST_RACE_RECORD_VERSION=
  'physical-first-race-record-1';

export function recordPhysicalFirstRaceV1(input,
  {recording:existingRecording}={}){
  const recording=existingRecording??
    runPhysicalFirstWholeRaceProbeV1(input);
  const replay=replayPhysicalFirstWholeRaceV1(
    input,recording);
  const distanceM=input.kilometres.length*1000;
  const committedIds=new Set(input.teams.flatMap(team=>
    team.riders.map(rider=>rider.id)));
  const final=replay.finalState;
  if(replay.validatedKm!==input.kilometres.length||
    replay.validatedRiderKm!==distanceM/1000*
      committedIds.size||
    !isDeepStrictEqual(final,recording.states.at(-1))||
    final.riders.length!==committedIds.size||
    final.riders.some(row=>
      !committedIds.has(row.riderId)||
      row.distanceM!==distanceM||
      !Number.isFinite(row.clockSeconds)||
      row.clockSeconds<=0||
      !Number.isFinite(row.reserve)||
      !final.roads.some(road=>road.roadId===row.roadId&&
        road.riderIds.includes(row.riderId)))||
    new Set(final.riders.map(row=>row.riderId)).size!==
      committedIds.size)
    throw new Error(
      'Physical race record lacks complete paid finish crossings.');
  const finishCrossings=final.riders.map(row=>({
    riderId:row.riderId,clockSeconds:row.clockSeconds,
    roadId:row.roadId})).sort((a,b)=>
    a.clockSeconds-b.clockSeconds||
    a.riderId.localeCompare(b.riderId));
  return {version:PHYSICAL_FIRST_RACE_RECORD_VERSION,
    raceSeed:recording.raceSeed,
    commitmentHash:recording.commitmentHash,
    recording,replay,
    finishCrossings,officialResults:false};
}
