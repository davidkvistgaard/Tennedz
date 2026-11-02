// Whole-road diagnostic for a precommitted manager chase that the
// experimental tactical policy declined. Every rider still pays
// through observed finish; guided racing remains unchanged.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalManagerChaseCounterfactualV1} from
  './physical-manager-chase-counterfactual-v1.mjs';
import {completePhysicalManagerChaseContactKmV1} from
  './physical-manager-chase-contact-km-v1.mjs';
import {advancePhysicalBunchAfterPerceivedCatchKmV1,
  advancePhysicalBunchAfterCaughtSlideKmV1,
  advancePhysicalBunchAfterCaughtSlideLossKmV1,
  validatePhysicalBunchAfterCaughtSlideLossKmV1} from
  './physical-start-bunch-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {completePhysicalPostCatchLossKmV1,
  validatePhysicalPostCatchLossKmV1} from
  './physical-pace-loss-completion-v1.mjs';
import {contactPhysicalPostcatchSplitV1,
  validatePhysicalPostcatchSplitContactV1} from
  './physical-postcatch-split-contact-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_MANAGER_CHASE_RACE_REPLAY_VERSION=
  'v2-physical-manager-chase-race-replay-1';

function bunchStates(step,elapsedSeconds){
  const decisions=new Map(step.riderDecisions.map(row=>
    [row.riderId,row]));
  return step.physicalGroup.riderIds.map(riderId=>{
    const row=step.riders.find(item=>
      item.riderId===riderId);
    return {riderId,sourceKm:step.sourceKm,
      physicalGroupId:'peloton',
      atDistanceM:step.sourceKm*1000,
      elapsedSeconds,energyAfter:row.energyAfter,
      decisions:[decisions.get(riderId)]};
  });
}

function fullKm(riderIds,km,states){
  if(states.length!==riderIds.length||
    new Set(states.map(row=>row.riderId)).size!==
      riderIds.length||states.some(row=>
      !Number.isFinite(row.elapsedSeconds)||
      !Number.isFinite(row.energyAfter)||
      row.energyAfter<0||!row.decisions.length||
      row.decisions.some(decision=>!decision)))
    throw new Error('Manager chase race lacks rider kilometre.');
  return {sourceKm:km,riderStates:states.sort((a,b)=>
    riderIds.indexOf(a.riderId)-
    riderIds.indexOf(b.riderId))};
}

