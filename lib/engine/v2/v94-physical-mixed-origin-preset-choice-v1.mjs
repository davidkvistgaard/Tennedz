// Separate a recorded preset attack by each rider's paid road at the
// boundary. A source break label never moves a rear rider to the front.
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const V94_PHYSICAL_MIXED_ORIGIN_PRESET_CHOICE_VERSION=
  'v94-physical-mixed-origin-preset-choice-1';
export const V94_PHYSICAL_MIXED_ORIGIN_PRESET_RIDER_VERSION=
  'v94-physical-mixed-origin-preset-rider-1';

export function decideV94PhysicalMixedOriginPresetV1(
  recording,prior){
  const km=prior?.sourceKm+1;
  const frame=recording.frames[km-1];
  const segment=recording.route.kilometres[km-1];
  const fresh=frame?.attackers;
  if(!Number.isInteger(km)||km<8||segment?.km!==km||
    !prior.fullFieldKilometre||
    prior.sourceCheckpointCalibrationFailed!==true||
    prior.sourceBreakRiderIds?.length!==0||
    !prior.formerSourceBreakRiderIds?.length||
    !Array.isArray(fresh)||fresh.length<2||
    new Set(fresh).size!==fresh.length||
    frame.joinedBreakawayRiderIds.length!==fresh.length||
    !fresh.every(id=>
      frame.joinedBreakawayRiderIds.includes(id))||
    frame.breakawayRiderIds.length!==fresh.length||
    !fresh.every(id=>frame.breakawayRiderIds.includes(id))||
    frame.freshAttackRiderDecisions.length!==fresh.length||
    new Set(frame.roadGroups.flatMap(row=>
      row.riderIds)).size!==fresh.length||
    !frame.roadGroups.every(group=>
      group.riderIds.every(id=>fresh.includes(id))))
    throw new Error('Mixed preset needs exact recorded membership.');
  const riders=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[
      rider.id,{rider,team}])));
  const stakes=new Map(recording.committedInputs.rivalIntent
    .map(row=>[row.teamId,row]));
  const finishes=new Map(prior.finishes.map(row=>[
    row.riderId,row]));
  const sources=new Map(frame.freshAttackRiderDecisions
    .map(row=>[row.riderId,row]));
  if(sources.size!==fresh.length)
    throw new Error('Mixed preset lacks unique source decisions.');
  const decisions=fresh.map(riderId=>{
    const entry=riders.get(riderId);
    const old=finishes.get(riderId);
    const source=sources.get(riderId);
    const stake=stakes.get(entry?.team.id);
    const order=entry&&orderAt(entry.team.orders,km-1);
    if(!entry||!old||!source||
      old.endDistanceM!==(km-1)*1000||
      !Number.isFinite(old.clockSeconds)||
      !Number.isFinite(old.energyAfter)||
      source.sourceKm!==km||
      source.choice!=='launch_paid_attack'||
      source.attackReason!=='preset_cadence'||
      source.teamId!==entry.team.id||
      source.teamOrderEffort!==order.effort||
      source.teamOrderAttack!==order.attack||
      order.attackRiderId||
      source.goal!==stake?.sportingGoal||
      source.sportingCaptainId!==stake?.sportingCaptainId)
      throw new Error('Mixed preset cannot override manager attack.');
    const physicalOrigin=old.physicalGroup==='peloton'?
      'peloton':prior.physicalRearGroups?.some(group=>
        group.roadId===old.physicalGroup&&
        group.riderDecisions.some(row=>
          row.riderId===riderId))?
        'paid_rear_group':old.physicalGroup.startsWith('solo-')?
          'paid_solo':null;
    if(!physicalOrigin)
      throw new Error('Mixed preset lacks a paid origin.');
    const bonus=(TUNING.effortPressure[order.effort]-1)*20;
    const solo=riderKilometreEffect(entry.rider,segment,{
      phase:'solo',energy:old.energyAfter,
      exposed:segment.exposed});
    const attack=riderKilometreEffect(entry.rider,segment,{
      phase:'attack',energy:old.energyAfter,
      exposed:segment.exposed});
    return {version:V94_PHYSICAL_MIXED_ORIGIN_PRESET_RIDER_VERSION,
      sourceKm:km,riderId,teamId:entry.team.id,
      atDistanceM:(km-1)*1000,
      physicalOrigin,priorPhysicalGroup:old.physicalGroup,
      priorClockSeconds:old.clockSeconds,
      energyAtBoundary:old.energyAfter,
      managerEffort:order.effort,
      managerAttack:order.attack,
      managerBreakWork:order.breakWork,
      sportingGoal:stake.sportingGoal,
      sportingCaptainId:stake.sportingCaptainId,
      sourceAttackReason:source.attackReason,
      sourcePaidExtraCostClaim:source.paidExtraCost,
      perceivedSoloAbility:solo.ability+bonus,
      perceivedAttackAbility:attack.ability+bonus,
      choice:physicalOrigin==='peloton'?
        'pending_paid_peloton_launch':
        'refuse_preset_front_launch_continue_paid_rear',
      paidNewDistanceM:0,paidNewEnergy:0};
  });
  if(!decisions.some(row=>row.physicalOrigin==='peloton')||
    !decisions.some(row=>row.physicalOrigin!=='peloton'))
    throw new Error('Mixed preset needs front and rear origins.');
  return {version:V94_PHYSICAL_MIXED_ORIGIN_PRESET_CHOICE_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    sourceRoadGroupIds:frame.roadGroups.map(row=>row.id),
    decisions,
    pendingPelotonLaunchRiderIds:decisions.filter(row=>
      row.physicalOrigin==='peloton').map(row=>row.riderId),
    declinedSourceFrontLaunchRiderIds:decisions.filter(row=>
      row.physicalOrigin!=='peloton').map(row=>row.riderId),
    sourceRoadGroupNotPhysical:true,
    fullFieldKilometre:false,officialResults:false};
}
