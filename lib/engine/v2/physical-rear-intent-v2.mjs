// Opt-in detached-rider intent from a committed rider plan, manager
// order and current sporting stake. No hidden rival ability is read.
import {orderAt} from './orders.mjs';
import {rearSoloPlanAtKmV1} from
  './rear-solo-commitment-v1.mjs';
import {teamChaseStakeAtKmV1} from
  './team-chase-stake-v1.mjs';

export const PHYSICAL_REAR_INTENT_VERSION=
  'v2-physical-rear-intent-2';
const ACTIVE_STAKES=new Set(['sprint_finish',
  'summit_attack','break_stage']);
const effortRank={conserve:0,steady:1,hard:2};

export function physicalRearIntentAtKmV2({startInput,
  riderId,km}){
  if(startInput?.physicalRearIntentVersion!==2||
    !Number.isInteger(km)||km<1||
    km>startInput.routeKilometres.length)
    throw new Error('Rear intent needs opt-in race kilometre.');
  const team=startInput.teams.find(row=>
    row.riders.some(rider=>rider.id===riderId));
  if(!team)
    throw new Error('Rear intent needs a committed rider.');
  const order=orderAt(team.orders,km-1);
  const stake=teamChaseStakeAtKmV1({
    commitment:startInput.commitment,
    teamId:team.id,km});
  const plan=startInput.soloCommitments?.find(row=>
    row.riderId===riderId);
  const individual=plan?rearSoloPlanAtKmV1({
    commitment:plan,km}):null;
  const namedCaptain=stake.captainId===riderId;
  const activeStake=ACTIVE_STAKES.has(stake.goal);
  const action=individual?.action??
    (namedCaptain&&activeStake?
      'rejoin_bunch':'finish_safely');
  const effort=individual?.effort??order.effort;
  if(effortRank[effort]===undefined||
    effortRank[effort]>effortRank[order.effort])
    throw new Error('Rear intent exceeds manager effort order.');
  return {version:PHYSICAL_REAR_INTENT_VERSION,
    riderId,sourceKm:km,teamId:team.id,
    action,effort,
    teamOrderEffort:order.effort,
    committedTeamStake:stake.goal,
    namedCaptain,
    source:individual?
      'precommitted_rider_plan':
      'committed_manager_order_and_stake',
    ...(individual?.committedStagePlan?{
      committedStagePlan:structuredClone(
        individual.committedStagePlan)}:{})};
}
