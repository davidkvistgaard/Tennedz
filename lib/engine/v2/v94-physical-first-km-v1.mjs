// Isolated first-kilometre road from V94's named paid front turns. A detached
// rider remains a solo; no rear group or finish is inferred from checkpoint
// labels. Reserve here is measured at the front's km clock, before recovery.
import {isDeepStrictEqual} from 'node:util';
import {validateRecordedTour} from './recording.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_DRAFT_SHELTER,MOTOR_RACE_DYNAMICS,TUNING} from
  './tuning.mjs';

export const V94_PHYSICAL_FIRST_KM_VERSION='v94-physical-first-km-1';
export const V94_PHYSICAL_FIRST_KM_DECISION_VERSION=
  'v94-physical-first-km-decision-1';
const speed=secondsPerKm=>{
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
    throw new Error('First-km road needs positive paid speed.');
  return 3600/secondsPerKm;
};
const secondsFor=(base,ability)=>
  base+(50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;

export function replayV94PhysicalFirstKmV1(recording){
  validateRecordedTour(recording);
  const frame=recording.frames[0];
  const segment=recording.route.kilometres[0];
  const plan=frame?.pelotonFrontTurnPlan;
  if(recording.committedInputs.raceContext?.pelotonFrontTurnVersion!==1||
    segment?.km!==1||plan?.status!=='worked'||
    plan.turns[0]?.startM!==0||plan.turns.at(-1)?.endM!==1000||
    frame.attackers.length||frame.joinedBreakawayRiderIds.length||
    frame.breakawayRiderIds.length||frame.roadGroups.length)
    throw new Error('First-km physical road needs an intact paid bunch.');
  const teams=recording.committedInputs.teams;
  const stakes=new Map(recording.committedInputs.rivalIntent?.map(row=>
    [row.teamId,row])??[]);
  const riderSources=teams.flatMap(team=>team.riders.map(rider=>({
    rider,team,effort:orderAt(team.orders,0).effort,
    stake:stakes.get(team.id)})));
  if(riderSources.some(row=>!row.stake?.sportingGoal||
    !row.stake.sportingCaptainId))
    throw new Error('First-km decision needs committed sporting stakes.');
  const ledger=new Map(frame.energyLedger.map(row=>[row.riderId,row]));
  const states=riderSources.map(({rider,team})=>{
    const energyBefore=ledger.get(rider.id)?.energyBefore;
    if(!Number.isFinite(energyBefore))
      throw new Error('First-km rider lacks recorded starting reserve.');
    return {riderId:rider.id,teamId:team.id,
      atDistanceM:0,reserve:energyBefore,attached:true};
  });
  const byRider=new Map(riderSources.map(row=>[row.rider.id,row]));
  const base=segmentBaseSeconds(segment);
  const road=[];
  let clockSeconds=0;
  for(const turn of plan.turns){
    const startClockSeconds=clockSeconds;
    const leadingM=turn.endM-turn.startM;
    const leaderSpeedKph=speed(secondsFor(base,turn.ability));
    const turnSeconds=leadingM*3.6/leaderSpeedKph;
    const slices=[];
    for(const state of states){
      const {rider,effort,stake}=byRider.get(state.riderId);
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
        if(startDistanceM+travelM>=turn.endM-1e-9)
          throw new Error('First-km solo contact needs paid resolution.');
        state.attached=false;
      }
      const price=priceRearEnergyDemandV1({rider,segment,
        energyBefore,effort,
        role:role==='solo_pace_match'?'solo':role,
        distanceM:travelM});
      state.atDistanceM=startDistanceM+travelM;
      state.reserve=price.energyAfter;
      slices.push({riderId:state.riderId,teamId:state.teamId,
        effort,role,attachedBefore,attachedAfter:state.attached,
        startDistanceM,endDistanceM:state.atDistanceM,
        holdAbility,soloAbility,
        energyBefore,energySpent:price.energyDemand,
        energyAtTurnEnd:state.reserve,
        decision:{version:V94_PHYSICAL_FIRST_KM_DECISION_VERSION,
          sourceKm:1,turnStartM:turn.startM,
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
        throw new Error('First-km solo-to-solo contact needs paid resolution.');
    }
    clockSeconds+=turnSeconds;
    road.push({startM:turn.startM,endM:turn.endM,
      leaderRiderId:turn.leaderRiderId,leaderAbility:turn.ability,
      leaderSpeedKph,startClockSeconds,endClockSeconds:clockSeconds,
      riderSlices:slices});
  }
  const atFrontClock=states.map(state=>{
    const sourcePaidFromReserve=ledger.get(state.riderId).paidFromReserve;
    const physicalPaidThroughClock=ledger.get(state.riderId).energyBefore-
      state.reserve;
    if(state.attached&&Math.abs(sourcePaidFromReserve-
      physicalPaidThroughClock)>1e-5)
      throw new Error('Attached first-km energy differs from V94 source.');
    return {riderId:state.riderId,teamId:state.teamId,
      atDistanceM:state.atDistanceM,
      remainingDistanceM:1000-state.atDistanceM,
      reserveBeforeRecovery:state.reserve,
      sourceFullKmPaidFromReserve:sourcePaidFromReserve,
      physicalPaidThroughClock,
      attached:state.attached};
  });
  return {version:V94_PHYSICAL_FIRST_KM_VERSION,
    sourceKm:1,sourceRecordingVersion:recording.tuningVersion,
    frontAtDistanceM:1000,frontClockSeconds:clockSeconds,
    road,atFrontClock,
    completeRiderKilometres:states.filter(state=>state.attached).length,
    detachedRiderCount:states.filter(state=>!state.attached).length,
    remainingSoloRoadUnsettled:true,recoveryUnsettled:true,
    officialResults:false};
}

export function validateV94PhysicalFirstKmV1(recording,physical){
  if(!isDeepStrictEqual(physical,replayV94PhysicalFirstKmV1(recording)))
    throw new Error('First-km physical road differs from paid source.');
  return true;
}
