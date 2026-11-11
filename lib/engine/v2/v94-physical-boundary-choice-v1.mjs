// A paid co-location can invite cooperation; it cannot create shelter
// before a named leader has travelled and paid the next road.
import {isDeepStrictEqual} from 'node:util';
import {completeV94PhysicalFirstKmV1} from
  './v94-physical-first-km-completion-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {MOTOR_DRAFT_SHELTER,TUNING} from './tuning.mjs';

export const V94_PHYSICAL_BOUNDARY_CHOICE_VERSION=
  'v94-physical-boundary-choice-1';
const ACTIVE_STAKES=new Set(['sprint_finish',
  'summit_attack','break_stage']);
const EFFORT_RANK={conserve:0,steady:1,hard:2};

export function decideV94PhysicalBoundaryChoicesV1(recording){
  const first=completeV94PhysicalFirstKmV1(recording);
  const segment=recording.route.kilometres[1];
  if(segment?.km!==2)
    throw new Error('Boundary choice needs the next recorded kilometre.');
  const byRider=new Map(recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const stakes=new Map(recording.committedInputs.rivalIntent?.map(row=>
    [row.teamId,row])??[]);
  const finishById=new Map(first.finishes.map(row=>
    [row.riderId,row]));
  const choices=first.paidCoLocationObservations.map(contact=>{
    const candidates=contact.riderIds.map(riderId=>{
      const {rider,team}=byRider.get(riderId);
      const finish=finishById.get(riderId);
      const order=orderAt(team.orders,1);
      const stake=stakes.get(team.id);
      if(!stake?.sportingGoal||!stake.sportingCaptainId||
        !Number.isFinite(finish?.energyAfter))
        throw new Error('Boundary choice needs paid rider sources.');
      const effortBonus=(TUNING.effortPressure[order.effort]-1)*20;
      const solo=riderKilometreEffect(rider,segment,{phase:'solo',
        energy:finish.energyAfter,exposed:segment.exposed});
      const cruise=riderKilometreEffect(rider,segment,{phase:'cruise',
        energy:finish.energyAfter,exposed:segment.exposed});
      const willing=order.frontWork!=='sit_in'&&(
        order.chase==='all'||order.chase==='selective'&&
        ACTIVE_STAKES.has(stake.sportingGoal));
      return {riderId,teamId:team.id,managerEffort:order.effort,
        managerChase:order.chase,
        managerFrontWork:order.frontWork??null,
        sportingGoal:stake.sportingGoal,
        sportingCaptainId:stake.sportingCaptainId,
        energyAtBoundary:finish.energyAfter,
        perceivedSoloAbility:solo.ability+effortBonus,
        perceivedShelterHoldAbility:cruise.ability+effortBonus+
          MOTOR_DRAFT_SHELTER[segment.terrain],
        willingToLead:willing};
    });
    const volunteers=candidates.filter(row=>
      row.willingToLead).sort((a,b)=>
      EFFORT_RANK[b.managerEffort]-
        EFFORT_RANK[a.managerEffort]||
      a.riderId.localeCompare(b.riderId));
    const leader=volunteers[0]??null;
    const canHold=leader?candidates.filter(row=>
      row.riderId===leader.riderId||
      row.perceivedShelterHoldAbility+1e-9>=
        leader.perceivedSoloAbility):[];
    const pendingLeader=canHold.length>1?leader:null;
    return {version:V94_PHYSICAL_BOUNDARY_CHOICE_VERSION,
      sourceKm:2,contactVersion:contact.version,
      contactAtDistanceM:contact.atDistanceM,
      contactClockSeconds:contact.clockSeconds,
      boundaryAtDistanceM:1000,
      boundaryClockSeconds:first.coincidentSoloSets.find(row=>
        row.riderIds[0]===contact.riderIds[0]).clockSeconds,
      riderIds:[...contact.riderIds],
      pendingLeaderRiderId:pendingLeader?.riderId??null,
      pendingShelterRiderIds:pendingLeader?canHold.filter(row=>
        row.riderId!==pendingLeader.riderId).map(row=>row.riderId):[],
      riderDecisions:candidates.map(row=>({
        version:V94_PHYSICAL_BOUNDARY_CHOICE_VERSION,
        ...row,
        choice:!pendingLeader?'continue_paid_solo':
          row.riderId===pendingLeader.riderId?
            'volunteer_next_paid_turn':
            canHold.includes(row)?
              'accept_shelter_after_paid_turn':
              'cannot_hold_proposed_turn'})),
      paidWorkPending:!!pendingLeader,
      formsRearGroup:false};
  });
  return {version:V94_PHYSICAL_BOUNDARY_CHOICE_VERSION,
    sourceKm:2,first,choices,
    pendingGroupCount:choices.filter(row=>
      row.pendingLeaderRiderId!==null).length,
    physicalRearGroups:[],officialResults:false};
}

export function validateV94PhysicalBoundaryChoicesV1(recording,choices){
  if(!isDeepStrictEqual(choices,
    decideV94PhysicalBoundaryChoicesV1(recording)))
    throw new Error('Boundary choices differ from paid source.');
  return true;
}
