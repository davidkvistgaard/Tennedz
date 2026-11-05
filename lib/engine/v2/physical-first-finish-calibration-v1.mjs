// Compare a physically paid probe with the historical finish claim.
// Source gaps are evidence for calibration only, never movement inputs.
import {recordedGroupFinish} from './race-group-finish-v94.mjs';
import {PHYSICAL_FIRST_WHOLE_RACE_PROBE_VERSION,
  physicalFirstInputHash} from
  './physical-first-whole-race-probe-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';

export const PHYSICAL_FIRST_FINISH_CALIBRATION_VERSION=
  'physical-first-finish-calibration-1';
const EPS=.002;

export function calibratePhysicalFirstFinishV1(recording,
  probe){
  const kilometres=recording?.route?.kilometres;
  const teams=recording?.committedInputs?.teams;
  const stakes=recording?.committedInputs?.rivalIntent;
  const emergencyFrontWorkers=recording?.committedInputs
    ?.emergencyFrontWorkers??[];
  if(probe?.version!==
      PHYSICAL_FIRST_WHOLE_RACE_PROBE_VERSION||
    probe.raceSeed!==recording?.raceSeed||
    !Array.isArray(kilometres)||
    !Array.isArray(teams)||!Array.isArray(stakes)||
    probe.commitmentHash!==physicalFirstInputHash({
      kilometres,teams,stakes,
      emergencyFrontWorkers})||
    probe.completedThroughKm!==kilometres.length||
    probe.states?.length!==kilometres.length+1)
    throw new Error(
      'Finish calibration needs the same committed full race.');
  const initial=probe.states[0];
  const initialRiders=new Map(initial.riders.map(row=>
    [row.riderId,row]));
  const committedRiders=teams.flatMap(team=>
    team.riders.map(rider=>({rider,teamId:team.id})));
  if(initialRiders.size!==committedRiders.length||
    committedRiders.some(({rider,teamId})=>{
      const row=initialRiders.get(rider.id);
      const cap=replayRearEnergyCapV1({rider,kilometres,
        throughKm:0}).initialCap;
      return row?.teamId!==teamId||
        Math.abs(row.reserve-cap)>EPS;
    }))
    throw new Error(
      'Finish calibration needs committed starting reserve.');
  const source=recordedGroupFinish(recording);
  const final=probe.states.at(-1);
  const riders=new Map(final.riders.map(row=>
    [row.riderId,row]));
  const sourceClaims=new Map();
  for(const group of source.groups)
    for(const riderId of group.riderIds)
      sourceClaims.set(riderId,{sourceGroup:group.id,
        claimedLeadSeconds:group.secondsAheadOfBunch});
  for(const riderId of source.bunchRiderIds)
    sourceClaims.set(riderId,{sourceGroup:'peloton',
      claimedLeadSeconds:0});
  for(const row of source.dropped)
    sourceClaims.set(row.riderId,{sourceGroup:'dropped',
      claimedLeadSeconds:-row.secondsBehindBunch});
  if(riders.size!==final.riders.length||
    riders.size!==sourceClaims.size||
    [...riders.keys()].some(id=>!sourceClaims.has(id))||
    !Number.isFinite(final.frontClockSeconds))
    throw new Error(
      'Finish calibration lacks complete paid riders.');
  const comparisons=[...riders.values()].map(row=>{
    const claim=sourceClaims.get(row.riderId);
    const paidLeadSeconds=final.frontClockSeconds-
      row.clockSeconds;
    return {riderId:row.riderId,
      sourceGroup:claim.sourceGroup,
      physicalRoadId:row.roadId,
      claimedLeadSeconds:claim.claimedLeadSeconds,
      paidLeadSeconds,
      claimedMinusPaidSeconds:claim.claimedLeadSeconds-
        paidLeadSeconds};
  }).sort((a,b)=>a.riderId.localeCompare(b.riderId));
  const max=[...comparisons].sort((a,b)=>
    Math.abs(b.claimedMinusPaidSeconds)-
      Math.abs(a.claimedMinusPaidSeconds)||
    a.riderId.localeCompare(b.riderId))[0];
  return {version:PHYSICAL_FIRST_FINISH_CALIBRATION_VERSION,
    raceSeed:probe.raceSeed,
    commitmentHash:probe.commitmentHash,
    validatedKm:kilometres.length,
    riderCount:riders.size,
    mismatchCount:comparisons.filter(row=>
      Math.abs(row.claimedMinusPaidSeconds)>EPS).length,
    maxAbsoluteMismatchSeconds:
      +Math.abs(max.claimedMinusPaidSeconds).toFixed(6),
    maxMismatchRiderId:max.riderId,
    comparisons,sourceClaimUsedAsPhysicalPosition:false,
    officialResults:false};
}
