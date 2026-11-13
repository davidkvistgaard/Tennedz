// An opt-in shared road after two source-replayed rear solos meet. Both
// riders decide again at contact, one leads, and only travelled road is paid.
import {isDeepStrictEqual} from 'node:util';
import {bunchAbilityFromPaidTurnsV1} from './rear-detachment-v1.mjs';
import {decideRearGroupMembersV2} from './rear-group-choice-v2.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {rearGoalsAtKmV1} from './rear-goal-commitment-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {advanceRearSplitSoloContactV1} from
  './rear-split-solo-contact-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_SPLIT_CONTACT_CONTINUATION_V1_VERSION=
  'v2-rear-split-contact-continuation-1';
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Rear joined road has invalid pace.');
  return 3600/seconds;
};
const advanceFractionalRearGap=({startDistanceM,endDistanceM,
  gapSeconds,bunchSpeedKph,leaderSpeedKph})=>{
  const distanceM=endDistanceM-startDistanceM;
  if(!Number.isFinite(distanceM)||distanceM<=0||
    !Number.isFinite(gapSeconds)||gapSeconds<=0)
    throw new Error('Rear joined road needs positive remaining distance.');
  const closingPerM=3.6/bunchSpeedKph-3.6/leaderSpeedKph;
  const catchM=closingPerM>0?gapSeconds/closingPerM:Infinity;
  const caught=catchM<=distanceM+1e-9;
  const riddenM=caught?Math.min(distanceM,catchM):distanceM;
  return {caught,catchDistanceM:caught?
    startDistanceM+riddenM:null,
  gapSeconds:caught?0:gapSeconds-riddenM*closingPerM};
};

