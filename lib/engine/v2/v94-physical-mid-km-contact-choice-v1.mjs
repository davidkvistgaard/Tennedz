// Quote the next paid turn at an observed rear-road crossing. A
// proposal changes no road, reserve, group, or official placing.
import {isDeepStrictEqual} from 'node:util';
import {replayV94PhysicalContactingNextKmV1} from
  './v94-physical-contacting-next-km-v1.mjs';
import {priceRearEnergyDemandV1,
  quoteRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {orderAt} from './orders.mjs';
import {MOTOR_DRAFT_SHELTER,TUNING} from './tuning.mjs';

export const V94_PHYSICAL_MID_KM_CONTACT_CHOICE_VERSION=
  'v94-physical-mid-km-contact-choice-1';
const EPS=1e-8;
const EFFORT_RANK={conserve:0,steady:1,hard:2};
const ACTIVE_STAKES=new Set(['sprint_finish',
  'summit_attack','break_stage']);

export function decideV94PhysicalMidKmContactChoiceV1(
  recording,prior){
  const km=prior?.sourceKm+1;
  const segment=recording.route.kilometres[km-1];
  if(!Number.isInteger(km)||km<8||segment?.km!==km||
    !prior.fullFieldKilometre||
    prior.sourceCheckpointCalibrationFailed!==true)
    throw new Error('Mid-km choice needs a paid prior field.');
  let observed=null;
  try{
    replayV94PhysicalContactingNextKmV1(recording,prior);
  }catch(error){
    if(error.message!==
      'Physical rear roads need paid contact resolution.')
      throw error;
    observed=error.sourceEvidence;
  }
  const metres=observed?.atDistanceM-(km-1)*1000;
  if(!Array.isArray(observed?.roadEvidence)||
    observed.roadEvidence.length!==2||
    observed.roadEvidence.some(road=>
      !['rear_group','solo'].includes(road.kind)||
      !Array.isArray(road.riderWork)||
      road.riderWork.length!==road.riderIds.length)||
    !Number.isFinite(metres)||metres<=0||metres>=1000)
    throw new Error('Mid-km choice needs measured rear-road contact.');
  const byRider=new Map(recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const stakes=new Map(recording.committedInputs.rivalIntent?.map(row=>
    [row.teamId,row])??[]);
  const sourceBreakIds=new Set(prior.sourceBreakRiderIds??[]);
  const remainingM=1000-metres;
  const candidates=observed.roadEvidence.flatMap(road=>
    road.riderWork.map(work=>{
      const source=byRider.get(work.riderId);
      if(!source||!['leader','sheltered','solo'].includes(
        work.role))
        throw new Error('Contact rider lacks paid road role.');
      const {rider,team}=source;
      const order=orderAt(team.orders,km-1);
      const stake=stakes.get(team.id);
      if(order.effort!==work.effort||
        !stake?.sportingGoal||!stake.sportingCaptainId)
        throw new Error('Contact rider lacks committed decision.');
      const prefix=priceRearEnergyDemandV1({rider,segment,
        energyBefore:work.energyBefore,effort:work.effort,
        role:work.role,distanceM:metres});
      const leader=quoteRearEnergyDemandV1({rider,segment,
        energyBefore:prefix.energyAfter,effort:order.effort,
        role:'leader',distanceM:remainingM});
      const shelter=quoteRearEnergyDemandV1({rider,segment,
        energyBefore:prefix.energyAfter,effort:order.effort,
        role:'sheltered',distanceM:remainingM});
      const bonus=(TUNING.effortPressure[order.effort]-1)*20;
      const soloAbility=riderKilometreEffect(rider,segment,{
        phase:'solo',energy:prefix.energyAfter,
        exposed:segment.exposed}).ability+bonus;
      const shelterAbility=riderKilometreEffect(rider,segment,{
        phase:'cruise',energy:prefix.energyAfter,
        exposed:segment.exposed}).ability+bonus+
        MOTOR_DRAFT_SHELTER[segment.terrain];
      const sourceBreakMembershipClaim=sourceBreakIds.has(rider.id);
      const willing=(sourceBreakMembershipClaim?
        order.breakWork!=='sit_on':
        order.frontWork!=='sit_in'&&
          (order.chase==='all'||order.chase==='selective'&&
            ACTIVE_STAKES.has(stake.sportingGoal)))&&
        leader.energyDemand<=prefix.energyAfter+EPS;
      return {riderId:rider.id,teamId:team.id,
        previousPhysicalGroup:road.roadId,
        paidRoleBeforeContact:work.role,
        managerEffort:order.effort,
        managerChase:order.chase,
        managerFrontWork:order.frontWork??null,
        managerBreakWork:order.breakWork??null,
        sourceBreakMembershipClaim,
        sportingGoal:stake.sportingGoal,
        sportingCaptainId:stake.sportingCaptainId,
        energyBeforeKm:work.energyBefore,
        paidEnergyToContact:prefix.energyDemand,
        energyAtContact:prefix.energyAfter,
        perceivedSoloAbility:soloAbility,
        perceivedShelterHoldAbility:shelterAbility,
        quotedLeaderEnergyDemand:leader.energyDemand,
        quotedShelterEnergyDemand:shelter.energyDemand,
        willingToLead:willing};
    }));
  if(new Set(candidates.map(row=>row.riderId)).size!==
    candidates.length)
    throw new Error('Contact candidate appears on two roads.');
  const leader=[...candidates].filter(row=>row.willingToLead)
    .sort((a,b)=>EFFORT_RANK[b.managerEffort]-
      EFFORT_RANK[a.managerEffort]||
      b.perceivedSoloAbility-a.perceivedSoloAbility||
      a.riderId.localeCompare(b.riderId))[0]??null;
  const sheltered=leader?candidates.filter(row=>
    row.riderId!==leader.riderId&&
    row.perceivedShelterHoldAbility+EPS>=
      leader.perceivedSoloAbility&&
    row.quotedShelterEnergyDemand<=
      row.energyAtContact+EPS):[];
  const pendingLeader=sheltered?.length?leader:null;
  return {version:V94_PHYSICAL_MID_KM_CONTACT_CHOICE_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    atDistanceM:observed.atDistanceM,
    clockSeconds:observed.clockSeconds,
    remainingDistanceM:remainingM,
    observedRoads:observed.roadEvidence,
    candidates:candidates.map(row=>({...row,
      choice:!pendingLeader?'continue_paid_road':
        row.riderId===pendingLeader.riderId?
          'volunteer_next_paid_turn':
          sheltered.includes(row)?
            'eligible_for_shelter_after_paid_turn':
            'cannot_hold_proposed_turn'})),
    pendingLeaderRiderId:pendingLeader?.riderId??null,
    pendingShelterRiderIds:pendingLeader?
      sheltered.map(row=>row.riderId):[],
    paidWorkPending:!!pendingLeader,
    formsRearGroup:false,officialResults:false};
}

export function validateV94PhysicalMidKmContactChoiceV1(
  recording,prior,choice){
  if(!isDeepStrictEqual(choice,
    decideV94PhysicalMidKmContactChoiceV1(recording,prior)))
    throw new Error('Mid-km contact choice differs from paid source.');
  return true;
}
