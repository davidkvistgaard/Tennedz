// Choose the single worker for an already measured rear road.
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {quoteRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {MOTOR_DRAFT_SHELTER,TUNING} from './tuning.mjs';

export const PHYSICAL_FIRST_REAR_LEADER_PLAN_VERSION=
  'physical-first-rear-leader-plan-1';
const EPS=.002;

export function planPhysicalFirstRearLeaderV1({prior,roadId,
  segment,teams,stakes}){
  const km=prior?.sourceKm+1;
  const road=prior?.roads?.find(row=>row.roadId===roadId);
  if(!Number.isInteger(km)||segment?.km!==km||
    roadId==='peloton'||!Array.isArray(road?.riderIds)||
    road.riderIds.length<2||
    new Set(road.riderIds).size!==road.riderIds.length||
    !Number.isFinite(road.clockSeconds)||
    !Array.isArray(prior?.riders)||
    !Array.isArray(teams)||!Array.isArray(stakes))
    throw new Error('Rear leader needs a measured shared road.');
  const sources=new Map(teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const states=new Map(prior.riders.map(row=>
    [row.riderId,row]));
  const byStake=new Map(stakes.map(row=>
    [row.teamId,row]));
  const members=road.riderIds.map(riderId=>{
    const source=sources.get(riderId);
    const state=states.get(riderId);
    const order=source&&orderAt(source.team.orders,km-1);
    const stake=byStake.get(source?.team.id);
    if(!source||state?.roadId!==roadId||
      state.distanceM!==(km-1)*1000||
      Math.abs(state.clockSeconds-road.clockSeconds)>EPS||
      !Number.isFinite(state.reserve)||
      !order?.effort||!order.breakWork||
      !stake?.sportingGoal||!stake.sportingCaptainId)
      throw new Error(
        'Rear leader lacks paid rider state or order.');
    const effortBonus=(TUNING.effortPressure[
      order.effort]-1)*20;
    const soloAbility=riderKilometreEffect(
      source.rider,segment,{phase:'solo',
        energy:state.reserve,
        exposed:segment.exposed}).ability+effortBonus;
    const shelterAbility=riderKilometreEffect(
      source.rider,segment,{phase:'cruise',
        energy:state.reserve,
        exposed:segment.exposed}).ability+effortBonus+
      MOTOR_DRAFT_SHELTER[segment.terrain];
    const shelterQuote=quoteRearEnergyDemandV1({
      rider:source.rider,segment,
      energyBefore:state.reserve,
      effort:order.effort,role:'sheltered',
      distanceM:1000});
    const shelterEndAbility=
      shelterQuote.energyDemand>state.reserve+1e-9?
        -Infinity:riderKilometreEffect(
      source.rider,segment,{phase:'cruise',
        energy:state.reserve-
          shelterQuote.energyDemand,
        exposed:segment.exposed}).ability+effortBonus+
      MOTOR_DRAFT_SHELTER[segment.terrain];
    return {riderId,source,state,order,stake,
      soloAbility,shelterAbility,
      shelterEndAbility,shelterQuote};
  });
  const options=members.filter(row=>
    row.order.breakWork!=='sit_on').map(row=>{
    if(row.order.breakWork==='drive')
      throw new Error(
        'Rear drive order needs physical-first work pricing.');
    const leaderQuote=quoteRearEnergyDemandV1({
      rider:row.source.rider,segment,
      energyBefore:row.state.reserve,
      effort:row.order.effort,role:'leader',
      distanceM:1000});
    const canPay=leaderQuote.energyDemand<=
      row.state.reserve+1e-9;
    const canShelter=members.every(other=>
      other===row||(
        other.shelterQuote.energyDemand<=
          other.state.reserve+1e-9&&
        other.shelterAbility+EPS>=
          row.soloAbility&&
        other.shelterEndAbility+EPS>=
          row.soloAbility));
    return {row,leaderQuote,canPay,canShelter};
  }).filter(option=>option.canPay&&
    option.canShelter).sort((a,b)=>
    b.row.soloAbility-a.row.soloAbility||
    a.row.riderId.localeCompare(b.row.riderId));
  if(!options.length)
    throw new Error(
      'Rear contact lacks one payable shelter-compatible leader.');
  const {row,leaderQuote}=options[0];
  return {version:PHYSICAL_FIRST_REAR_LEADER_PLAN_VERSION,
    sourceKm:km,roadId,
    leaderRiderId:row.riderId,
    teamId:row.source.team.id,
    teamOrderEffort:row.order.effort,
    teamOrderBreakWork:row.order.breakWork,
    sportingGoal:row.stake.sportingGoal,
    sportingCaptainId:row.stake.sportingCaptainId,
    perceivedAbilityAtChoice:row.soloAbility,
    quotedPaidWork:leaderQuote.energyDemand,
    shelteredRiderIds:road.riderIds.filter(
      id=>id!==row.riderId),
    choice:'pay_rear_group_lead',
    officialResults:false};
}
