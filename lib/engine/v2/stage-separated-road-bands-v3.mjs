import {stageOverlaySlicesForKilometreV3} from './stage-overlay-v3.mjs';
import {evaluateStageSliceRiderV3} from './stage-slice-evaluation-v3.mjs';
import {TUNING} from './tuning.mjs';

export const STAGE_SEPARATED_ROAD_BANDS_VERSION=
  'v3-separated-declared-road-bands-1';
const clamp=(value,minimum,maximum)=>Math.max(minimum,
  Math.min(maximum,value));

// Internal clock for road bands that were already separated before this km.
// A solo must pull. Groups keep fixed membership and declared work positions.
export function evaluateSeparatedRoadBandsKilometreV3({
  overlay,kilometreIndex,bands,gapsSeconds,baseTerrain,baseGradientPct,
  pullRiderIds,driveRiderIds=[],
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
  let gaps=[...gapsSeconds];
  const frames=[];
  for(const slice of stageOverlaySlicesForKilometreV3(overlay,kilometreIndex)){
    const clocks=bands.map(band=>{
      const workers=band.members.filter(member=>pulls.has(member.id));
      const workerCost=TUNING.breakaway.extraCostPerKm/
        (1+Math.min(Math.max(0,workers.length-1),
          TUNING.breakaway.maxCooperatingRiders)*
          TUNING.breakaway.rotationReliefPerExtraWorker);
      const members=band.members.map(member=>({id:member.id,
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
      return {bandId:band.id,ability,members,
        pullRiderIds:workers.map(member=>member.id),
        driveRiderIds:workers.filter(member=>drives.has(member.id))
          .map(member=>member.id)};
    });
    const after=gaps.map((gap,index)=>gap+clamp(
      (clocks[index].ability-clocks[index+1].ability)*
        TUNING.breakaway.driftSecondsPerAbilityPoint,
      -TUNING.breakaway.maxPassiveLossSecondsPerKm,
      TUNING.breakaway.maxPassiveGainSecondsPerKm)*slice.distanceKm);
    const possibleContactPairs=after.flatMap((gap,index)=>gap<=0?
      [{frontBandId:bands[index].id,rearBandId:bands[index+1].id}]:[]);
    if(possibleContactPairs.length)return {
      version:STAGE_SEPARATED_ROAD_BANDS_VERSION,
      status:'unresolved_band_contact',kilometreIndex,
      paidUntilKm:slice.fromKm,
      possibleContactSpan:{fromKm:slice.fromKm,toKm:slice.toKm},
      possibleContactPairs,
      gapsSeconds:gaps.map(gap=>+gap.toFixed(6)),
      energies:all.map(member=>({riderId:member.id,
        energy:+energy.get(member.id).toFixed(6)})),frames};
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
        members:clock.members.map(({id,step})=>({riderId:id,
          work:+step.work.toFixed(6),
          energyBefore:+energy.get(id).toFixed(6),
          energyAfter:+step.energyAfter.toFixed(6)}))})),
      gaps:gaps.map((gap,index)=>({frontBandId:bands[index].id,
        rearBandId:bands[index+1].id,
        beforeSeconds:+gap.toFixed(6),afterSeconds:+after[index].toFixed(6)}))});
    for(const clock of clocks)for(const {id,step} of clock.members)
      energy.set(id,step.energyAfter);
    gaps=after;
  }
  return {version:STAGE_SEPARATED_ROAD_BANDS_VERSION,
    status:'separate',kilometreIndex,
    paidUntilKm:Math.min(kilometreIndex+1,overlay.distanceKm),
    gapsSeconds:gaps.map(gap=>+gap.toFixed(6)),
    energies:all.map(member=>({riderId:member.id,
      energy:+energy.get(member.id).toFixed(6)})),frames};
}
