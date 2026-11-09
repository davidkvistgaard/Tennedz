// Transport boundary for a committed physical Motor Lab input. It never
// derives orders, sporting stakes, team identity or race outcomes for callers.
import {runPhysicalFirstWholeRaceProbeV1,physicalFirstInputHash} from
  '../engine/v2/physical-first-whole-race-probe-v1.mjs';
import {replayPhysicalFirstWholeRaceV1} from
  '../engine/v2/physical-first-whole-race-replay-v1.mjs';
import {adaptSplitPhysicalFirstRaceV1} from
  './physical-first-split-adapter-v1.mjs';

export const PAID_MOTOR_RACE_EXPORT_VERSION='paid-motor-race-export-v1';

export function exportPaidMotorRaceToViewerV1({input,raceId,category,
  teamStyles,teamKitSource='committed-team-style',paidRace}){
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
    typeof teamKitSource!=='string'||!teamKitSource.trim())
    throw new Error('Viewer export needs committed Motor Lab inputs and team styles.');
  const paidInput={start,kilometres,teams,stakes,raceSeed,
    emergencyFrontWorkers};
  const race=paidRace??runPhysicalFirstWholeRaceProbeV1(paidInput);
  if(race.commitmentHash!==physicalFirstInputHash(paidInput))
    throw new Error('Viewer export source commitment differs from paid input.');
  const replay=replayPhysicalFirstWholeRaceV1(paidInput,race);
  const distanceKm=kilometres.length;
  if(replay.validatedKm!==distanceKm||
    replay.validatedRiderKm!==distanceKm*riderIds.length)
    throw new Error('Viewer export has incomplete rider-kilometre replay.');
  const exported=adaptSplitPhysicalFirstRaceV1({race,kilometres,
    teams,teamStyles,raceId,category,teamKitSource});
  return {...exported,source:{exportVersion:PAID_MOTOR_RACE_EXPORT_VERSION,
    probeVersion:race.version,
    raceSeed:race.raceSeed,commitmentHash:race.commitmentHash,
    validatedKm:replay.validatedKm,
    validatedRiderKilometres:replay.validatedRiderKm}};
}
