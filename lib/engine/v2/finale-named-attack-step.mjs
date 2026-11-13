import {attackCandidate} from './tactics.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {finaleWorkerStep,FINALE_WORKER_PASSIVE_SLOPE_VERSION} from
  './finale-worker.mjs';
import {orderAt} from './orders.mjs';
import {MOTOR_FINALE,TUNING} from './tuning.mjs';

export const FINALE_NAMED_ATTACK_STEP_VERSION=
  'v2-finale-named-attack-step-1';

// One experimental launch slice. The caller must supply the current energy
// and post-decay repeat load from a validated short-step state. This step
// neither chooses rival work nor advances an existing road group.
export function advanceFinaleNamedAttackSlice({slice,route,team,riderId,
  energy,repeatLoad,bunchSpeedKph}){
  const km=slice?.sourceKm;
  const segment=route?.kilometres?.[km-1];
  if(route?.version!==2||!Number.isInteger(km)||segment?.km!==km||
    team?.orders?.version!==2||
    !Number.isInteger(slice.startDistanceM)||
    slice.startDistanceM!==(km-1)*1000||
    !Number.isInteger(slice.lengthM)||slice.lengthM<=0||
    slice.lengthM>1000||
    slice.endDistanceM!==slice.startDistanceM+slice.lengthM||
    !Number.isFinite(energy)||energy<0||energy>100||
    !Number.isFinite(repeatLoad)||repeatLoad<0||
    !Number.isFinite(bunchSpeedKph)||bunchSpeedKph<=0||
    !team?.riders?.some(rider=>rider.id===riderId))
    throw new Error('Invalid named finale attack slice or rider state.');
  if(!finaleDistanceGrid(route).some(allowed=>
    allowed.startDistanceM===slice.startDistanceM&&
    allowed.endDistanceM===slice.endDistanceM&&
    allowed.sourceKm===slice.sourceKm))
    throw new Error('The named finale attack needs an actual finale grid slice.');
  const order=orderAt(team.orders,km-1);
  const namedStart=team.orders.phases.some(phase=>phase.atKm===km-1&&
    (phase.attack!==undefined||phase.attackRiderId!==undefined));
  const cadence=order.attack==='selective'?
    TUNING.attack.selectiveEveryKm:
    order.attack==='repeated'?TUNING.attack.repeatedEveryKm:null;
  if(order.attackRiderId!==riderId||cadence===null||
    !namedStart&&km%cadence!==0)
    throw new Error('The named finale attack is not due at this boundary.');
  const rider=team.riders.find(candidate=>candidate.id===riderId);
  const chosen=attackCandidate({...team,energy:{[riderId]:energy},
    attackLoad:{[riderId]:repeatLoad}},segment,new Set(),riderId);
  if(!chosen)throw new Error('The named finale attacker is not ready.');
  const pressure=chosen.pressure*TUNING.effortPressure[order.effort];
  const worker=finaleWorkerStep({rider,segment,order,energy,role:'front',
    paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
  const attackCost=order.attack==='repeated'?TUNING.attack.repeatedCost:
    TUNING.attack.selectiveCost;
  const energySpent=energyCostForFinaleSlice(slice,
    worker.workCostPerKm+attackCost);
  if(energySpent>energy+1e-9)
    throw new Error('The named finale attacker cannot pay for the launch slice.');
  const bunchSeconds=slice.lengthM*3.6/bunchSpeedKph;
  const baseFrontSeconds=slice.lengthM*3.6/worker.speedKph;
  const lastKm=km===route.distanceKm;
  const launchSeconds=Math.min(pressure*TUNING.attack.pressureToSeconds*
    slice.lengthM/1000*(lastKm?
      MOTOR_FINALE.lastKilometreAttackSecondsFactor:1),
  lastKm?MOTOR_FINALE.maxFreshGapSeconds*slice.lengthM/1000:Infinity);
  const frontSeconds=baseFrontSeconds-launchSeconds;
  if(frontSeconds<=0)
    throw new Error('The named finale launch produced invalid travel time.');
  const earnedGapSeconds=Math.max(0,bunchSeconds-frontSeconds);
  return {version:FINALE_NAMED_ATTACK_STEP_VERSION,
    riderId,teamId:team.id,sourceKm:km,
    startDistanceM:slice.startDistanceM,endDistanceM:slice.endDistanceM,
    status:earnedGapSeconds>0?'split':'contained',
    pressure,repeatLoadAtDecision:repeatLoad,
    repeatLoadAfter:+(repeatLoad+1).toFixed(3),
    energyAtDecision:energy,energySpent,
    energyAfter:Math.max(0,energy-energySpent),
    bunchSeconds,baseFrontSeconds,launchSeconds,frontSeconds,
    earnedGapSeconds};
}
