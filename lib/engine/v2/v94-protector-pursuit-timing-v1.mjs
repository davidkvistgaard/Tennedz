// A protector judges the recorded front by visible paid pace and its own
// available helpers. This is a forecast for a choice, never a road award.
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const V94_PROTECTOR_PURSUIT_TIMING_VERSION=
  'v94-protector-pursuit-timing-1';

export function decideV94ProtectorPursuitTimingV1({team,stake,
  km,segment,priorSegment,frontSourceKm,frontLeadAbility,
  observedClosingSecondsPerKm,helpers,leadingGapSeconds,
  remainingKm,safeGapSeconds,wasChaser,captainAvailable}){
  if(!team?.id||stake?.teamId!==team.id||
    stake.sportingGoal!=='sprint_finish'||
    !team.riders.some(rider=>rider.id===stake.sportingCaptainId)||
    !Number.isInteger(km)||km<1||segment?.km!==km||
    !Array.isArray(helpers)||helpers.length>2||
    new Set(helpers.map(row=>row.rider?.id)).size!==helpers.length||
    !Number.isFinite(leadingGapSeconds)||leadingGapSeconds<=0||
    !Number.isFinite(remainingKm)||remainingKm<0||
    !Number.isFinite(safeGapSeconds)||safeGapSeconds<0||
    typeof wasChaser!=='boolean'||typeof captainAvailable!=='boolean')
    throw new Error('Invalid sourced protector pursuit choice.');
  const sourceReady=Number.isInteger(frontSourceKm)&&
    frontSourceKm===km-1&&Number.isFinite(frontLeadAbility)&&
    priorSegment?.km===km-1&&
    priorSegment.terrain===segment.terrain&&
    priorSegment.surface===segment.surface&&
    priorSegment.exposed===segment.exposed&&
    Number.isFinite(observedClosingSecondsPerKm);
  const helperAbilities=helpers.map(({rider})=>({riderId:rider.id,
    energyBefore:team.energy[rider.id],
    ability:riderKilometreEffect(rider,segment,{phase:'chase',
      energy:team.energy[rider.id],exposed:segment.exposed}).ability}));
  const ownLeadAbility=helperAbilities.length?
    helperAbilities.reduce((sum,row)=>sum+row.ability,0)/
      helperAbilities.length:null;
  const gainSecondsPerKm=sourceReady&&ownLeadAbility!==null?
    (ownLeadAbility+TUNING.breakaway.bunchDraftAdvantage-
      frontLeadAbility)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint:null;
  const projectedCatchKm=gainSecondsPerKm>0?
    leadingGapSeconds/gainSecondsPerKm:null;
  const choice=!captainAvailable?'hold':
    !helperAbilities.length?'hold':
      !sourceReady?'hold':
        leadingGapSeconds<=safeGapSeconds?'hold':
          projectedCatchKm===null||
            projectedCatchKm>=remainingKm*(wasChaser?.5:.65)?
            'chase':'hold';
  const reason=!captainAvailable?'captain_not_in_peloton':
    !helperAbilities.length?'no_available_helper':
      !sourceReady?'no_comparable_paid_front':
        leadingGapSeconds<=safeGapSeconds?'gap_within_wait_band':
          projectedCatchKm===null?'own_pace_cannot_close':
            choice==='chase'?'catch_horizon_at_risk':
              'catch_horizon_safe';
  return {version:V94_PROTECTOR_PURSUIT_TIMING_VERSION,
    sourceKm:km,teamId:team.id,goal:stake.sportingGoal,
    sportingCaptainId:stake.sportingCaptainId,
    frontSourceKm:sourceReady?frontSourceKm:null,
    observedFrontLeadAbility:sourceReady?frontLeadAbility:null,
    observedClosingSecondsPerKm:sourceReady?
      observedClosingSecondsPerKm:null,
    ownHelpers:helperAbilities.map(row=>({riderId:row.riderId,
      energyBefore:row.energyBefore,
      ability:+row.ability.toFixed(3)})),
    ownLeadAbility:ownLeadAbility===null?null:
      +ownLeadAbility.toFixed(3),
    estimatedGainSecondsPerKm:gainSecondsPerKm===null?null:
      +gainSecondsPerKm.toFixed(3),
    projectedCatchKm:projectedCatchKm===null?null:
      +projectedCatchKm.toFixed(3),
    observedGapSeconds:leadingGapSeconds,
    remainingKm,safeGapSeconds,wasChaser,captainAvailable,
    choice,reason,basis:'own_paid_helpers_and_observed_front_pace',
    movesRoad:false};
}
