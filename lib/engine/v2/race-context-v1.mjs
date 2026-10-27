// Opt-in decision inputs for a future race-dynamics motor version. This module
// does not move riders or create time gaps; those must be paid by the road clock.
const FORMATS=new Set(['one_day','stage']);
const ROLES=new Set(['break','control','protect','opportunistic']);

export function normalizeRaceContext(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).some(key=>!['format','stageNumber','teamRoles',
      'frontRotationVersion','frontObservationVersion',
      'controlPursuitVersion','frontExhaustionVersion'].includes(key))||
    (input.frontRotationVersion!==undefined&&
      ![1,2,3].includes(input.frontRotationVersion))||
    (input.frontObservationVersion!==undefined&&
      ![1,2].includes(input.frontObservationVersion))||
    (input.controlPursuitVersion!==undefined&&
      ![1,2].includes(input.controlPursuitVersion))||
    (input.frontExhaustionVersion!==undefined&&
      ![1,2,3].includes(input.frontExhaustionVersion))||
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
    ...(input.teamRoles===undefined?{}:{teamRoles:Object.freeze({...input.teamRoles})}),
    ...(input.frontRotationVersion===undefined?{}:{frontRotationVersion:
      input.frontRotationVersion}),
    ...(input.frontObservationVersion===undefined?{}:{frontObservationVersion:
      input.frontObservationVersion}),
    ...(input.controlPursuitVersion===undefined?{}:{controlPursuitVersion:
      input.controlPursuitVersion}),
    ...(input.frontExhaustionVersion===undefined?{}:{frontExhaustionVersion:
      input.frontExhaustionVersion})});
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

// This uses only completed road-group frames. A new leading group or a changed
// membership invalidates the trend; it is not a continuous wheel trace.
export function observedFrontClosingSecondsPerKm({frames,frontGroup,lookbackKm=5,
  membershipVersion=1}){
  if(!Array.isArray(frames)||!Number.isInteger(lookbackKm)||lookbackKm<1||
    ![1,2].includes(membershipVersion)||
    !frontGroup||!Array.isArray(frontGroup.riderIds)||
    !Number.isFinite(frontGroup.gapSeconds))
    throw new Error('Invalid observed front trend.');
  if(frames.length<lookbackKm+1)return null;
  const sampled=frames.slice(-(lookbackKm+1));
  if(membershipVersion===2&&new Set(frontGroup.riderIds).size!==
    frontGroup.riderIds.length)return null;
  const frontRiders=new Set(frontGroup.riderIds);
  if(sampled.some(frame=>{
    const group=frame.roadGroups?.[0];
    return !group||group.id!==frontGroup.id||
      group.riderIds.length!==frontGroup.riderIds.length||
      (membershipVersion===2?
        new Set(group.riderIds).size!==group.riderIds.length||
          group.riderIds.some(id=>!frontRiders.has(id)):
        group.riderIds.some((id,index)=>id!==frontGroup.riderIds[index]));
  }))return null;
  return +(sampled[0].roadGroups[0].gapSeconds-frontGroup.gapSeconds)
    .toFixed(2)/lookbackKm;
}

// A stable front that is not actually being closed down can share its
// maintenance turns, even if a pursuing team is spending energy ineffectively.
// A measured closing trend with an active chase restores every puller.
// Explicit driving riders keep working. The
// returned worker roster is consumed by both road pace and energy accounting.
export function settledFrontRotation({frontGroup,pullRiderIds,driveRiderIds,km,
  remainingKm,observedClosingSecondsPerKm,priorChaserCount,
  policyVersion=1}){
  if(!frontGroup||!Array.isArray(frontGroup.riderIds)||
    !Number.isFinite(frontGroup.gapSeconds)||
    !Array.isArray(pullRiderIds)||!Array.isArray(driveRiderIds)||
    !Number.isInteger(km)||km<1||!Number.isFinite(remainingKm)||remainingKm<0||
    !Number.isInteger(priorChaserCount)||priorChaserCount<0||
    ![1,2,3].includes(policyVersion)||observedClosingSecondsPerKm!==null&&
      !Number.isFinite(observedClosingSecondsPerKm))
    throw new Error('Invalid settled front rotation.');
  const original=[...pullRiderIds];
  const front=new Set(frontGroup.riderIds),driving=new Set(driveRiderIds);
  if(new Set(original).size!==original.length||
    new Set(driveRiderIds).size!==driveRiderIds.length||
    driveRiderIds.some(id=>!original.includes(id)))
    throw new Error('Invalid settled front worker.');
  const cooperators=original.filter(id=>front.has(id)&&!driving.has(id)).sort();
  const canSettle=frontGroup.gapSeconds>0&&remainingKm>50&&
    observedClosingSecondsPerKm!==null&&
    (priorChaserCount===0||observedClosingSecondsPerKm<=0)&&
    (observedClosingSecondsPerKm<=0||
      frontGroup.gapSeconds/observedClosingSecondsPerKm>remainingKm);
  if(!canSettle||cooperators.length<3)
    return {pullRiderIds:original,restRiderIds:[]};
  // A maintenance policy always pays for at least one exposed worker. The
  // older second policy is retained for exact replay of existing recordings.
  const activeCount=policyVersion===3?1:policyVersion===2?
    priorChaserCount===0?0:1:Math.ceil(cooperators.length/2);
  const start=(km-1)%cooperators.length;
  const active=new Set(Array.from({length:activeCount},(_,offset)=>
    cooperators[(start+offset)%cooperators.length]));
  return {pullRiderIds:original.filter(id=>!front.has(id)||driving.has(id)||
    active.has(id)),restRiderIds:cooperators.filter(id=>!active.has(id))};
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
