// Transport boundary for a committed physical Motor Lab input. It never
// derives orders, sporting stakes, team identity or race outcomes for callers.
import {isDeepStrictEqual} from 'node:util';
import {physicalFirstInputHash} from
  '../engine/v2/physical-first-whole-race-probe-v1.mjs';
import {recordPhysicalFirstRaceV1} from
  '../engine/v2/physical-first-race-record-v1.mjs';
import {adaptSplitPhysicalFirstRaceV1} from
  './physical-first-split-adapter-v1.mjs';

export const PAID_MOTOR_RACE_EXPORT_VERSION='paid-motor-race-export-v1';

export function exportPaidMotorRaceToViewerV1({input,raceId,category,
  teamStyles,teamKitSource='committed-team-style',
  riderNumbers,riderNumberSource='committed-race-bib',paidRace}){
  const {start,kilometres,teams,stakes,raceSeed,
    emergencyFrontWorkers=[]}=input??{};
  const riderIds=teams?.flatMap(team=>team.riders?.map(rider=>rider.id)??[]);
  if(!['men','women'].includes(category)||
    typeof raceId!=='string'||!raceId.trim()||
    typeof raceSeed!=='string'||!raceSeed||
    !Array.isArray(kilometres)||!kilometres.length||
    !Array.isArray(teams)||!teams.length||
    !Array.isArray(stakes)||stakes.length!==teams.length||
    !Array.isArray(riderIds)||!riderIds.length||
    new Set(riderIds).size!==riderIds.length||
    teams.some(team=>!team?.id||!team?.orders?.captainId||
      !team.riders?.some(rider=>rider.id===team.orders.captainId)||
      !team.orders?.baseline)||
    !Array.isArray(teamStyles)||teamStyles.length!==teams.length||
    teamStyles.some((style,index)=>style?.id!==teams[index].id)||
    !riderNumbers||typeof riderNumbers!=='object'||
    Object.keys(riderNumbers).length!==riderIds.length||
    riderIds.some(id=>!Number.isInteger(riderNumbers[id])||
      riderNumbers[id]<1)||
    new Set(Object.values(riderNumbers)).size!==riderIds.length||
    typeof teamKitSource!=='string'||!teamKitSource.trim())
    throw new Error('Viewer export needs committed Motor Lab inputs and team styles.');
  const paidInput={start,kilometres,teams,stakes,raceSeed,
    emergencyFrontWorkers};
  if(paidRace&&paidRace.commitmentHash!==
    physicalFirstInputHash(paidInput))
    throw new Error('Viewer export source commitment differs from paid input.');
  const recorded=recordPhysicalFirstRaceV1(paidInput,
    paidRace?{recording:paidRace}:undefined);
  const {recording:race,replay,finishCrossings}=recorded;
  const distanceKm=kilometres.length;
  if(replay.validatedKm!==distanceKm||
    replay.validatedRiderKm!==distanceKm*riderIds.length)
    throw new Error('Viewer export has incomplete rider-kilometre replay.');
  const exported=adaptSplitPhysicalFirstRaceV1({race,kilometres,
    teams,teamStyles,raceId,category,teamKitSource,
    riderNumbers,riderNumberSource});
  if(!isDeepStrictEqual(exported.finishEvidence.entries,
    finishCrossings))
    throw new Error('Viewer finish differs from replayed motor crossings.');
  return {...exported,source:{exportVersion:PAID_MOTOR_RACE_EXPORT_VERSION,
    recordVersion:recorded.version,
    probeVersion:race.version,
    raceSeed:race.raceSeed,commitmentHash:race.commitmentHash,
    validatedKm:replay.validatedKm,
    validatedRiderKilometres:replay.validatedRiderKm}};
}
