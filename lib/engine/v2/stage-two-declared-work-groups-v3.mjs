import {stageOverlaySlicesForKilometreV3} from './stage-overlay-v3.mjs';
import {evaluateStageSliceRiderV3} from './stage-slice-evaluation-v3.mjs';
import {TUNING} from './tuning.mjs';

export const STAGE_TWO_DECLARED_WORK_GROUPS_VERSION=
  'v3-two-declared-work-groups-1';
const clamp=(value,minimum,maximum)=>Math.max(minimum,
  Math.min(maximum,value));

// Internal fixed-roster group clock. The caller supplies who actually pulls
// or drives; it does not infer riders' wheel positions or choose their work.
export function evaluateTwoDeclaredWorkGroupsKilometreV3({
  overlay,kilometreIndex,front,rear,gapSeconds,baseTerrain,baseGradientPct,
  pullRiderIds,driveRiderIds=[],
}){
  const groups=[front,rear];
  if(groups.some(group=>typeof group?.id!=='string'||!group.id||
      !Array.isArray(group.members)||group.members.length<2||
      group.members.length>5)||front.id===rear.id)
    throw new Error('Two distinct fixed road groups of 2–5 riders are required.');
  const all=groups.flatMap(group=>group.members);
  const ids=new Set(all.map(member=>member?.id));
  if(ids.size!==all.length||all.some(member=>
    typeof member?.id!=='string'||!member.id||
    !Object.hasOwn(TUNING.effortCost,member.effort)))
    throw new Error('Every fixed rider needs a unique id and valid effort.');
  if(!Array.isArray(pullRiderIds)||!Array.isArray(driveRiderIds)||
    new Set(pullRiderIds).size!==pullRiderIds.length||
    new Set(driveRiderIds).size!==driveRiderIds.length||
    pullRiderIds.some(id=>!ids.has(id))||
    driveRiderIds.some(id=>!pullRiderIds.includes(id)))
    throw new Error('Explicit pulls must be unique riders; drives must be pulls.');
  if(!Number.isFinite(gapSeconds)||gapSeconds<=0)
    throw new Error('Separated road-group gap must be positive.');
  const pulls=new Set(pullRiderIds),drives=new Set(driveRiderIds);
  let energy=new Map(all.map(member=>[member.id,member.energyBefore]));
  let gap=gapSeconds;
  const frames=[];
  for(const slice of stageOverlaySlicesForKilometreV3(overlay,kilometreIndex)){
    const evaluated=groups.map(group=>{
      const workers=group.members.filter(member=>pulls.has(member.id));
      const workerCost=TUNING.breakaway.extraCostPerKm/
        (1+Math.min(Math.max(0,workers.length-1),
          TUNING.breakaway.maxCooperatingRiders)*
          TUNING.breakaway.rotationReliefPerExtraWorker);
      const members=group.members.map(member=>({id:member.id,
        step:evaluateStageSliceRiderV3({slice,rider:member.rider,
          energyBefore:energy.get(member.id),effort:member.effort,
          baseTerrain,baseGradientPct,phase:'solo',
          extraWorkPerKm:pulls.has(member.id)?workerCost+
            (drives.has(member.id)?TUNING.breakaway.driveExtraCostPerKm:0):
            TUNING.breakaway.sitOnExtraCostPerKm})}));
      const selected=workers.length?members.filter(member=>
        pulls.has(member.id)):members;
      const ability=selected.reduce((sum,member)=>
        sum+member.step.ability+
          (drives.has(member.id)?TUNING.breakaway.driveAbilityBonusPoints:0),
      0)/selected.length+
        (workers.length?Math.min(workers.length-1,
          TUNING.breakaway.maxCooperatingRiders)*
          TUNING.breakaway.roadGroupCooperationPerExtraRider:
          -TUNING.breakaway.noWorkPenaltyPoints);
      return {id:group.id,ability,members,
        pullRiderIds:workers.map(member=>member.id),
        driveRiderIds:workers.filter(member=>drives.has(member.id))
          .map(member=>member.id)};
    });
    const drift=clamp((evaluated[0].ability-evaluated[1].ability)*
      TUNING.breakaway.driftSecondsPerAbilityPoint,
    -TUNING.breakaway.maxPassiveLossSecondsPerKm,
    TUNING.breakaway.maxPassiveGainSecondsPerKm);
    const after=gap+drift*slice.distanceKm;
    if(after<=0)return {version:STAGE_TWO_DECLARED_WORK_GROUPS_VERSION,
      status:'unresolved_group_contact',kilometreIndex,
      paidUntilKm:slice.fromKm,
      possibleContactSpan:{fromKm:slice.fromKm,toKm:slice.toKm},
      frontGroupId:front.id,rearGroupId:rear.id,
      gapSeconds:+gap.toFixed(6),
      energies:all.map(member=>({riderId:member.id,
        energy:+energy.get(member.id).toFixed(6)})),frames};
    frames.push({fromKm:slice.fromKm,toKm:slice.toKm,
      terrain:evaluated[0].members[0].step.segment.terrain,
      gradientPct:evaluated[0].members[0].step.segment.gradientPct,
      surface:evaluated[0].members[0].step.segment.surface,
      exposed:evaluated[0].members[0].step.segment.exposed,
      weather:{...evaluated[0].members[0].step.segment.weather},
      conditionSource:slice.conditions.source,
      featureIds:slice.features.map(feature=>feature.id),
      conditionSpanId:slice.conditionSpanId,
      roadBaselineSeconds:+evaluated[0].members[0].step
        .roadBaselineSeconds.toFixed(6),
      groupClocks:evaluated.map(group=>({groupId:group.id,
        ability:+group.ability.toFixed(6),
        pullRiderIds:group.pullRiderIds,
        driveRiderIds:group.driveRiderIds,
        members:group.members.map(({id,step})=>({riderId:id,
          work:+step.work.toFixed(6),
          energyBefore:+energy.get(id).toFixed(6),
          energyAfter:+step.energyAfter.toFixed(6)}))})),
      gapBeforeSeconds:+gap.toFixed(6),
      gapAfterSeconds:+after.toFixed(6)});
    for(const group of evaluated)for(const {id,step} of group.members)
      energy.set(id,step.energyAfter);
    gap=after;
  }
  return {version:STAGE_TWO_DECLARED_WORK_GROUPS_VERSION,
    status:'separate',kilometreIndex,
    paidUntilKm:Math.min(kilometreIndex+1,overlay.distanceKm),
    frontGroupId:front.id,rearGroupId:rear.id,
    gapSeconds:+gap.toFixed(6),
    energies:all.map(member=>({riderId:member.id,
      energy:+energy.get(member.id).toFixed(6)})),frames};
}
