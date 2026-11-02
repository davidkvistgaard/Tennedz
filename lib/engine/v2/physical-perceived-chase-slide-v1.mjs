// A chased break rider falls behind only if it cannot hold the named
// bunch leader after a source-replayed paid catch.
import {isDeepStrictEqual} from 'node:util';
import {catchPhysicalPerceivedChaseV1} from
  './physical-perceived-chase-contact-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_PERCEIVED_CHASE_SLIDE_VERSION=
  'v2-physical-perceived-chase-slide-1';

export function slidePerceivedChaseCaughtFrontV1(input){
  const {startInput,catchKm,catchRecord}=input;
  const {start,attackKm,choiceKm,observerTeamId,
    nominatedChaseTeamIds,conditionalChaseTeamIds}=input;
  const sourceInput={startInput,start,attackKm,choiceKm,
    observerTeamId,nominatedChaseTeamIds,
    conditionalChaseTeamIds,catchKm};
  if(!isDeepStrictEqual(catchRecord,
    catchPhysicalPerceivedChaseV1(sourceInput)))
    throw new Error('Chased slide needs replayed paid contact.');
  const riderId=catchRecord.contact.riderId;
  const team=startInput.teams.find(row=>row.riders.some(rider=>
    rider.id===riderId));
  const rider=team.riders.find(row=>row.id===riderId);
  const segment=startInput.routeKilometres[catchKm-1];
  const order=orderAt(team.orders,catchKm-1);
  const leader=catchRecord.bunchStep.riders.find(row=>
    row.riderId===catchRecord.bunchStep.leaderRiderId);
  const energyBefore=catchRecord.frontPartial.energyAtContact;
  const effect=riderKilometreEffect(rider,segment,{
    phase:'cruise',energy:energyBefore,
    exposed:segment.exposed});
  const holdAbility=effect.ability+
    (TUNING.effortPressure[order.effort]-1)*20+
    TUNING.breakaway.bunchDraftAdvantage;
  if(holdAbility+1e-9>=leader.holdAbility)
    throw new Error('Caught rider can hold; slide needs physical loss.');
  const effort='conserve';
  const soloEffect=riderKilometreEffect(rider,segment,{
    phase:'solo',energy:energyBefore,
    exposed:segment.exposed});
  const soloAbility=soloEffect.ability+
    (TUNING.effortPressure[effort]-1)*20;
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-soloAbility)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
    throw new Error('Chased slide needs physical safe-finish pace.');
  const remainingM=catchKm*1000-
    catchRecord.contact.atDistanceM;
  const remainingSeconds=secondsPerKm*remainingM/1000;
  const elapsedSeconds=catchRecord.contact.clockSeconds+
    remainingSeconds;
  const prior=catchRecord.priorChase.steps.at(-1);
  const bunchElapsedSeconds=prior.frontStep.elapsedSeconds+
    prior.gapSecondsToBunch+
    catchRecord.bunchStep.elapsedSeconds;
  const gapSecondsToBunch=elapsedSeconds-bunchElapsedSeconds;
  if(gapSecondsToBunch<=0)
    throw new Error('Caught rider did not fall behind paid bunch.');
  const paid=priceRearEnergyDemandV1({rider,segment,
    energyBefore,effort,role:'solo',distanceM:remainingM});
  const recovery=recoveryForKilometre({rider,segment,
    effort,group:'dropped',working:false,quietKm:0});
  if(recovery.recovery!==0)
    throw new Error('Chased slide cannot claim bunch recovery.');
  const cap=replayRearEnergyCapV1({rider,
    kilometres:startInput.routeKilometres,throughKm:catchKm}).cap;
  const energyAfter=+Math.min(cap,paid.energyAfter).toFixed(3);
  return {version:PHYSICAL_PERCEIVED_CHASE_SLIDE_VERSION,
    sourceKm:catchKm,riderId,
    contactAtDistanceM:catchRecord.contact.atDistanceM,
    endDistanceM:catchKm*1000,
    decision:{sourceGoal:catchRecord.frontDecision.goal,
      goal:'finish_safely',teamOrderEffort:order.effort,
      effort,choice:'slide_through',
      reason:'cannot_hold_paid_bunch_pace'},
    holdAbility,bunchLeaderAbility:leader.holdAbility,
    physicalGroup:{id:'solo-'+riderId,riderIds:[riderId],
      atDistanceM:catchKm*1000},
    elapsedSeconds,bunchElapsedSeconds,
    gapSecondsToBunch,energyBefore,
    energySpent:paid.energyDemand,
    totalKmEnergySpent:catchRecord.frontPartial.energySpent+
      paid.energyDemand,
    recoveryAward:0,cap,energyAfter,
    officialResults:false};
}

export function validatePerceivedChaseCaughtSlideV1(input,recording){
  if(!isDeepStrictEqual(recording,
    slidePerceivedChaseCaughtFrontV1(input)))
    throw new Error('Chased slide differs from paid source.');
  return true;
}
