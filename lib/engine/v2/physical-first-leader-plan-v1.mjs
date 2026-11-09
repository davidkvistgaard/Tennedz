// Select one payable front worker from committed orders on a measured road.
// The plan does not move the road or add a rider to it.
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {quoteRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {MOTOR_DRAFT_SHELTER,TUNING} from './tuning.mjs';

export const PHYSICAL_FIRST_LEADER_PLAN_VERSION=
  'physical-first-leader-plan-3';

export function planPhysicalFirstPelotonLeaderV1({prior,segment,
  teams,stakes,emergencyFrontWorkers=[]}){
  const km=prior?.sourceKm+1;
  const road=prior?.roads?.find(row=>row.roadId==='peloton');
  if(!Number.isInteger(km)||segment?.km!==km||
    !Array.isArray(teams)||!Array.isArray(stakes)||
    !Array.isArray(emergencyFrontWorkers)||
    !Array.isArray(prior?.riders)||
    !Array.isArray(road?.riderIds)||!road.riderIds.length||
    !Number.isFinite(road.clockSeconds)||
    new Set(road.riderIds).size!==road.riderIds.length)
    throw new Error('Leader plan needs a measured bunch.');
  const present=new Set(road.riderIds);
  const states=new Map(prior.riders.map(row=>[row.riderId,row]));
  const byStake=new Map(stakes.map(row=>[row.teamId,row]));
  if(states.size!==prior.riders.length||
    byStake.size!==stakes.length)
    throw new Error('Leader plan needs distinct committed inputs.');
  const sources=new Map(teams.flatMap(team=>team.riders.map(
    rider=>[rider.id,{rider,team}])));
  const holdByRider=new Map(road.riderIds.map(riderId=>{
    const source=sources.get(riderId);
    const state=states.get(riderId);
    if(!source||state?.roadId!=='peloton'||
      state.distanceM!==(km-1)*1000||
      Math.abs(state.clockSeconds-road.clockSeconds)>.002||
      !Number.isFinite(state.reserve))
      throw new Error(
        'Leader plan lacks measured rider contact.');
    const order=orderAt(source.team.orders,km-1);
    const ability=riderKilometreEffect(
      source.rider,segment,{phase:'cruise',
        energy:state.reserve,
        exposed:segment.exposed}).ability+
      (TUNING.effortPressure[order.effort]-1)*20+
      MOTOR_DRAFT_SHELTER[segment.terrain];
    return [riderId,ability];
  }));
  const options=[];
  for(const team of teams){
    const order=orderAt(team.orders,km-1);
    if(order.frontWork!=='rotate')continue;
    const stake=byStake.get(team.id);
    if(!stake?.sportingGoal||!stake.sportingCaptainId||
      !Array.isArray(team.orders.helperIds))
      throw new Error('Rotating team lacks a committed sporting stake.');
    const named=order.frontWorkRiderId??null;
    let selectedId=named;
    let emergency=null;
    if(named&&!present.has(named)){
      const plans=emergencyFrontWorkers.filter(row=>
        row.version===1&&row.teamId===team.id&&
        row.unavailableRiderId===named);
      if(plans.length!==1||
        !present.has(plans[0].replacementRiderId))
        throw new Error('Named front worker is absent without a paid emergency replacement.');
      selectedId=plans[0].replacementRiderId;
      emergency={...plans[0],sourceKm:km,
        reason:'committed_worker_absent_from_paid_bunch'};
    }
    if(selectedId&&
      !team.orders.helperIds.includes(selectedId))
      throw new Error('Front worker must be a committed helper.');
    const eligible=team.riders.filter(rider=>
      team.orders.helperIds.includes(rider.id)&&
      present.has(rider.id)&&
      (selectedId===null||rider.id===selectedId)).map(rider=>{
      const state=states.get(rider.id);
      if(state?.roadId!=='peloton'||
        state.distanceM!==(km-1)*1000||
        Math.abs(state.clockSeconds-road.clockSeconds)>.002||
        !Number.isFinite(state.reserve))
        throw new Error('Front worker lacks measured bunch contact.');
      const quote=quoteRearEnergyDemandV1({rider,segment,
        energyBefore:state.reserve,effort:order.effort,
        role:'leader',distanceM:1000});
      const perceivedAbility=riderKilometreEffect(
        rider,segment,{phase:'solo',energy:state.reserve,
          exposed:segment.exposed}).ability+
        (TUNING.effortPressure[order.effort]-1)*20;
      const predictedStartDrops=[...holdByRider].filter(
        ([id,ability])=>id!==rider.id&&
          ability+.002<perceivedAbility).length;
      return {riderId:rider.id,energyBefore:state.reserve,
        energyDemand:quote.energyDemand,perceivedAbility,
        predictedStartDrops};
    }).filter(row=>row.energyDemand<=row.energyBefore+1e-9)
      .sort((a,b)=>
        (order.chase!=='all'?
          a.predictedStartDrops-b.predictedStartDrops:0)||
        b.perceivedAbility-a.perceivedAbility||
        a.riderId.localeCompare(b.riderId));
    if(selectedId&&!eligible.length)
      throw new Error('Named front worker cannot pay the road.');
    if(eligible.length)options.push({team,order,stake,
      worker:eligible[0],emergency});
  }
  if(!options.length)
    throw new Error('No ordered payable bunch leader.');
  options.sort((a,b)=>a.team.id.localeCompare(b.team.id));
  const selected=options[(km-1)%options.length];
  return {version:PHYSICAL_FIRST_LEADER_PLAN_VERSION,
    sourceKm:km,roadId:'peloton',
    leaderRiderId:selected.worker.riderId,
    teamId:selected.team.id,
    teamOrderFrontWork:selected.order.frontWork,
    teamOrderEffort:selected.order.effort,
    managerChase:selected.order.chase,
    sportingGoal:selected.stake.sportingGoal,
    sportingCaptainId:selected.stake.sportingCaptainId,
    perceivedAbilityAtChoice:selected.worker.perceivedAbility,
    predictedStartDrops:
      selected.worker.predictedStartDrops,
    energyBefore:selected.worker.energyBefore,
    quotedPaidWork:selected.worker.energyDemand,
    emergencyFrontWorker:selected.emergency,
    choice:selected.order.frontWorkRiderId==null&&
      selected.order.chase!=='all'?
      'preserve_road_group_with_paid_front':
      'pay_named_or_rotating_front',
    officialResults:false};
}
