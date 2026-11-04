// Continue a named paid front from a completed physical boundary.
// Rear roads remain unresolved; this cannot establish a full field.
import {isDeepStrictEqual} from 'node:util';
import {completeV94PhysicalFirstKmV1} from
  './v94-physical-first-km-completion-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_DRAFT_SHELTER,MOTOR_RACE_DYNAMICS,TUNING} from
  './tuning.mjs';

export const V94_PHYSICAL_SECOND_FRONT_KM_VERSION=
  'v94-physical-second-front-km-1';
export const V94_PHYSICAL_SECOND_FRONT_DECISION_VERSION=
  'v94-physical-second-front-decision-1';
const secondsFor=(base,ability)=>
  base+(50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
const speed=secondsPerKm=>{
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
    throw new Error('Physical front needs positive paid speed.');
  return 3600/secondsPerKm;
};

export function replayV94PhysicalFrontKmFromPriorV1(recording,{
  km,prior,frontClockSeconds,version,decisionVersion,
  priorField='prior'}){
  if(!Number.isInteger(km)||km<2||
    !Array.isArray(prior?.finishes)||
    !Number.isFinite(frontClockSeconds)||
    typeof version!=='string'||!version||
    typeof decisionVersion!=='string'||!decisionVersion)
    throw new Error('Physical front needs a paid prior boundary.');
  const frame=recording.frames[km-1];
  const segment=recording.route.kilometres[km-1];
  const plan=frame?.pelotonFrontTurnPlan;
  if(segment?.km!==km||plan?.status!=='worked'||
    plan.turns[0]?.startM!==0||
    plan.turns.at(-1)?.endM!==1000||
    frame.attackers.length||frame.joinedBreakawayRiderIds.length||
    frame.breakawayRiderIds.length||frame.roadGroups.length)
    throw new Error('Physical front needs an intact paid plan.');
  const source=new Map(recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const stakes=new Map(recording.committedInputs.rivalIntent?.map(row=>
    [row.teamId,row])??[]);
  const ledger=new Map(frame.energyLedger.map(row=>[row.riderId,row]));
  const states=prior.finishes.filter(row=>
    row.physicalGroup==='peloton').map(row=>{
    const start=ledger.get(row.riderId);
    if(!start||Math.abs(start.energyBefore-row.energyAfter)>1e-6)
      throw new Error('Physical front lacks continuous paid reserve.');
    return {riderId:row.riderId,atDistanceM:(km-1)*1000,
      reserve:row.energyAfter,attached:true};
  });
  const frontIds=new Set(states.map(row=>row.riderId));
  if(plan.turns.some(turn=>!frontIds.has(turn.leaderRiderId)))
    throw new Error('Named leader left the physical front.');
  const base=segmentBaseSeconds(segment);
  const road=[];
  let clockSeconds=frontClockSeconds;
  for(const turn of plan.turns){
    if(!states.find(row=>row.riderId===turn.leaderRiderId)?.attached)
      throw new Error('Named leader left the physical front.');
    const startClockSeconds=clockSeconds;
    const leadingM=turn.endM-turn.startM;
    const leaderSpeedKph=speed(secondsFor(base,turn.ability));
    const turnSeconds=leadingM*3.6/leaderSpeedKph;
    const slices=[];
    for(const state of states){
      const {rider,team}=source.get(state.riderId);
      const stake=stakes.get(team.id);
      if(!stake?.sportingGoal||!stake.sportingCaptainId)
        throw new Error('Physical front decision needs committed stake.');
      const effort=orderAt(team.orders,km-1).effort;
      const energyBefore=state.reserve;
      const effortBonus=(TUNING.effortPressure[effort]-1)*20;
      const cruise=riderKilometreEffect(rider,segment,{phase:'cruise',
        energy:energyBefore,exposed:segment.exposed});
      const solo=riderKilometreEffect(rider,segment,{phase:'solo',
        energy:energyBefore,exposed:segment.exposed});
      const holdAbility=cruise.ability+effortBonus+
        MOTOR_DRAFT_SHELTER[segment.terrain];
      const soloAbility=solo.ability+effortBonus;
      const soloSpeedKph=speed(secondsFor(base,soloAbility));
      const attachedBefore=state.attached;
      const startDistanceM=state.atDistanceM;
      let role,travelM;
      if(attachedBefore&&state.riderId===turn.leaderRiderId){
        role='leader';travelM=leadingM;
      }else if(attachedBefore&&holdAbility+1e-9>=turn.ability){
        role='sheltered';travelM=leadingM;
      }else if(attachedBefore&&soloAbility+1e-9>=turn.ability){
        role='solo_pace_match';travelM=leadingM;
      }else{
        role='solo';travelM=soloSpeedKph*turnSeconds/3.6;
        if(startDistanceM+travelM>=
          (km-1)*1000+turn.endM-1e-9)
          throw new Error('Solo/front contact needs paid resolution.');
        state.attached=false;
      }
      const price=priceRearEnergyDemandV1({rider,segment,
        energyBefore,effort,
        role:role==='solo_pace_match'?'solo':role,
        distanceM:travelM});
      state.atDistanceM=startDistanceM+travelM;
      state.reserve=price.energyAfter;
      slices.push({riderId:state.riderId,teamId:team.id,
        effort,role,attachedBefore,attachedAfter:state.attached,
        startDistanceM,endDistanceM:state.atDistanceM,
        energyBefore,energySpent:price.energyDemand,
        energyAtTurnEnd:state.reserve,
        decision:{version:decisionVersion,
          sourceKm:km,turnStartM:turn.startM,
          sportingGoal:stake.sportingGoal,
          sportingCaptainId:stake.sportingCaptainId,
          teamOrderEffort:effort,
          perceivedCruiseAbility:cruise.ability,
          perceivedSoloAbility:solo.ability,
          leaderAbility:turn.ability,energyBefore,
          choice:role==='leader'?'paid_front_turn':
            role==='sheltered'?'hold_shelter':
            role==='solo_pace_match'?'pay_pace_match':
            attachedBefore?'cannot_hold_paid_turn':
              'continue_detached_solo'}});
    }
    const solos=slices.filter(row=>!row.attachedAfter);
    for(let i=0;i<solos.length;i++)for(let j=i+1;j<solos.length;j++){
      const startGap=solos[i].startDistanceM-
        solos[j].startDistanceM;
      const endGap=solos[i].endDistanceM-
        solos[j].endDistanceM;
      if(Math.abs(startGap)>1e-9&&startGap*endGap<=0)
        throw new Error('Solo contact needs paid resolution.');
    }
    clockSeconds+=turnSeconds;
    road.push({startM:turn.startM,endM:turn.endM,
      leaderRiderId:turn.leaderRiderId,leaderAbility:turn.ability,
      leaderSpeedKph,startClockSeconds,endClockSeconds:clockSeconds,
      riderSlices:slices});
  }
  const atFrontClock=states.map(state=>{
    const sourcePaid=ledger.get(state.riderId).paidFromReserve;
    const physicalPaid=ledger.get(state.riderId).energyBefore-
      state.reserve;
    if(state.attached&&Math.abs(sourcePaid-physicalPaid)>1e-5)
      throw new Error('Attached front energy differs from V94 source.');
    return {riderId:state.riderId,atDistanceM:state.atDistanceM,
      reserveBeforeRecovery:state.reserve,attached:state.attached,
      sourceFullKmPaidFromReserve:sourcePaid,
      physicalPaidThroughClock:physicalPaid};
  });
  return {version,sourceKm:km,
    [priorField]:prior,frontAtDistanceM:km*1000,
    frontClockSeconds:clockSeconds,road,atFrontClock,
    completeFrontRiderKilometres:states.filter(row=>
      row.attached).length,
    conditionalOnNoRearContact:true,
    rearConcurrentRoadUnresolved:true,
    detachedFrontRoadUnresolved:true,
    physicalRearGroups:[],officialResults:false};
}

export function replayV94PhysicalSecondFrontKmV1(recording){
  const first=completeV94PhysicalFirstKmV1(recording);
  return replayV94PhysicalFrontKmFromPriorV1(recording,{
    km:2,prior:first,frontClockSeconds:first.frontClockSeconds,
    version:V94_PHYSICAL_SECOND_FRONT_KM_VERSION,
    decisionVersion:V94_PHYSICAL_SECOND_FRONT_DECISION_VERSION,
    priorField:'first'});
}

export function validateV94PhysicalSecondFrontKmV1(recording,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalSecondFrontKmV1(recording)))
    throw new Error('Second-km front differs from paid source.');
  return true;
}
