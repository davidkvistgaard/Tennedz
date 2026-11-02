// Full opt-in source replay after a committed chase catches a front
// rider who physically slides behind the bunch. Any later meeting
// requires another paid contact source.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalPerceivedChaseRaceV1} from
  './physical-perceived-chase-race-replay-v1.mjs';
import {catchPhysicalPerceivedChaseV1} from
  './physical-perceived-chase-contact-v1.mjs';
import {slidePerceivedChaseCaughtFrontV1} from
  './physical-perceived-chase-slide-v1.mjs';
import {advancePhysicalBunchAfterPerceivedCatchKmV1,
  advancePhysicalBunchAfterCaughtSlideKmV1} from
  './physical-start-bunch-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_PERCEIVED_CHASE_SLIDE_RACE_VERSION=
  'v2-physical-perceived-chase-slide-race-1';

function statesForBunch(step,elapsedSeconds){
  const decisions=new Map(step.riderDecisions.map(row=>
    [row.riderId,row]));
  return step.physicalGroup.riderIds.map(riderId=>{
    const row=step.riders.find(item=>item.riderId===riderId);
    return {riderId,sourceKm:step.sourceKm,
      physicalGroupId:'peloton',
      atDistanceM:step.sourceKm*1000,
      elapsedSeconds,energyAfter:row.energyAfter,
      decisions:[decisions.get(riderId)]};
  });
}

function completeKm(riderIds,km,states){
  if(states.length!==riderIds.length||
    new Set(states.map(row=>row.riderId)).size!==riderIds.length||
    states.some(row=>!Number.isFinite(row.elapsedSeconds)||
      !Number.isFinite(row.energyAfter)||
      row.energyAfter<0||row.decisions.some(
        decision=>!decision)||!row.decisions.length))
    throw new Error('Chased slide race lacks rider kilometre.');
  return {sourceKm:km,riderStates:states.sort((a,b)=>
    riderIds.indexOf(a.riderId)-riderIds.indexOf(b.riderId))};
}

