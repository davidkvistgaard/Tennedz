// Pay the next rear kilometre only when every proposed road stays free of
// a new contact. A group exists here only after a co-location witness,
// a named paid leader and shelter costs for its actual travelled metre.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalBoundaryChoicesV1} from
  './v94-physical-boundary-choice-v1.mjs';
import {replayV94PhysicalSecondFrontKmV1} from
  './v94-physical-second-front-km-v1.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_DRAFT_SHELTER,MOTOR_RACE_DYNAMICS,TUNING} from
  './tuning.mjs';

export const V94_PHYSICAL_SECOND_REAR_KM_VERSION=
  'v94-physical-second-rear-km-1';
export const V94_PHYSICAL_SECOND_REAR_DECISION_VERSION=
  'v94-physical-second-rear-decision-1';
const EPS=1e-7;
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Second-km rear needs positive paid speed.');
  return 1000/seconds;
};

export function firstV94SecondRearRoadContactV1(a,b){
  const start=Math.max(a.startClockSeconds,b.startClockSeconds);
  const end=Math.min(a.finishClockSeconds,b.finishClockSeconds);
  if(end<=start+EPS)return null;
  const gapAt=t=>
    a.speedMps*(t-a.startClockSeconds)-
    b.speedMps*(t-b.startClockSeconds);
  const gapStart=gapAt(start),gapEnd=gapAt(end);
  if(Math.abs(gapStart)<=EPS){
    if(Math.abs(a.startClockSeconds-b.startClockSeconds)<=EPS)
      return null;
    return {clockSeconds:start,atDistanceM:1000+
      a.speedMps*(start-a.startClockSeconds),
    roadIds:[a.roadId,b.roadId]};
  }
  if(gapStart*gapEnd>0&&Math.abs(gapEnd)>EPS)return null;
  const relative=a.speedMps-b.speedMps;
  if(Math.abs(relative)<=EPS)return null;
  const clockSeconds=start-gapStart/relative;
  if(clockSeconds<=start+EPS||clockSeconds>end+EPS)return null;
  return {clockSeconds,atDistanceM:1000+
    a.speedMps*(clockSeconds-a.startClockSeconds),
  roadIds:[a.roadId,b.roadId]};
}

export function firstV94SecondFrontContactV1(front,road){
  for(const turn of front.road){
    const start=Math.max(turn.startClockSeconds,
      road.startClockSeconds);
    const end=Math.min(turn.endClockSeconds,
      road.finishClockSeconds);
    if(end<=start+EPS)continue;
    const frontSpeed=turn.leaderSpeedKph/3.6;
    const gapAt=t=>1000+turn.startM+
      frontSpeed*(t-turn.startClockSeconds)-
      (1000+road.speedMps*(t-road.startClockSeconds));
    const gapStart=gapAt(start),gapEnd=gapAt(end);
    if(gapStart<=EPS||gapEnd>EPS)continue;
    const relative=frontSpeed-road.speedMps;
    const clockSeconds=start-gapStart/relative;
    if(clockSeconds>start+EPS&&clockSeconds<=end+EPS)
      return {clockSeconds,atDistanceM:1000+turn.startM+
        frontSpeed*(clockSeconds-turn.startClockSeconds),
      roadIds:['front',road.roadId]};
  }
  return null;
}