export function continueRearSplitContactV1({contactInput,contact,
  commitment,roadGroups=[]}){
  if(!isDeepStrictEqual(contact,
    advanceRearSplitSoloContactV1(contactInput)))
    throw new Error('Rear joined road needs replayed paid contact.');
  const {splitInput,segment,bunchTurnPlan}=contactInput;
  const {teams,stageNumber,stageCount,routeKilometres}=splitInput;
  const group=contact.rearGroup;
  if(commitment?.stageNumber!==stageNumber||
    commitment.stageCount!==stageCount)
    throw new Error('Rear joined road needs same-stage committed goals.');
  const priorGoals=rearGoalsAtKmV1({commitment,
    riderIds:group.riderIds,km:splitInput.segment.km});
  const initialGoals=rearGoalsAtKmV1({commitment,
    riderIds:group.riderIds,
    km:splitInput.priorChoiceInput.contactInput.segment.km});
  const ordered=rows=>group.riderIds.map(id=>
    rows.find(row=>row.riderId===id));
  if(!isDeepStrictEqual(priorGoals,ordered(splitInput.rearGoals))||
    !isDeepStrictEqual(initialGoals,
      ordered(splitInput.priorChoiceInput.rearGoals)))
    throw new Error('Rear joined road goals differ from prior commitment.');
  const rearGoals=rearGoalsAtKmV1({commitment,
    riderIds:group.riderIds,km:segment.km});
  const {memberDecisions,pullerIds}=decideRearGroupMembersV2({
    riderIds:group.riderIds,energyByRider:group.energyByRider,
    teams,rearGoals,roadGroups,stageNumber,stageCount,km:segment.km});
  const rotation=[...group.riderIds.slice(1),group.riderIds[0]];
  const leaderRiderId=rotation.find(id=>pullerIds.includes(id));
  if(!leaderRiderId)
    throw new Error('Rear joined road needs a willing paid leader.');
  bunchAbilityFromPaidTurnsV1(bunchTurnPlan);
  const byRider=new Map(teams.flatMap(team=>team.riders.map(row=>
    [row.id,row])));
  const byDecision=new Map(memberDecisions.map(row=>
    [row.riderId,row]));
  const base=segmentBaseSeconds(segment);
  const energy={...group.energyByRider};
  let gapSeconds=group.behindBunchSeconds;
  let atDistanceM=group.atDistanceM;
  let event=null;
  const slices=[];
  for(const turn of bunchTurnPlan.turns){
    const turnStartM=(segment.km-1)*1000+turn.startM;
    const turnEndM=(segment.km-1)*1000+turn.endM;
    if(turnEndM<=atDistanceM)continue;
    const startDistanceM=Math.max(atDistanceM,turnStartM);
    if(startDistanceM>=turnEndM)continue;
    const leader=byRider.get(leaderRiderId);
    const decision=byDecision.get(leaderRiderId);
    const effect=riderKilometreEffect(leader,segment,{
      phase:'solo',energy:energy[leaderRiderId],
      exposed:segment.exposed});
    const leaderSpeedKph=speed(base,effect.ability+
      (TUNING.effortPressure[decision.effort]-1)*20);
    const bunchSpeedKph=speed(base,turn.ability+
      TUNING.breakaway.bunchDraftAdvantage);
    const holdChecks=memberDecisions.filter(row=>
      row.riderId!==leaderRiderId).map(row=>{
      const follower=riderKilometreEffect(byRider.get(row.riderId),
        segment,{phase:'cruise',energy:energy[row.riderId],
          exposed:segment.exposed});
      const holdSpeedKph=speed(base,follower.ability+
        (TUNING.effortPressure[row.effort]-1)*20+
        TUNING.breakaway.bunchDraftAdvantage);
      if(holdSpeedKph+1e-9<leaderSpeedKph)
        throw new Error('Rear follower cannot hold paid contact leader.');
      return {riderId:row.riderId,holdSpeedKph,canHold:true};
    });
    const movement=advanceFractionalRearGap({startDistanceM,
      endDistanceM:turnEndM,gapSeconds,bunchSpeedKph,
      leaderSpeedKph});
    const endDistanceM=movement.catchDistanceM??turnEndM;
    const riders=memberDecisions.map(row=>{
      const leading=row.riderId===leaderRiderId;
      const price=priceRearEnergyDemandV1({
        rider:byRider.get(row.riderId),segment,
        energyBefore:energy[row.riderId],effort:row.effort,
        role:leading?'leader':'sheltered',
        distanceM:endDistanceM-startDistanceM});
      energy[row.riderId]=price.energyAfter;
      return {riderId:row.riderId,choice:row.choice,
        reason:row.reason,role:price.role,
        energyBefore:price.energyBefore,
        energySpent:price.energyDemand,energyAfter:price.energyAfter};
    });
    slices.push({startDistanceM,endDistanceM,
      leaderRiderId,bunchLeaderAbility:turn.ability,
      bunchSpeedKph,leaderSpeedKph,holdChecks,riders,
      behindBunchSeconds:movement.gapSeconds});
    gapSeconds=movement.gapSeconds;
    atDistanceM=endDistanceM;
    if(movement.caught){
      event={kind:'rejoin_bunch',atDistanceM,
        riderIds:[...group.riderIds]};
      break;
    }
  }
  if(!slices.length)
    throw new Error('Rear joined road needs a remaining paid turn.');
  const fullKm=atDistanceM===segment.km*1000;
  const settlement=group.riderIds.map(riderId=>{
    const rider=byRider.get(riderId);
    const choice=byDecision.get(riderId);
    if(!fullKm)return {riderId,cap:null,recoveryAward:null,
      energyAfter:energy[riderId]};
    const source=replayRearEnergyCapV1({rider,
      kilometres:routeKilometres,throughKm:segment.km});
    const recovery=recoveryForKilometre({rider,segment,
      effort:choice.effort,group:'dropped',
      working:riderId===leaderRiderId,quietKm:0});
    if(recovery.recovery!==0||recovery.quietKm!==0)
      throw new Error('Rear joined road cannot claim bunch recovery.');
    energy[riderId]=+Math.min(energy[riderId],source.cap).toFixed(3);
    return {riderId,cap:source.cap,recoveryAward:0,
      energyAfter:energy[riderId]};
  });
  return {version:REAR_SPLIT_CONTACT_CONTINUATION_V1_VERSION,
    sourceKm:segment.km,startDistanceM:group.atDistanceM,
    endDistanceM:atDistanceM,memberDecisions,leaderRiderId,
    slices,settlement,event,
    rearGroup:event?null:{id:`${contactInput.split.sourceV1.sourceGroupId}-rejoined`,
    riderIds:[...group.riderIds],atDistanceM,
    behindBunchSeconds:gapSeconds,turnCount:1,
    energyByRider:energy},officialResults:false};
}

export function validateRearSplitContactContinuationV1(input,recording){
  if(!isDeepStrictEqual(recording,continueRearSplitContactV1(input)))
    throw new Error('Rear joined continuation differs from paid contact.');
  return true;
}
