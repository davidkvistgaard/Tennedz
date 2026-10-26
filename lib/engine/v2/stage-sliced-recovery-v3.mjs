import {recoveryForKilometre} from './recovery.mjs';
import {stageOverlaySlicesForKilometreV3} from './stage-overlay-v3.mjs';

export const STAGE_SLICED_RECOVERY_VERSION=
  'v3-whole-kilometre-quiet-recovery-projection-1';

// A quiet kilometre must be calm along every exact slice. This projects the
// existing once-per-km recovery rule; it does not spend energy or move riders.
export function projectStageRecoveryKilometreV3({overlay,kilometreIndex,
  rider,effort,group,working=false,quietKm=0,baseTerrain,baseGradientPct}){
  if(!['flat','hill','climb','descent'].includes(baseTerrain)||
    !Number.isFinite(baseGradientPct))
    throw new Error('Explicit baseline terrain and gradient are required.');
  const slices=stageOverlaySlicesForKilometreV3(overlay,kilometreIndex);
  let blocked=null;
  for(const slice of slices){
    const topography=slice.features.filter(feature=>
      feature.kind==='climb'||feature.kind==='descent');
    if(topography.length>1||topography.some(feature=>
      !Number.isFinite(feature.gradientPct)))
      throw new Error('Recovery needs resolved slice topography.');
    const feature=topography[0];
    const segment={terrain:feature?.kind??baseTerrain,
      gradientPct:feature?.gradientPct??baseGradientPct,
      surface:slice.conditions.surface,exposed:slice.conditions.exposed,
      weather:slice.conditions.weather};
    const state=recoveryForKilometre({rider,segment,effort,group,
      working,quietKm});
    if(state.quietKm===0&&!blocked){blocked={fromKm:slice.fromKm,toKm:slice.toKm,
      featureIds:slice.features.map(entry=>entry.id),
      conditionSpanId:slice.conditionSpanId};
    }
  }
  const result=blocked?{quietKm:0,recovery:0}:
    recoveryForKilometre({rider,segment:{terrain:'flat',gradientPct:0,
      surface:'road',exposed:false,weather:{windKph:0,rainMm:0}},
    effort,group,working,quietKm});
  return {version:STAGE_SLICED_RECOVERY_VERSION,kilometreIndex,
    quietKmBefore:quietKm,quietKmAfter:result.quietKm,
    recoveryPotential:result.recovery,blockingSpan:blocked,
    scope:'recovery eligibility only; energy cap and movement are not applied'};
}

// Settle a previously projected once-per-km award only after paid slice work.
// The current cap is supplied explicitly because it may have decayed earlier
// in the kilometre; this function never manufactures that cap transition.
export function settleStageRecoveryKilometreV3({projection,
  energyAfterPaidWork,energyCap}){
  if(projection?.version!==STAGE_SLICED_RECOVERY_VERSION||
    !Number.isFinite(projection.recoveryPotential)||
    projection.recoveryPotential<0||
    !Number.isInteger(projection.quietKmAfter)||
    projection.quietKmAfter<0)
    throw new Error('A valid v3 recovery projection is required.');
  if(!Number.isFinite(energyCap)||energyCap<0||energyCap>100||
    !Number.isFinite(energyAfterPaidWork)||energyAfterPaidWork<0||
    energyAfterPaidWork>energyCap)
    throw new Error('Paid energy and the current race capacity are required.');
  const recoveryApplied=Math.min(projection.recoveryPotential,
    energyCap-energyAfterPaidWork);
  return {version:STAGE_SLICED_RECOVERY_VERSION,
    kilometreIndex:projection.kilometreIndex,
    energyAfterPaidWork,energyCap,
    recoveryPotential:projection.recoveryPotential,
    recoveryApplied:+recoveryApplied.toFixed(6),
    capAdjustment:+(projection.recoveryPotential-recoveryApplied).toFixed(6),
    energyAfter:+(energyAfterPaidWork+recoveryApplied).toFixed(6),
    quietKmAfter:projection.quietKmAfter,
    scope:'energy settlement only; rider and road movement are not applied'};
}