export function replayPhysicalPerceivedChaseSlideRaceV1(input){
  const {startInput,start,attackKm,choiceKm,catchKm,
    observerTeamId,nominatedChaseTeamIds,
    conditionalChaseTeamIds=[],throughKm}=input;
  if(!Number.isInteger(throughKm)||throughKm<catchKm||
    throughKm>startInput?.routeKilometres?.length)
    throw new Error('Chased slide race needs sourced finish road.');
  const sourceInput={startInput,start,attackKm,choiceKm,
    observerTeamId,nominatedChaseTeamIds,
    conditionalChaseTeamIds};
  const before=replayPhysicalPerceivedChaseRaceV1({
    ...sourceInput,throughKm:catchKm-1});
  const contact=catchPhysicalPerceivedChaseV1({
    ...sourceInput,catchKm});
  const slide=slidePerceivedChaseCaughtFrontV1({
    ...sourceInput,catchKm,catchRecord:contact});
  const riderId=slide.riderId;
  const team=startInput.teams.find(row=>row.riders.some(rider=>
    rider.id===riderId));
  const rider=team.riders.find(row=>row.id===riderId);
  const riderIds=start.riderIds;
  const kilometres=[...before.kilometres];
  const catchStates=statesForBunch(contact.bunchStep,
    slide.bunchElapsedSeconds);
  catchStates.push({riderId,sourceKm:catchKm,
    physicalGroupId:slide.physicalGroup.id,
    atDistanceM:catchKm*1000,
    elapsedSeconds:slide.elapsedSeconds,
    energyAfter:slide.energyAfter,
    decisions:[contact.frontDecision,slide.decision]});
  kilometres.push(completeKm(riderIds,catchKm,catchStates));
  let priorBunch=contact.bunchStep;
  let bunchElapsedSeconds=slide.bunchElapsedSeconds;
  let soloElapsedSeconds=slide.elapsedSeconds;
  let soloEnergy=slide.energyAfter;
  const later=[];
  for(let km=catchKm+1;km<=throughKm;km++){
    const segment=startInput.routeKilometres[km-1];
    const prior={riderIds:priorBunch.physicalGroup.riderIds,
      energyByRider:priorBunch.energyByRider,
      quietKmByRider:priorBunch.quietKmByRider};
    const chasingTeams=startInput.teams.filter(row=>
      orderAt(row.orders,km-1).frontWork==='rotate');
    if(chasingTeams.length!==1||
      !nominatedChaseTeamIds.includes(chasingTeams[0].id))
      throw new Error('Post-catch work needs nominated named team.');
    const chaseOrder=orderAt(chasingTeams[0].orders,km-1).chase;
    const bunchStep=chaseOrder==='ignore'?
      advancePhysicalBunchAfterCaughtSlideKmV1({
        startInput,prior,segment,caughtRiderId:riderId}):
      advancePhysicalBunchAfterPerceivedCatchKmV1({
        startInput,prior,segment,caughtRiderId:riderId,
        chasingTeamId:chasingTeams[0].id});
    bunchElapsedSeconds+=bunchStep.elapsedSeconds;
    const order=orderAt(team.orders,km-1);
    const effort='conserve';
    const effect=riderKilometreEffect(rider,segment,{
      phase:'solo',energy:soloEnergy,
      exposed:segment.exposed});
    const ability=effect.ability+
      (TUNING.effortPressure[effort]-1)*20;
    const seconds=segmentBaseSeconds(segment)+
      (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
    if(!Number.isFinite(seconds)||seconds<=0)
      throw new Error('Chased slide solo needs physical pace.');
    const price=priceRearEnergyDemandV1({rider,segment,
      energyBefore:soloEnergy,effort,role:'solo',
      distanceM:1000});
    const recovery=recoveryForKilometre({rider,segment,
      effort,group:'dropped',working:false,quietKm:0});
    if(recovery.recovery!==0)
      throw new Error('Chased slide solo cannot claim recovery.');
    const cap=replayRearEnergyCapV1({rider,
      kilometres:startInput.routeKilometres,throughKm:km}).cap;
    const energyAfter=+Math.min(cap,price.energyAfter).toFixed(3);
    soloElapsedSeconds+=seconds;
    if(soloElapsedSeconds<=bunchElapsedSeconds)
      throw new Error('Chased slide solo needs paid return contact.');
    const decision={riderId,goal:'finish_safely',
      teamOrderEffort:order.effort,effort,
      choice:'ride_solo',
      reason:'cannot_hold_paid_bunch_pace'};
    const states=statesForBunch(bunchStep,bunchElapsedSeconds);
    states.push({riderId,sourceKm:km,
      physicalGroupId:`solo-${riderId}`,
      atDistanceM:km*1000,
      elapsedSeconds:soloElapsedSeconds,
      energyAfter,decisions:[decision]});
    kilometres.push(completeKm(riderIds,km,states));
    later.push({sourceKm:km,bunchStep,
      solo:{riderId,decision,seconds,
        elapsedSeconds:soloElapsedSeconds,
        bunchElapsedSeconds,
        energyBefore:soloEnergy,
        energySpent:price.energyDemand,
        recoveryAward:0,cap,energyAfter,
        physicalGroup:{id:`solo-${riderId}`,
          riderIds:[riderId],atDistanceM:km*1000}}});
    priorBunch=bunchStep;
    soloEnergy=energyAfter;
  }
  const last=kilometres.at(-1);
  return {version:PHYSICAL_PERCEIVED_CHASE_SLIDE_RACE_VERSION,
    attackKm,choiceKm,catchKm,throughKm,
    riderIds:[...riderIds],kilometres,
    sources:{before,contact,slide,later},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        last.riderStates.map(row=>[row.riderId,
          row.elapsedSeconds]))}:{}),
    officialResults:false};
}

export function validatePhysicalPerceivedChaseSlideRaceV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalPerceivedChaseSlideRaceV1(input)))
    throw new Error('Chased slide race differs from paid source.');
  return true;
}
