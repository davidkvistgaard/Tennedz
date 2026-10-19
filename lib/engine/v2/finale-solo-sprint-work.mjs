import {FINALE_SPRINT_WORK_COST_PER_KM} from
  './finale-sprint-launch.mjs';
import {segmentBaseSeconds} from './finish.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

// The already recorded singleton sprint rule, applied to one exposed 100 m
// passage. Callers own their road clock and must audit any resulting contact.
export function paidSoloSprintPassage(rider,segment,energyAtDecision){
  const effect=riderKilometreEffect(rider,segment,{
    phase:'finale',energy:energyAtDecision,exposed:segment.exposed});
  const workCostPerKm=FINALE_SPRINT_WORK_COST_PER_KM*
    effect.energyCostMultiplier;
  const speedKph=3600/(segmentBaseSeconds(segment)+
    (50-effect.ability-
      TUNING.finish.finaleEffortAbilityPoints.hard)*
      TUNING.breakaway.driftSecondsPerAbilityPoint);
  const durationSeconds=360/speedKph;
  const energySpent=workCostPerKm*.1;
  return {durationSeconds,energySpent,
    energyAfter:energyAtDecision-energySpent};
}
