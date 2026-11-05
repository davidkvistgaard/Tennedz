// Compare source finish claims with complete paid rider clocks. This
// supplies calibration evidence without a wheel order or official result.
import {recordedGroupFinish} from './race-group-finish-v94.mjs';
import {validateV94PhysicalWholeRaceV1} from
  './v94-physical-whole-race-validation-v1.mjs';

export const V94_PHYSICAL_FINISH_SOURCE_AUDIT_VERSION=
  'v94-physical-finish-source-audit-1';
const EPS=.002;

export function auditV94PhysicalFinishSourceV1(
  recording,traces){
  const validation=validateV94PhysicalWholeRaceV1(
    recording,traces);
  const source=recordedGroupFinish(recording);
  const paid=traces.at(-1);
  const frontClockSeconds=paid.front?.frontClockSeconds??
    paid.frontClockSeconds;
  if(source.km!==validation.validatedKm||
    !Number.isFinite(frontClockSeconds))
    throw new Error('Finish audit needs a paid front clock.');
  const claims=new Map();
  for(const group of source.groups)
    for(const riderId of group.riderIds)
      claims.set(riderId,{sourceGroup:group.id,
        claimedLeadSeconds:group.secondsAheadOfBunch});
  for(const riderId of source.bunchRiderIds)
    claims.set(riderId,{sourceGroup:'peloton',
      claimedLeadSeconds:0});
  for(const row of source.dropped)
    claims.set(row.riderId,{sourceGroup:'dropped',
      claimedLeadSeconds:-row.secondsBehindBunch});
  if(claims.size!==validation.riderCount)
    throw new Error('Finish audit lacks source rider coverage.');
  const comparisons=paid.finishes.map(row=>{
    const claim=claims.get(row.riderId);
    if(!claim)throw new Error(
      'Finish audit lacks a source rider claim.');
    const paidLeadSeconds=frontClockSeconds-row.clockSeconds;
    return {riderId:row.riderId,
      sourceGroup:claim.sourceGroup,
      physicalGroup:row.physicalGroup,
      claimedLeadSeconds:claim.claimedLeadSeconds,
      paidLeadSeconds,
      claimedMinusPaidSeconds:
        claim.claimedLeadSeconds-paidLeadSeconds};
  });
  const ranked=[...comparisons].sort((a,b)=>
    Math.abs(b.claimedMinusPaidSeconds)-
      Math.abs(a.claimedMinusPaidSeconds)||
    a.riderId.localeCompare(b.riderId));
  const max=ranked[0];
  return {version:V94_PHYSICAL_FINISH_SOURCE_AUDIT_VERSION,
    validatedKm:validation.validatedKm,
    riderCount:validation.riderCount,
    frontClockSeconds,
    mismatchCount:comparisons.filter(row=>
      Math.abs(row.claimedMinusPaidSeconds)>EPS).length,
    maxAbsoluteMismatchSeconds:
      +Math.abs(max.claimedMinusPaidSeconds).toFixed(6),
    maxMismatchRiderId:max.riderId,
    comparisons,
    sourceClaimUsedAsPhysicalPosition:false,
    officialResults:false};
}
