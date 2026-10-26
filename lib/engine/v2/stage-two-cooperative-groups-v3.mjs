import {stageOverlaySlicesForKilometreV3} from './stage-overlay-v3.mjs';
import {evaluateStageSliceRiderV3} from './stage-slice-evaluation-v3.mjs';
import {TUNING} from './tuning.mjs';

const clamp=(value,minimum,maximum)=>Math.max(minimum,
  Math.min(maximum,value));

// A guarded group-CLOCK step for two already separated, fixed cooperative
// groups. It pays each worker once per slice but does not assign internal
// wheels, decide attacks, recover energy, draft, merge or classify a finish.
export function evaluateTwoCooperativeGroupsKilometreV3({
  overlay,kilometreIndex,front,rear,gapSeconds,
  baseTerrain,baseGradientPct,
}){
  const groups=[front,rear];
  if(groups.some(group=>typeof group?.id!=='string'||!group.id||
      !Array.isArray(group.members)||group.members.length<2||
      group.members.length>5)||
    front.id===rear.id||
    new Set(groups.flatMap(group=>group.members.map(member=>
      member?.id))).size!==groups.reduce((sum,group)=>
      sum+group.members.length,0)||
    groups.some(group=>group.members.some(member=>
      typeof member?.id!=='string'||!member.id||
      member.breakWork!=='cooperate'))){
    throw new Error('Two distinct fixed cooperative road groups are required.');
  }
  if(!Number.isFinite(gapSeconds)||gapSeconds<=0)
    throw new Error('Cooperative road-group gap must be positive.');
  const all=groups.flatMap(group=>group.members);
  let energy=new Map(all.map(member=>[member.id,member.energyBefore]));
  let gap=gapSeconds;
  const frames=[];
  for(const slice of stageOverlaySlicesForKilometreV3(overlay,kilometreIndex)){
    const evaluated=groups.map(group=>{
      const workerCost=TUNING.breakaway.extraCostPerKm/
        (1+Math.min(group.members.length-1,
          TUNING.breakaway.maxCooperatingRiders)*
          TUNING.breakaway.rotationReliefPerExtraWorker);
      const members=group.members.map(member=>({
        id:member.id,step:evaluateStageSliceRiderV3({
          slice,rider:member.rider,energyBefore:energy.get(member.id),
          effort:member.effort,baseTerrain,baseGradientPct,phase:'solo',
          extraWorkPerKm:workerCost})}));
      const ability=members.reduce((sum,member)=>
        sum+member.step.ability,0)/members.length+
        Math.min(members.length-1,
          TUNING.breakaway.maxCooperatingRiders)*
        TUNING.breakaway.roadGroupCooperationPerExtraRider;
      return {id:group.id,ability,members};
    });
    const drift=clamp((evaluated[0].ability-evaluated[1].ability)*
      TUNING.breakaway.driftSecondsPerAbilityPoint,
    -TUNING.breakaway.maxPassiveLossSecondsPerKm,
    TUNING.breakaway.maxPassiveGainSecondsPerKm);
    const after=gap+drift*slice.distanceKm;
    if(after<=0)return {version:3,status:'unresolved_group_contact',
      kilometreIndex,paidUntilKm:slice.fromKm,
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
        members:group.members.map(({id,step})=>({
          riderId:id,work:+step.work.toFixed(6),
          energyBefore:+energy.get(id).toFixed(6),
          energyAfter:+step.energyAfter.toFixed(6)}))})),
      gapBeforeSeconds:+gap.toFixed(6),
      gapAfterSeconds:+after.toFixed(6)});
    for(const group of evaluated)for(const {id,step} of group.members)
      energy.set(id,step.energyAfter);
    gap=after;
  }
  return {version:3,status:'separate',kilometreIndex,
    paidUntilKm:Math.min(kilometreIndex+1,overlay.distanceKm),
    frontGroupId:front.id,rearGroupId:rear.id,
    gapSeconds:+gap.toFixed(6),
    energies:all.map(member=>({riderId:member.id,
      energy:+energy.get(member.id).toFixed(6)})),frames};
}
