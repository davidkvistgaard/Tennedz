// A separately paid solo meets an already paid rear group only at
// their common route metre and clock. This prices each rider to that
// contact; the rest of the kilometre remains unsettled.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalMixedSimultaneousRearGroupV1} from
  './physical-simultaneous-rear-group-v1.mjs';
import {runPhysicalDetachedSoloV1} from
  './physical-detached-solo-run-v1.mjs';
import {rearSoloPlanAtKmV1} from
  './rear-solo-commitment-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_MIXED_REAR_SOLO_CONTACT_VERSION=
  'v2-physical-mixed-rear-solo-contact-1';
const effortRank={conserve:0,steady:1,hard:2};

export function contactPhysicalMixedRearSoloV1({
  startInput,start,lossKm,contactKm}){
  if(!Number.isInteger(contactKm)||
    contactKm<=lossKm+1||
    contactKm>startInput?.routeKilometres?.length)
    throw new Error('Mixed contact needs later paid road.');
  const prior=replayPhysicalMixedSimultaneousRearGroupV1({
    startInput,start,lossKm,throughKm:contactKm-1});
  const partition=prior.sources.contact;
  const meeting=partition.contacts[0];
  const groupIds=meeting.riderIds;
  const soloRiderId=partition.separateSoloRiderIds[0];
  const solo=runPhysicalDetachedSoloV1({startInput,start,
    lossKm,throughKm:contactKm,riderId:soloRiderId});
  const soloPrior=solo.steps.at(-2)??solo.completion;
  const soloCurrent=solo.steps.at(-1);
  const priorGroup=prior.sources.later.at(-1);
  const groupClock=priorGroup.groupElapsedSeconds;
  const bunchClock=priorGroup.bunchElapsedSeconds;
  const segment=startInput.routeKilometres[contactKm-1];
  const first=(contactKm-lossKm-1)%groupIds.length;
  const entries=groupIds.map(riderId=>{
    const team=startInput.teams.find(row=>
      row.riders.some(rider=>rider.id===riderId));
    const rider=team.riders.find(row=>row.id===riderId);
    const plan=startInput.soloCommitments?.find(row=>
      row.riderId===riderId);
    const intent=plan?rearSoloPlanAtKmV1({
      commitment:plan,km:contactKm}):
      {action:'finish_safely',effort:'conserve'};
    const order=orderAt(team.orders,contactKm-1);
    if(effortRank[intent.effort]===undefined||
      effortRank[intent.effort]>effortRank[order.effort])
      throw new Error('Mixed contact exceeds team order.');
    const energyBefore=priorGroup.rearRows.find(row=>
      row.riderId===riderId).energyAfter;
    return {riderId,team,rider,intent,order,
      energyBefore};
  });
  const leader=Array.from({length:entries.length},
    (_,offset)=>entries[(first+offset)%entries.length])
    .find(row=>row.intent.action!=='save_for_stage');
  if(!leader)
    throw new Error('Mixed contact needs willing leader.');
  const leaderEffect=riderKilometreEffect(leader.rider,
    segment,{phase:'solo',energy:leader.energyBefore,
      exposed:segment.exposed});
  const leaderAbility=leaderEffect.ability+
    (TUNING.effortPressure[leader.intent.effort]-1)*20;
  const followerAbilities=entries.filter(row=>
    row!==leader).map(entry=>{
    const effect=riderKilometreEffect(entry.rider,
      segment,{phase:'cruise',
        energy:entry.energyBefore,
        exposed:segment.exposed});
    return effect.ability+
      (TUNING.effortPressure[
        entry.intent.effort]-1)*20+
      TUNING.breakaway.bunchDraftAdvantage;
  });
  const groupAbility=Math.min(leaderAbility,
    ...followerAbilities);
  const groupSecondsPerKm=segmentBaseSeconds(segment)+
    (50-groupAbility)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  const soloSecondsPerKm=soloCurrent.seconds;
  const priorDifference=soloPrior.elapsedSeconds-groupClock;
  const projectedDifference=priorDifference+
    soloSecondsPerKm-groupSecondsPerKm;
  const fraction=-priorDifference/
    (soloSecondsPerKm-groupSecondsPerKm);
  if(!Number.isFinite(groupSecondsPerKm)||
    groupSecondsPerKm<=0||
    !Number.isFinite(soloSecondsPerKm)||
    soloSecondsPerKm<=0||
    priorDifference===0||
    priorDifference*projectedDifference>=0||
    !Number.isFinite(fraction)||
    fraction<=0||fraction>=1)
    throw new Error('Mixed solo and group have no paid contact here.');
  const clockSeconds=groupClock+
    groupSecondsPerKm*fraction;
  const soloClockSeconds=soloPrior.elapsedSeconds+
    soloSecondsPerKm*fraction;
  // The solo source independently replays the bunch through contact.
  const bunchSecondsPerKm=soloCurrent
    .bunchElapsedSeconds-bunchClock;
  const bunchAtContact=bunchClock+
    bunchSecondsPerKm*fraction;
  if(!Number.isFinite(bunchSecondsPerKm)||
    bunchSecondsPerKm<=0||
    Math.abs(clockSeconds-soloClockSeconds)>1e-7||
    clockSeconds<=bunchAtContact)
    throw new Error('Mixed contact clocks do not meet behind bunch.');
  const atDistanceM=(contactKm-1+fraction)*1000;
  const distanceM=fraction*1000;
  const riders=entries.map(entry=>{
    const role=entry===leader?'leader':'sheltered';
    const paid=priceRearEnergyDemandV1({
      rider:entry.rider,segment,
      energyBefore:entry.energyBefore,
      effort:entry.intent.effort,role,distanceM});
    if(entry.intent.action==='save_for_stage'&&
      paid.energyAfter<entry.intent
        .committedStagePlan.reserveEnergy)
      throw new Error('Mixed contact breaks stage reserve.');
    return {riderId:entry.riderId,teamId:entry.team.id,
      role,effort:entry.intent.effort,
      goal:entry.intent.action,
      decision:{riderId:entry.riderId,
        goal:entry.intent.action,
        teamOrderEffort:entry.order.effort,
        effort:entry.intent.effort,
        choice:role==='leader'?'pull':'shelter',
        reason:role==='leader'?
          'paid_rear_turn_to_contact':
          'shelter_until_paid_contact'},
      energyBefore:paid.energyBefore,
      energySpent:paid.energyDemand,
      energyAfter:paid.energyAfter};
  });
  const soloTeam=startInput.teams.find(row=>
    row.riders.some(rider=>rider.id===soloRiderId));
  const soloRider=soloTeam.riders.find(row=>
    row.id===soloRiderId);
  const paidSolo=priceRearEnergyDemandV1({
    rider:soloRider,segment,
    energyBefore:soloPrior.energyAfter,
    effort:soloCurrent.decision.effort,
    role:'solo',distanceM});
  riders.push({riderId:soloRiderId,
    teamId:soloTeam.id,role:'solo',
    effort:soloCurrent.decision.effort,
    goal:soloCurrent.decision.goal,
    decision:{...soloCurrent.decision,
      riderId:soloRiderId,choice:'solo'},
    energyBefore:paidSolo.energyBefore,
    energySpent:paidSolo.energyDemand,
    energyAfter:paidSolo.energyAfter});
  return {version:PHYSICAL_MIXED_REAR_SOLO_CONTACT_VERSION,
    sourceKm:contactKm,lossKm,
    atDistanceM,clockSeconds,
    behindBunchSeconds:clockSeconds-bunchAtContact,
    fraction,groupSecondsPerKm,soloSecondsPerKm,
    bunchSecondsPerKm,
    groupRiderIds:[...groupIds],soloRiderId,
    leaderRiderId:leader.riderId,
    physicalGroup:{id:`rear-${groupIds.join('-')}`,
      riderIds:[...groupIds,soloRiderId],
      atDistanceM},
    riders,sources:{prior,solo},
    remainingKmUnsettled:true,
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalMixedRearSoloContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    contactPhysicalMixedRearSoloV1(input)))
    throw new Error('Mixed rear contact differs from paid source.');
  return true;
}
