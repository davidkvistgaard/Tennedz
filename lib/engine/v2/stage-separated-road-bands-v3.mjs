import {stageOverlaySlicesForKilometreV3} from './stage-overlay-v3.mjs';
import {evaluateStageSliceRiderV3} from './stage-slice-evaluation-v3.mjs';
import {projectStageCapacityKilometreV3} from './stage-sliced-capacity-v3.mjs';
import {MOTOR_RECOVERY_CEILING,TUNING} from './tuning.mjs';

export const STAGE_SEPARATED_ROAD_BANDS_VERSION=
  'v3-separated-declared-road-bands-1';
export const STAGE_SEPARATED_ROAD_CAPACITY_VERSION=
  'v3-separated-declared-road-bands-with-capacity-1';
const clamp=(value,minimum,maximum)=>Math.max(minimum,
  Math.min(maximum,value));

// Internal clock for road bands that were already separated before this km.
// A solo must pull. Groups keep fixed membership and declared work positions.
export function evaluateSeparatedRoadBandsKilometreV3({
  overlay,kilometreIndex,bands,gapsSeconds,baseTerrain,baseGradientPct,
  pullRiderIds,driveRiderIds=[],capacityMode=false,
}){
  if(!Array.isArray(bands)||bands.length<3||bands.length>8||
    bands.some(band=>typeof band?.id!=='string'||!band.id||
      !Array.isArray(band.members)||band.members.length<1||
      band.members.length>5)||
    new Set(bands.map(band=>band.id)).size!==bands.length)
    throw new Error('Three to eight distinct fixed road bands are required.');
  const all=bands.flatMap(band=>band.members);
  const ids=new Set(all.map(member=>member?.id));
  if(ids.size!==all.length||all.some(member=>
    typeof member?.id!=='string'||!member.id||
    !Object.hasOwn(TUNING.effortCost,member.effort)))
    throw new Error('Every fixed rider needs a unique id and valid effort.');
  if(!Array.isArray(gapsSeconds)||gapsSeconds.length!==bands.length-1||
    gapsSeconds.some(gap=>!Number.isFinite(gap)||gap<=0))
    throw new Error('Every neighboring road-band gap must be positive.');
  if(!Array.isArray(pullRiderIds)||!Array.isArray(driveRiderIds)||
    new Set(pullRiderIds).size!==pullRiderIds.length||
    new Set(driveRiderIds).size!==driveRiderIds.length||
    pullRiderIds.some(id=>!ids.has(id))||
    driveRiderIds.some(id=>!pullRiderIds.includes(id))||
    bands.some(band=>band.members.length===1&&
      !pullRiderIds.includes(band.members[0].id)))
    throw new Error('Declared pulls and drives are invalid; solos must pull.');
  const pulls=new Set(pullRiderIds),drives=new Set(driveRiderIds);
  let energy=new Map(all.map(member=>[member.id,member.energyBefore]));
  const slices=stageOverlaySlicesForKilometreV3(overlay,kilometreIndex);
  const capacityPlans=capacityMode?new Map(all.map(member=>[
    member.id,projectStageCapacityKilometreV3({overlay,kilometreIndex,
      rider:member.rider,energyCapBefore:member.energyCapBefore,
      baseTerrain,baseGradientPct})])):null;
  if(capacityMode&&all.some(member=>!Number.isFinite(member.energyBefore)||
    member.energyBefore>member.energyCapBefore))
    throw new Error('Each rider needs energy within the issued capacity.');
  let capacities=capacityMode?new Map(all.map(member=>[
    member.id,member.energyCapBefore])):null;
  const version=capacityMode?STAGE_SEPARATED_ROAD_CAPACITY_VERSION:
    STAGE_SEPARATED_ROAD_BANDS_VERSION;
  const capacityRows=()=>capacityMode?{capacities:all.map(member=>({
    riderId:member.id,energyCap:+capacities.get(member.id).toFixed(6)}))}:{};
  let gaps=[...gapsSeconds];
  const frames=[];
  for(const [sliceIndex,slice] of slices.entries()){
    let evaluatingRiderId=null;
    let clocks;
    try{clocks=bands.map(band=>{
      const workers=band.members.filter(member=>pulls.has(member.id));
      const workerCost=TUNING.breakaway.extraCostPerKm/
        (1+Math.min(Math.max(0,workers.length-1),
          TUNING.breakaway.maxCooperatingRiders)*
          TUNING.breakaway.rotationReliefPerExtraWorker);
      const members=band.members.map(member=>{
        evaluatingRiderId=member.id;
        const step=evaluateStageSliceRiderV3({slice,rider:member.rider,
          energyBefore:energy.get(member.id),effort:member.effort,
          baseTerrain,baseGradientPct,phase:'solo',
          extraWorkPerKm:pulls.has(member.id)?workerCost+
            (drives.has(member.id)?TUNING.breakaway.driveExtraCostPerKm:0):
            TUNING.breakaway.sitOnExtraCostPerKm});
        if(!capacityMode)return {id:member.id,step};
        const plan=capacityPlans.get(member.id);
        const capAfter=sliceIndex===slices.length-1?plan.energyCapAfter:
          Math.max(MOTOR_RECOVERY_CEILING.minEnergyCap,
            capacities.get(member.id)-plan.frames[sliceIndex].decay);
        return {id:member.id,step,capAfter,
          energyAfter:Math.min(step.energyAfter,capAfter),
          capAdjustment:Math.max(0,step.energyAfter-capAfter)};
      });
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
      return {bandId:band.id,ability,members,
        pullRiderIds:workers.map(member=>member.id),
        driveRiderIds:workers.filter(member=>drives.has(member.id))
          .map(member=>member.id)};
    });}catch(error){
      if(error?.code!=='STAGE_EXHAUSTED_RIDER'||!evaluatingRiderId)
        throw error;
      return {version,
        status:'unresolved_exhaustion',kilometreIndex,
        paidUntilKm:slice.fromKm,
        possibleExhaustionSpan:{fromKm:slice.fromKm,toKm:slice.toKm},
        exhaustedRiderId:evaluatingRiderId,
        gapsSeconds:gaps.map(gap=>+gap.toFixed(6)),
        energies:all.map(member=>({riderId:member.id,
          energy:+energy.get(member.id).toFixed(6)})),
        ...capacityRows(),frames};
    }
    const after=gaps.map((gap,index)=>gap+clamp(
      (clocks[index].ability-clocks[index+1].ability)*
        TUNING.breakaway.driftSecondsPerAbilityPoint,
      -TUNING.breakaway.maxPassiveLossSecondsPerKm,
      TUNING.breakaway.maxPassiveGainSecondsPerKm)*slice.distanceKm);
    const possibleContactPairs=after.flatMap((gap,index)=>gap<=0?
      [{frontBandId:bands[index].id,rearBandId:bands[index+1].id}]:[]);
    if(possibleContactPairs.length)return {
      version,
      status:'unresolved_band_contact',kilometreIndex,
      paidUntilKm:slice.fromKm,
      possibleContactSpan:{fromKm:slice.fromKm,toKm:slice.toKm},
      possibleContactPairs,
      gapsSeconds:gaps.map(gap=>+gap.toFixed(6)),
      energies:all.map(member=>({riderId:member.id,
        energy:+energy.get(member.id).toFixed(6)})),
      ...capacityRows(),frames};
    frames.push({fromKm:slice.fromKm,toKm:slice.toKm,
      terrain:clocks[0].members[0].step.segment.terrain,
      gradientPct:clocks[0].members[0].step.segment.gradientPct,
      surface:clocks[0].members[0].step.segment.surface,
      exposed:clocks[0].members[0].step.segment.exposed,
      weather:{...clocks[0].members[0].step.segment.weather},
      conditionSource:slice.conditions.source,
      featureIds:slice.features.map(feature=>feature.id),
      conditionSpanId:slice.conditionSpanId,
      roadBaselineSeconds:+clocks[0].members[0].step
        .roadBaselineSeconds.toFixed(6),
      bandClocks:clocks.map(clock=>({bandId:clock.bandId,
        ability:+clock.ability.toFixed(6),
        pullRiderIds:clock.pullRiderIds,
        driveRiderIds:clock.driveRiderIds,
        members:clock.members.map(({id,step,capAfter,energyAfter,
          capAdjustment})=>({riderId:id,
          work:+step.work.toFixed(6),
          energyBefore:+energy.get(id).toFixed(6),
          energyAfter:+(capacityMode?energyAfter:step.energyAfter).toFixed(6),
          ...(capacityMode?{
            energyCapBefore:+capacities.get(id).toFixed(6),
            energyCapAfter:+capAfter.toFixed(6),
            capAdjustment:+capAdjustment.toFixed(6)}:{})}))})),
      gaps:gaps.map((gap,index)=>({frontBandId:bands[index].id,
        rearBandId:bands[index+1].id,
        beforeSeconds:+gap.toFixed(6),afterSeconds:+after[index].toFixed(6)}))});
    for(const clock of clocks)for(const member of clock.members){
      energy.set(member.id,capacityMode?member.energyAfter:
        member.step.energyAfter);
      if(capacityMode)capacities.set(member.id,member.capAfter);
    }
    gaps=after;
  }
  return {version,
    status:'separate',kilometreIndex,
    paidUntilKm:Math.min(kilometreIndex+1,overlay.distanceKm),
    gapsSeconds:gaps.map(gap=>+gap.toFixed(6)),
    energies:all.map(member=>({riderId:member.id,
      energy:+energy.get(member.id).toFixed(6)})),
    ...capacityRows(),frames};
}

// This path is opt-in so old fixed-band recordings retain their exact shape.
export function evaluateSeparatedRoadBandsWithCapacityKilometreV3(args){
  return evaluateSeparatedRoadBandsKilometreV3({...args,capacityMode:true});
}
