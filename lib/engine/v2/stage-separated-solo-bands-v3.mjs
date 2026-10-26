import {stageOverlaySlicesForKilometreV3} from './stage-overlay-v3.mjs';
import {evaluateStageSliceRiderV3} from './stage-slice-evaluation-v3.mjs';
import {TUNING} from './tuning.mjs';

const clamp=(value,minimum,maximum)=>Math.max(minimum,
  Math.min(maximum,value));

// Internal calculation for three or more ALREADY separated cooperating solo
// lanes, ordered front to rear. No drafting, passing, merging or finish order.
export function evaluateSeparatedSoloBandsKilometreV3({
  overlay,kilometreIndex,bands,gapsSeconds,baseTerrain,baseGradientPct,
}){
  if(!Array.isArray(bands)||bands.length<3||bands.length>8||
    bands.some(band=>typeof band?.id!=='string'||!band.id||
      band.breakWork!=='cooperate')||
    new Set(bands.map(band=>band.id)).size!==bands.length)
    throw new Error('Three to eight distinct cooperating solo bands are required.');
  if(!Array.isArray(gapsSeconds)||gapsSeconds.length!==bands.length-1||
    gapsSeconds.some(gap=>!Number.isFinite(gap)||gap<=0))
    throw new Error('Every neighboring solo gap must be positive.');
  let energies=bands.map(band=>band.energyBefore);
  let gaps=[...gapsSeconds];
  const frames=[];
  for(const slice of stageOverlaySlicesForKilometreV3(overlay,kilometreIndex)){
    const steps=bands.map((band,index)=>evaluateStageSliceRiderV3({
      slice,rider:band.rider,energyBefore:energies[index],
      effort:band.effort,baseTerrain,baseGradientPct,phase:'solo',
      extraWorkPerKm:TUNING.breakaway.extraCostPerKm}));
    const nextGaps=gaps.map((gap,index)=>gap+clamp(
      (steps[index].ability-steps[index+1].ability)*
        TUNING.breakaway.driftSecondsPerAbilityPoint,
      -TUNING.breakaway.maxPassiveLossSecondsPerKm,
      TUNING.breakaway.maxPassiveGainSecondsPerKm)*slice.distanceKm);
    const possibleContactPairs=nextGaps.flatMap((gap,index)=>gap<=0?
      [{frontId:bands[index].id,rearId:bands[index+1].id}]:[]);
    if(possibleContactPairs.length)return {
      version:3,status:'unresolved_contact',kilometreIndex,
      paidUntilKm:slice.fromKm,energies:bands.map((band,index)=>({
        riderId:band.id,energy:+energies[index].toFixed(6)})),
      gapsSeconds:gaps.map(gap=>+gap.toFixed(6)),
      possibleContactSpan:{fromKm:slice.fromKm,toKm:slice.toKm},
      possibleContactPairs,frames};
    frames.push({fromKm:slice.fromKm,toKm:slice.toKm,
      terrain:steps[0].segment.terrain,
      gradientPct:steps[0].segment.gradientPct,
      surface:steps[0].segment.surface,
      exposed:steps[0].segment.exposed,
      weather:{...steps[0].segment.weather},
      conditionSource:slice.conditions.source,
      featureIds:slice.features.map(feature=>feature.id),
      conditionSpanId:slice.conditionSpanId,
      roadBaselineSeconds:+steps[0].roadBaselineSeconds.toFixed(6),
      riders:bands.map((band,index)=>({riderId:band.id,
        effort:band.effort,ability:steps[index].ability,
        work:+steps[index].work.toFixed(6),
        energyBefore:+energies[index].toFixed(6),
        energyAfter:+steps[index].energyAfter.toFixed(6)})),
      gaps:gaps.map((gap,index)=>({
        frontId:bands[index].id,rearId:bands[index+1].id,
        beforeSeconds:+gap.toFixed(6),
        afterSeconds:+nextGaps[index].toFixed(6)}))});
    energies=steps.map(step=>step.energyAfter);
    gaps=nextGaps;
  }
  return {version:3,status:'separate',kilometreIndex,
    paidUntilKm:Math.min(kilometreIndex+1,overlay.distanceKm),
    energies:bands.map((band,index)=>({
      riderId:band.id,energy:+energies[index].toFixed(6)})),
    gapsSeconds:gaps.map(gap=>+gap.toFixed(6)),frames};
}