export function replayPhysicalManagerChaseRaceV1(input){
  const {startInput,start,attackKm,choiceKm,
    nominatedChaseTeamIds,throughKm}=input;
  if(!Number.isInteger(throughKm)||throughKm<choiceKm||
    throughKm>startInput?.routeKilometres?.length)
    throw new Error('Manager chase race needs sourced finish road.');
  const paid=runPhysicalManagerChaseCounterfactualV1(input);
  if(!paid.contact)
    throw new Error('Manager chase race needs paid contact.');
  const contactInput={...input,paidProbe:paid};
  const completion=completePhysicalManagerChaseContactKmV1(
    contactInput);
  const contactKm=paid.contact.sourceKm;
  const frontRiderId=paid.frontRiderId;
  const riderIds=start.riderIds;
  const front=paid.threat.physicalSource.front;
  const bunch=paid.threat.physicalSource.bunch;
  const attack=front.attack;
  const kilometres=[];
  let bunchElapsedSeconds=0;
  for(let km=1;km<choiceKm;km++){
    const bunchStep=km<attackKm?
      attack.priorRoad[km-1]:km===attackKm?
        attack.step:bunch.road.find(row=>
          row.sourceKm===km);
    if(!bunchStep)
      throw new Error('Manager chase lacks prior bunch road.');
    bunchElapsedSeconds+=bunchStep.elapsedSeconds;
    const states=bunchStates(bunchStep,
      bunchElapsedSeconds);
    if(km===attackKm){
      const row=attack.step.riders.find(item=>
        item.riderId===frontRiderId);
      states.push({riderId:frontRiderId,
        sourceKm:km,
        physicalGroupId:attack.frontSolo.id,
        atDistanceM:km*1000,
        elapsedSeconds:attack.frontSolo.elapsedSeconds,
        energyAfter:row.energyAfter,
        decisions:[bunchStep.riderDecisions.find(item=>
          item.riderId===frontRiderId)]});
    }else if(km>attackKm){
      const step=front.steps.find(row=>
        row.sourceKm===km);
      states.push({riderId:frontRiderId,
        sourceKm:km,
        physicalGroupId:step.physicalGroup.id,
        atDistanceM:km*1000,
        elapsedSeconds:step.elapsedSeconds,
        energyAfter:step.energyAfter,
        decisions:[step.decision]});
    }
    kilometres.push(fullKm(riderIds,km,states));
  }
  if(Math.abs(bunchElapsedSeconds-
    bunch.elapsedSeconds)>1e-7)
    throw new Error('Manager chase prior clocks differ.');
  for(const step of paid.steps){
    if(step.sourceKm===contactKm)break;
    bunchElapsedSeconds+=step.bunchStep.elapsedSeconds;
    const states=bunchStates(step.bunchStep,
      bunchElapsedSeconds);
    states.push({riderId:frontRiderId,
      sourceKm:step.sourceKm,
      physicalGroupId:`front-${frontRiderId}`,
      atDistanceM:step.sourceKm*1000,
      elapsedSeconds:step.frontStep.elapsedSeconds,
      energyAfter:step.frontStep.energyAfter,
      decisions:[step.frontStep.decision]});
    kilometres.push(fullKm(riderIds,
      step.sourceKm,states));
  }
  kilometres.push(fullKm(riderIds,contactKm,
    [...completion.riderStates]));
  let priorBunch=paid.steps.at(-1).bunchStep;
  bunchElapsedSeconds=completion.bunchElapsedSeconds;
  let soloElapsedSeconds=completion.soloElapsedSeconds;
  let soloEnergy=completion.energyAfter;
  const frontTeam=startInput.teams.find(team=>
    team.riders.some(row=>row.id===frontRiderId));
  const frontRider=frontTeam.riders.find(row=>
    row.id===frontRiderId);
  const later=[];
  for(let km=contactKm+1;km<=throughKm;km++){
    const segment=startInput.routeKilometres[km-1];
    const prior={riderIds:priorBunch.physicalGroup.riderIds,
      energyByRider:priorBunch.energyByRider,
      quietKmByRider:priorBunch.quietKmByRider};
    const workers=startInput.teams.filter(team=>
      orderAt(team.orders,km-1).frontWork==='rotate');
    if(workers.length!==1)
      throw new Error('Manager chase continuation needs one worker.');
    const chaseOrder=orderAt(workers[0].orders,km-1)
      .chase;
    if(chaseOrder!=='ignore'&&
      !nominatedChaseTeamIds.includes(workers[0].id))
      throw new Error('Manager chase continuation needs named team.');
    const roadInput={startInput,prior,segment,
      caughtRiderId:frontRiderId};
    let bunchStep;
    try{
      bunchStep=chaseOrder==='ignore'?
        advancePhysicalBunchAfterCaughtSlideKmV1(
          roadInput):
        advancePhysicalBunchAfterPerceivedCatchKmV1({
          ...roadInput,chasingTeamId:workers[0].id});
    }catch(error){
      if(chaseOrder!=='ignore'||error.message!==
        'Physical start follower cannot hold paid pace.')
        throw error;
      const loss=advancePhysicalBunchAfterCaughtSlideLossKmV1(
        roadInput);
      validatePhysicalBunchAfterCaughtSlideLossKmV1(
        roadInput,loss);
      const completionInputs=loss.splits.map(split=>({
        ...roadInput,loss,
        priorBunchElapsedSeconds:bunchElapsedSeconds,
        riderId:split.riderId}));
      const completions=completionInputs.map(completionInput=>{
        const completion=completePhysicalPostCatchLossKmV1(
          completionInput);
        validatePhysicalPostCatchLossKmV1(
          completionInput,completion);
        return completion;
      });
      const soloEffect=riderKilometreEffect(frontRider,
        segment,{phase:'solo',energy:soloEnergy,
          exposed:segment.exposed});
      const soloSeconds=segmentBaseSeconds(segment)+
        (50-soloEffect.ability-
          (TUNING.effortPressure.conserve-1)*20)*
          MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
      const caughtSoloEndClock=soloElapsedSeconds+
        soloSeconds;
      if(!Number.isFinite(caughtSoloEndClock)||
        caughtSoloEndClock<=bunchElapsedSeconds+
          loss.elapsedSeconds)
        throw new Error(
          'Post-catch split needs earlier paid bunch contact.');
      for(const row of completions){
        const contactInput={roadInput,loss,completion:row,
          priorBunchClock:bunchElapsedSeconds,
          frontRiderId,priorFrontClock:soloElapsedSeconds,
          frontEnergyBefore:soloEnergy};
        let contact;
        try{
          contact=contactPhysicalPostcatchSplitV1(
            contactInput);
        }catch(error){
          if(error.message===
            'Post-catch riders have no paid contact here.')
            continue;
          throw error;
        }
        validatePhysicalPostcatchSplitContactV1(
          contactInput,contact);
        const refused=new Error(
          'Post-catch solo contact needs paid group road.');
        refused.paidPostcatchContact={contactInput,contact};
        throw refused;
      }
      const caughtSoloPrice=priceRearEnergyDemandV1({
        rider:frontRider,segment,energyBefore:soloEnergy,
        effort:'conserve',role:'solo',distanceM:1000});
      const caughtSoloRecovery=recoveryForKilometre({
        rider:frontRider,segment,effort:'conserve',
        group:'dropped',working:false,quietKm:0});
      if(caughtSoloRecovery.recovery!==0)
        throw new Error('Post-catch solo cannot claim recovery.');
      const caughtSoloCap=replayRearEnergyCapV1({
        rider:frontRider,
        kilometres:startInput.routeKilometres,
        throughKm:km}).cap;
      const caughtSoloEnergyAfter=+Math.min(caughtSoloCap,
        caughtSoloPrice.energyAfter).toFixed(3);
      const lossBunchClock=bunchElapsedSeconds+
        loss.elapsedSeconds;
      const lossStates=bunchStates(loss,lossBunchClock);
      for(const row of completions)
        lossStates.push({riderId:row.riderId,
          sourceKm:km,
          physicalGroupId:row.physicalGroup.id,
          atDistanceM:row.endDistanceM,
          elapsedSeconds:row.elapsedSeconds,
          energyAfter:row.energyAfter,
          decisions:[row.decision]});
      const caughtSoloDecision={riderId:frontRiderId,
        goal:'finish_safely',
        teamOrderEffort:orderAt(frontTeam.orders,km-1)
          .effort,effort:'conserve',choice:'ride_solo',
        reason:'cannot_hold_paid_bunch_pace'};
      lossStates.push({riderId:frontRiderId,
        sourceKm:km,
        physicalGroupId:`solo-${frontRiderId}`,
        atDistanceM:km*1000,
        elapsedSeconds:caughtSoloEndClock,
        energyAfter:caughtSoloEnergyAfter,
        decisions:[caughtSoloDecision]});
      const lossKilometre=fullKm(riderIds,km,
        lossStates);
      const refused=new Error(
        `Post-catch physical loss at km ${km} needs later contact road.`);
      refused.physicalLoss={sourceKm:km,loss,
        roadInput,completionInputs,completions,
        caughtSoloEndClock,caughtSoloPrice,
        caughtSoloRecovery,caughtSoloCap,
        caughtSoloEnergyAfter,
        priorKilometres:kilometres,
        lossKilometre};
      throw refused;
    }
    bunchElapsedSeconds+=bunchStep.elapsedSeconds;
    const order=orderAt(frontTeam.orders,km-1);
    const effort='conserve';
    const effect=riderKilometreEffect(frontRider,
      segment,{phase:'solo',energy:soloEnergy,
        exposed:segment.exposed});
    const ability=effect.ability+
      (TUNING.effortPressure[effort]-1)*20;
    const seconds=segmentBaseSeconds(segment)+
      (50-ability)*MOTOR_RACE_DYNAMICS
        .secondsPerAbilityPoint;
    if(!Number.isFinite(seconds)||seconds<=0)
      throw new Error('Manager slide needs paid solo pace.');
    const price=priceRearEnergyDemandV1({
      rider:frontRider,segment,
      energyBefore:soloEnergy,effort,
      role:'solo',distanceM:1000});
    const recovery=recoveryForKilometre({
      rider:frontRider,segment,effort,
      group:'dropped',working:false,quietKm:0});
    if(recovery.recovery!==0)
      throw new Error('Manager slide cannot claim recovery.');
    const cap=replayRearEnergyCapV1({
      rider:frontRider,
      kilometres:startInput.routeKilometres,
      throughKm:km}).cap;
    const energyAfter=+Math.min(cap,price.energyAfter)
      .toFixed(3);
    soloElapsedSeconds+=seconds;
    if(soloElapsedSeconds<=bunchElapsedSeconds)
      throw new Error('Manager slide needs paid return contact.');
    const decision={riderId:frontRiderId,
      goal:'finish_safely',
      teamOrderEffort:order.effort,effort,
      choice:'ride_solo',
      reason:'cannot_hold_paid_bunch_pace'};
    const states=bunchStates(bunchStep,
      bunchElapsedSeconds);
    states.push({riderId:frontRiderId,
      sourceKm:km,
      physicalGroupId:`solo-${frontRiderId}`,
      atDistanceM:km*1000,
      elapsedSeconds:soloElapsedSeconds,
      energyAfter,decisions:[decision]});
    kilometres.push(fullKm(riderIds,km,states));
    later.push({sourceKm:km,bunchStep,
      solo:{riderId:frontRiderId,decision,
        seconds,elapsedSeconds:soloElapsedSeconds,
        bunchElapsedSeconds,
        energyBefore:soloEnergy,
        energySpent:price.energyDemand,
        recoveryAward:0,cap,energyAfter}});
    priorBunch=bunchStep;
    soloEnergy=energyAfter;
  }
  if(kilometres.length!==throughKm)
    throw new Error('Manager chase race lacks full road.');
  const last=kilometres.at(-1);
  return {version:PHYSICAL_MANAGER_CHASE_RACE_REPLAY_VERSION,
    attackKm,choiceKm,contactKm,throughKm,
    perceivedAction:paid.perceivedAction,
    riderIds:[...riderIds],kilometres,
    sources:{paid,completion,later},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        last.riderStates.map(row=>[row.riderId,
          row.elapsedSeconds]))}:{}),
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalManagerChaseRaceV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalManagerChaseRaceV1(input)))
    throw new Error('Manager chase race differs from paid source.');
  return true;
}
