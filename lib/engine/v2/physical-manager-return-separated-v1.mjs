// Continue two separately paid riders who both lose the bunch
// after a source-replayed return. Refuse any later unpriced meeting.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalManagerReturnLossV1} from
  './physical-manager-return-loss-v1.mjs';
import {advancePhysicalBunchAfterPostcatchLossKmV1} from
  './physical-start-bunch-v1.mjs';
import {rearSoloPlanAtKmV1} from './rear-solo-commitment-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_MANAGER_RETURN_SEPARATED_VERSION=
  'v2-physical-manager-return-separated-1';
const effortRank={conserve:0,steady:1,hard:2};

export function replayPhysicalManagerReturnSeparatedV1(input){
  const partial=replayPhysicalManagerReturnLossV1(input);
  const {startInput,throughKm}=input;
  if(!Number.isInteger(throughKm)||
    throughKm<=partial.sourceKm||
    throughKm>startInput.routeKilometres.length)
    throw new Error('Return solos need later sourced road.');
  const soloIds=partial.source.loss.splits.map(row=>
    row.riderId);
  if(soloIds.length!==2||
    new Set(soloIds).size!==2||
    !soloIds.includes(partial.source.returnContact.riderId))
    throw new Error('Return solos need two measured splits.');
  const returnedRiderId=partial.source.returnContact.riderId;
  const detachedRiderIds=soloIds.filter(id=>
    id!==returnedRiderId);
  const riderIds=partial.riderIds;
  let previousStates=partial.kilometres.at(-1)
    .riderStates;
  let priorBunch=partial.source.loss;
  let bunchClock=previousStates.find(row=>
    row.physicalGroupId==='peloton').elapsedSeconds;
  const later=[];
  for(let km=partial.sourceKm+1;km<=throughKm;km++){
    const segment=startInput.routeKilometres[km-1];
    const prior={riderIds:priorBunch.physicalGroup
      .riderIds,energyByRider:priorBunch.energyByRider,
    quietKmByRider:priorBunch.quietKmByRider};
    const bunch=advancePhysicalBunchAfterPostcatchLossKmV1({
      startInput,prior,segment,
      caughtRiderId:returnedRiderId,
      detachedRiderIds});
    const nextBunchClock=bunchClock+
      bunch.elapsedSeconds;
    const solos=soloIds.map(riderId=>{
      const previous=previousStates.find(row=>
        row.riderId===riderId);
      const team=startInput.teams.find(row=>
        row.riders.some(rider=>rider.id===riderId));
      const rider=team.riders.find(row=>
        row.id===riderId);
      const plan=startInput.soloCommitments?.find(row=>
        row.riderId===riderId);
      const intent=plan?rearSoloPlanAtKmV1({
        commitment:plan,km}):
        {action:'finish_safely',effort:'conserve'};
      const order=orderAt(team.orders,km-1);
      if(effortRank[intent.effort]===undefined||
        effortRank[intent.effort]>
          effortRank[order.effort])
        throw new Error('Return solo exceeds team order.');
      const effect=riderKilometreEffect(rider,segment,{
        phase:'solo',energy:previous.energyAfter,
        exposed:segment.exposed});
      const ability=effect.ability+
        (TUNING.effortPressure[intent.effort]-1)*20;
      const seconds=segmentBaseSeconds(segment)+
        (50-ability)*MOTOR_RACE_DYNAMICS
          .secondsPerAbilityPoint;
      if(!Number.isFinite(seconds)||seconds<=0)
        throw new Error('Return solo needs paid pace.');
      const paid=priceRearEnergyDemandV1({rider,segment,
        energyBefore:previous.energyAfter,
        effort:intent.effort,role:'solo',
        distanceM:1000});
      const recovery=recoveryForKilometre({
        rider,segment,effort:intent.effort,
        group:'solo',working:true,quietKm:0});
      if(recovery.recovery!==0)
        throw new Error('Return solo cannot claim recovery.');
      const cap=replayRearEnergyCapV1({rider,
        kilometres:startInput.routeKilometres,
        throughKm:km}).cap;
      const energyAfter=+Math.min(cap,
        paid.energyAfter).toFixed(3);
      if(intent.action==='save_for_stage'&&
        energyAfter<intent.committedStagePlan
          .reserveEnergy)
        throw new Error('Return solo breaks stage reserve.');
      const elapsedSeconds=previous.elapsedSeconds+
        seconds;
      if(elapsedSeconds<=nextBunchClock)
        throw new Error('Return solo needs paid bunch contact.');
      return {riderId,sourceKm:km,
        decision:{riderId,goal:intent.action,
          teamOrderEffort:order.effort,
          effort:intent.effort,
          choice:'ride_solo',
          reason:plan?
            'committed_detached_solo_plan':
            'cannot_hold_paid_front_pace'},
        previousElapsedSeconds:previous.elapsedSeconds,
        seconds,elapsedSeconds,
        energyBefore:previous.energyAfter,
        energySpent:paid.energyDemand,
        recoveryAward:0,cap,energyAfter,
        physicalGroupId:`solo-${riderId}`};
    });
    const priorGap=solos[1]
      .previousElapsedSeconds-solos[0]
      .previousElapsedSeconds;
    const nextGap=solos[1].elapsedSeconds-
      solos[0].elapsedSeconds;
    if(priorGap===0||nextGap===0||
      Math.sign(priorGap)!==Math.sign(nextGap))
      throw new Error('Return solos need paid contact.');
    const decisions=new Map(bunch.riderDecisions.map(
      row=>[row.riderId,row]));
    const states=bunch.physicalGroup.riderIds.map(
      riderId=>{
        const row=bunch.riders.find(item=>
          item.riderId===riderId);
        return {riderId,sourceKm:km,
          physicalGroupId:'peloton',
          atDistanceM:km*1000,
          elapsedSeconds:nextBunchClock,
          energyAfter:row.energyAfter,
          decisions:[decisions.get(riderId)]};
      });
    for(const solo of solos)
      states.push({riderId:solo.riderId,
        sourceKm:km,
        physicalGroupId:solo.physicalGroupId,
        atDistanceM:km*1000,
        elapsedSeconds:solo.elapsedSeconds,
        energyAfter:solo.energyAfter,
        decisions:[solo.decision]});
    if(states.length!==riderIds.length||
      new Set(states.map(row=>row.riderId))
        .size!==riderIds.length||
      states.some(row=>!row.decisions[0]||
        row.energyAfter<0))
      throw new Error('Return solo pair lacks rider road.');
    later.push({sourceKm:km,bunch,solos,
      riderStates:states.sort((a,b)=>
        riderIds.indexOf(a.riderId)-
        riderIds.indexOf(b.riderId))});
    previousStates=later.at(-1).riderStates;
    priorBunch=bunch;
    bunchClock=nextBunchClock;
  }
  const kilometres=[...partial.kilometres,
    ...later.map(row=>({sourceKm:row.sourceKm,
      riderStates:row.riderStates}))];
  return {version:PHYSICAL_MANAGER_RETURN_SEPARATED_VERSION,
    throughKm,riderIds:[...riderIds],kilometres,
    sources:{partial,later},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        kilometres.at(-1).riderStates.map(row=>[
          row.riderId,row.elapsedSeconds]))}:{}),
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalManagerReturnSeparatedV1(
input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalManagerReturnSeparatedV1(input)))
    throw new Error('Return solo road differs from paid source.');
  return true;
}
