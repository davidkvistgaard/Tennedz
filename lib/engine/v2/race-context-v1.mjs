// Opt-in decision inputs for a future race-dynamics motor version. This module
// does not move riders or create time gaps; those must be paid by the road clock.
const FORMATS=new Set(['one_day','stage']);
const ROLES=new Set(['break','control','protect','opportunistic']);

export function normalizeRaceContext(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).some(key=>!['format','stageNumber','teamRoles'].includes(key))||
    !FORMATS.has(input.format)||
    (input.format==='one_day'&&input.stageNumber!==undefined)||
    (input.format==='stage'&&(!Number.isInteger(input.stageNumber)||
      input.stageNumber<1||input.stageNumber>30))||
    (input.teamRoles!==undefined&&(!input.teamRoles||
      typeof input.teamRoles!=='object'||Array.isArray(input.teamRoles)||
      Object.entries(input.teamRoles).some(([id,role])=>!id||!ROLES.has(role)))))
    throw new Error('Invalid race context.');
  return Object.freeze({format:input.format,
    ...(input.format==='stage'?{stageNumber:input.stageNumber}:{}),
    ...(input.teamRoles===undefined?{}:{teamRoles:Object.freeze({...input.teamRoles})})});
}

// The estimate describes a potential chase, not a promise that the riders
// will deliver it. Its speed inputs must come from a rider/road calculation;
// this function never awards a gap. A non-positive relative speed cannot close it.
export function projectedCatchKm({gapSeconds,remainingKm,frontSecondsPerKm,
  bunchSecondsPerKm}){
  if(![gapSeconds,remainingKm,frontSecondsPerKm,bunchSecondsPerKm].every(
    value=>Number.isFinite(value)&&value>=0)||frontSecondsPerKm===0||
    bunchSecondsPerKm===0)
    throw new Error('Invalid projected catch inputs.');
  const gainPerKm=frontSecondsPerKm-bunchSecondsPerKm;
  return gainPerKm<=0?null:gapSeconds/gainPerKm<=remainingKm?
    gapSeconds/gainPerKm:null;
}

export function breakSituationForTeam({teamId,frontTeamIds,frontRiderIds,
  protectedLeaderIds=[],gcThreatRiderIds=[]}){
  if(typeof teamId!=='string'||!teamId||
    ![frontTeamIds,frontRiderIds,protectedLeaderIds,gcThreatRiderIds]
      .every(Array.isArray))throw new Error('Invalid break situation.');
  const ownRiderAhead=frontTeamIds.includes(teamId);
  const protectedLeaderAhead=protectedLeaderIds.some(id=>frontRiderIds.includes(id));
  const gcThreatAhead=gcThreatRiderIds.some(id=>frontRiderIds.includes(id));
  return Object.freeze({ownRiderAhead,protectedLeaderAhead,gcThreatAhead});
}

// Only automatic cadence attacks are restrained. A named manager order, GC
// emergency or paid keypoint decision is handled by the existing order path.
export function automaticCadenceAttackAllowed({context,km,distanceKm,
  frontRiderCount,ownRiderAhead}){
  normalizeRaceContext(context);
  if(!Number.isInteger(km)||!Number.isInteger(distanceKm)||km<1||
    distanceKm<km||!Number.isInteger(frontRiderCount)||frontRiderCount<0||
    typeof ownRiderAhead!=='boolean')throw new Error('Invalid attack phase.');
  if(ownRiderAhead)return false;
  if(frontRiderCount===0)return true;
  const settledSize=context.format==='one_day'?3:4;
  if(frontRiderCount>=settledSize&&distanceKm-km>50)return false;
  return true;
}
