import {stageOverlaySlicesForKilometreV3} from './stage-overlay-v3.mjs';
import {MOTOR_RECOVERY_CEILING} from './tuning.mjs';

export const STAGE_SLICED_CAPACITY_VERSION=
  'v3-stage-sliced-race-capacity-projection-1';

// Project the v2 long-day capacity rule over exact stage distances. This
// changes no rider state; callers still have to pay work and settle recovery.
export function projectStageCapacityKilometreV3({overlay,kilometreIndex,
  rider,energyCapBefore,baseTerrain,baseGradientPct}){
  if(!['flat','hill','climb','descent'].includes(baseTerrain)||
    !Number.isFinite(baseGradientPct))
    throw new Error('Explicit baseline terrain and gradient are required.');
  if(!Number.isFinite(rider?.endurance)||rider.endurance<0||
    rider.endurance>100||!Number.isFinite(energyCapBefore)||
    energyCapBefore<MOTOR_RECOVERY_CEILING.minEnergyCap||
    energyCapBefore>100)
    throw new Error('Rider endurance and current race capacity are required.');
  const slices=stageOverlaySlicesForKilometreV3(overlay,kilometreIndex);
  const active=kilometreIndex+1>MOTOR_RECOVERY_CEILING.afterKm;
  const frames=slices.map(slice=>{
    const topography=slice.features.filter(feature=>
      feature.kind==='climb'||feature.kind==='descent');
    if(topography.length>1||topography.some(feature=>
      !Number.isFinite(feature.gradientPct)))
      throw new Error('Capacity decay needs resolved slice topography.');
    const feature=topography[0];
    const gradientPct=feature?.gradientPct??baseGradientPct;
    const terrainLoad=1+Math.max(0,gradientPct)*.035+
      (slice.conditions.surface==='road'?0:.15);
    const decay=active?
      (MOTOR_RECOVERY_CEILING.capDecayBasePerKm+
      (100-rider.endurance)*
        MOTOR_RECOVERY_CEILING.enduranceDeficitPerPoint)*
      terrainLoad*slice.distanceKm:0;
    return {fromKm:slice.fromKm,toKm:slice.toKm,
      featureIds:slice.features.map(entry=>entry.id),
      conditionSpanId:slice.conditionSpanId,
      terrainLoad:+terrainLoad.toFixed(6),decay:+decay.toFixed(6)};
  });
  const decayDemand=frames.reduce((sum,frame)=>sum+frame.decay,0);
  const energyCapAfter=+Math.min(energyCapBefore,
    Math.max(MOTOR_RECOVERY_CEILING.minEnergyCap,
      energyCapBefore-decayDemand)).toFixed(3);
  return {version:STAGE_SLICED_CAPACITY_VERSION,kilometreIndex,
    active,energyCapBefore,energyCapAfter,
    decayDemand:+decayDemand.toFixed(6),frames,
    scope:'capacity projection only; work, recovery and movement are not applied'};
}
