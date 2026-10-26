// Opt-in decision inputs for a future race-dynamics motor version. This module
// does not move riders or create time gaps; those must be paid by the road clock.
const FORMATS=new Set(['one_day','stage']);

export function normalizeRaceContext(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).some(key=>!['format','stageNumber'].includes(key))||
    !FORMATS.has(input.format)||
    (input.format==='one_day'&&input.stageNumber!==undefined)||
    (input.format==='stage'&&(!Number.isInteger(input.stageNumber)||
      input.stageNumber<1||input.stageNumber>30)))
    throw new Error('Invalid race context.');
  return Object.freeze({format:input.format,
    ...(input.format==='stage'?{stageNumber:input.stageNumber}:{})});
}

// The estimate describes a potential chase, not a promise that the riders
// will deliver it. A non-positive relative speed cannot close the gap.
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