export function replayV94PhysicalSecondRearKmV1(recording){
  const boundary=decideV94PhysicalBoundaryChoicesV1(recording);
  const front=replayV94PhysicalSecondFrontKmV1(recording);
  if(front.atFrontClock.some(row=>!row.attached))
    throw new Error(
      'Second-km front drops need concurrent rear contact replay.');
  const segment=recording.route.kilometres[1];
  const base=segmentBaseSeconds(segment);
  const byRider=new Map(recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const finishById=new Map(boundary.first.finishes.map(row=>
    [row.riderId,row]));
  const roads=[];
  for(const [index,choice] of boundary.choices.entries()){
    const leader=choice.riderDecisions.find(row=>
      row.riderId===choice.pendingLeaderRiderId);
    const groupIds=new Set(leader?[
      leader.riderId,...choice.pendingShelterRiderIds]:[]);
    const groupRoadId=`paid-contact-${index+1}`;
    if(leader){
      const speedMps=speed(base,leader.perceivedSoloAbility);
      const riders=[leader.riderId,...choice.pendingShelterRiderIds]
        .map(riderId=>{
          const decision=choice.riderDecisions.find(row=>
            row.riderId===riderId);
          const rider=byRider.get(riderId);
          const role=riderId===leader.riderId?
            'leader':'sheltered';
          const price=priceRearEnergyDemandV1({rider,segment,
            energyBefore:finishById.get(riderId).energyAfter,
            effort:decision.managerEffort,role,distanceM:1000});
          if(role==='sheltered'){
            const hold=riderKilometreEffect(rider,segment,{
              phase:'cruise',energy:price.energyAfter,
              exposed:segment.exposed}).ability+
              (TUNING.effortPressure[
                decision.managerEffort]-1)*20+
              MOTOR_DRAFT_SHELTER[segment.terrain];
            if(hold+EPS<leader.perceivedSoloAbility)
              throw new Error(
                'Second-km rear shelter fails before paid boundary.');
          }
          return {version:V94_PHYSICAL_SECOND_REAR_DECISION_VERSION,
            riderId,role,effort:decision.managerEffort,
            sportingGoal:decision.sportingGoal,
            perceivedSoloAbility:decision.perceivedSoloAbility,
            perceivedShelterHoldAbility:
              decision.perceivedShelterHoldAbility,
            energyBefore:price.energyBefore,
            paidFromReserve:price.energyDemand,
            reserveBeforeRecovery:price.energyAfter,
            sourceContactVersion:choice.contactVersion,
            sourceContactClockSeconds:choice.contactClockSeconds,
            choice:role==='leader'?'pay_rear_lead':
              'hold_paid_rear_shelter'};
        });
      roads.push({roadId:groupRoadId,kind:'rear_group',
        contactAtDistanceM:choice.contactAtDistanceM,
        contactClockSeconds:choice.contactClockSeconds,
        sourceBoundaryClockSeconds:choice.boundaryClockSeconds,
        startClockSeconds:choice.boundaryClockSeconds,
        finishClockSeconds:choice.boundaryClockSeconds+
          1000/speedMps,
        startDistanceM:1000,endDistanceM:2000,
        speedMps,leaderRiderId:leader.riderId,
        riderDecisions:riders});
    }
    for(const decision of choice.riderDecisions){
      if(groupIds.has(decision.riderId))continue;
      const rider=byRider.get(decision.riderId);
      const speedMps=speed(base,decision.perceivedSoloAbility);
      const price=priceRearEnergyDemandV1({rider,segment,
        energyBefore:finishById.get(decision.riderId).energyAfter,
        effort:decision.managerEffort,role:'solo',distanceM:1000});
      roads.push({roadId:`solo-${decision.riderId}`,
        kind:'solo',contactAtDistanceM:choice.contactAtDistanceM,
        contactClockSeconds:choice.contactClockSeconds,
        sourceBoundaryClockSeconds:choice.boundaryClockSeconds,
        startClockSeconds:choice.boundaryClockSeconds,
        finishClockSeconds:choice.boundaryClockSeconds+
          1000/speedMps,
        startDistanceM:1000,endDistanceM:2000,
        speedMps,leaderRiderId:decision.riderId,
        riderDecisions:[{
          version:V94_PHYSICAL_SECOND_REAR_DECISION_VERSION,
          riderId:decision.riderId,role:'solo',
          effort:decision.managerEffort,
          sportingGoal:decision.sportingGoal,
          perceivedSoloAbility:decision.perceivedSoloAbility,
          energyBefore:price.energyBefore,
          paidFromReserve:price.energyDemand,
          reserveBeforeRecovery:price.energyAfter,
          sourceContactVersion:choice.contactVersion,
          sourceContactClockSeconds:choice.contactClockSeconds,
          choice:'continue_paid_solo'}]});
    }
  }
  for(let i=0;i<roads.length;i++){
    const frontMeeting=firstV94SecondFrontContactV1(front,roads[i]);
    if(frontMeeting){
      const error=new Error(
        'Second-km rear/front contact needs paid resolution.');
      error.sourceEvidence=frontMeeting;
      throw error;
    }
    for(let j=i+1;j<roads.length;j++){
      const meeting=firstV94SecondRearRoadContactV1(
        roads[i],roads[j]);
      if(meeting){
        const error=new Error(
          'Second-km rear roads need paid contact resolution.');
        error.sourceEvidence=meeting;
        throw error;
      }
    }
  }
  const finishes=roads.flatMap(road=>road.riderDecisions.map(row=>{
    const rider=byRider.get(row.riderId);
    const recovery=recoveryForKilometre({rider,segment,
      effort:row.effort,group:'dropped',
      working:row.role==='leader',quietKm:0});
    if(recovery.recovery!==0)
      throw new Error('Second-km rear cannot claim bunch recovery.');
    const cap=replayRearEnergyCapV1({rider,
      kilometres:recording.route.kilometres,throughKm:2}).cap;
    const capAdjustment=Math.max(0,row.reserveBeforeRecovery-cap);
    return {riderId:row.riderId,sourceKm:2,
      physicalGroup:road.roadId,endDistanceM:2000,
      clockSeconds:road.finishClockSeconds,
      energyBefore:row.energyBefore,
      paidFromReserve:row.paidFromReserve,
      recoveryAward:0,capAdjustment,
      energyAfter:+Math.min(cap,
        row.reserveBeforeRecovery).toFixed(3)};
  }));
  const sourceLedger=new Map(recording.frames[1].energyLedger.map(row=>
    [row.riderId,row]));
  const frontFinishes=front.atFrontClock.map(row=>{
    const source=sourceLedger.get(row.riderId);
    if(!source||!row.attached)
      throw new Error('Second-km front finish lacks paid source.');
    return {riderId:row.riderId,sourceKm:2,
      physicalGroup:'peloton',endDistanceM:2000,
      clockSeconds:front.frontClockSeconds,
      energyBefore:source.energyBefore,
      paidFromReserve:row.physicalPaidThroughClock,
      recoveryAward:source.recoveryAward,
      capAdjustment:source.capAdjustment,
      energyAfter:source.energyAfter};
  });
  const allFinishes=[...frontFinishes,...finishes];
  if(allFinishes.length!==boundary.first.finishes.length||
    new Set(allFinishes.map(row=>row.riderId)).size!==
      allFinishes.length||
    allFinishes.some(row=>row.endDistanceM!==2000||
      Math.abs(row.energyBefore-row.paidFromReserve+
        row.recoveryAward-row.capAdjustment-
        row.energyAfter)>.001))
    throw new Error('Second-km full field lacks paid finish coverage.');
  return {version:V94_PHYSICAL_SECOND_REAR_KM_VERSION,
    sourceKm:2,boundary,front,roads,
    physicalRearGroups:roads.filter(row=>
      row.kind==='rear_group'),
    rearFinishes:finishes,finishes:allFinishes,
    officialResults:false,fullFieldKilometre:true};
}

export function validateV94PhysicalSecondRearKmV1(recording,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalSecondRearKmV1(recording)))
    throw new Error('Second-km rear road differs from paid source.');
  return true;
}
