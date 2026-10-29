// Isolated source-paid first group turn after two rear solos actually meet.
// The two riders choose whether to pull; one exposed leader is selected.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearSourceContactV1} from './rear-source-contact-v1.mjs';
import {continueRearContactV1} from './rear-contact-continuation-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_SOURCE_GROUP_VERSION='v2-rear-source-group-1';
const DRAFT_COST_FRACTION=.8;

export function continueRearSourceGroupV1({contactInput,groupId,
  memberDecisions,leaderRiderId}){
  const sourceContact=advanceRearSourceContactV1(contactInput);
  const contact=sourceContact.contact;
  if(!contact.event||!Array.isArray(memberDecisions)||
    memberDecisions.length!==2||
    new Set(memberDecisions.map(row=>row?.riderId)).size!==2||
    memberDecisions.some(row=>
      !contact.event.riderIds.includes(row.riderId)||
      !['pull','sit_in'].includes(row.choice)||
      !['finish_safely','rejoin_bunch','save_energy',
        'teammate_further_ahead','rear_sit_on_directive',
        'ordered_sit_on','ordered_drive',
        'insufficient_energy','committed_future_stage_reserve',
        'rear_drive_directive'].includes(row.reason)||
      !['conserve','steady','hard'].includes(row.effort))||
    !memberDecisions.some(row=>row.riderId===leaderRiderId&&
      row.choice==='pull'))
    throw new Error('Rear source group needs two choices and a willing leader.');
  const byId=new Map(memberDecisions.map(row=>[row.riderId,row]));
  const sourceById=new Map([contactInput.front,contactInput.rear]
    .map(row=>[row.rider.id,row]));
  const energyById=new Map(contact.riders.map(row=>[row.riderId,row.energy]));
  const segment=contactInput.segment;
  const leader=sourceById.get(leaderRiderId);
  const leaderDecision=byId.get(leaderRiderId);
  const leaderEffect=riderKilometreEffect(leader.rider,segment,{
    phase:'solo',energy:energyById.get(leaderRiderId),
    exposed:segment.exposed});
  const ability=leaderEffect.ability+
    (TUNING.effortPressure[leaderDecision.effort]-1)*20;
  const secondsPerKm=segmentBaseSeconds(segment)+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(secondsPerKm<=0)throw new Error('Rear leader pace is invalid.');
  const leadCostPerKm=(TUNING.effortCost[leaderDecision.effort]+
    TUNING.breakaway.extraCostPerKm)*leaderEffect.energyCostMultiplier;
  const sitterId=contact.event.riderIds.find(id=>id!==leaderRiderId);
  const sitter=sourceById.get(sitterId);
  const sitterEffect=riderKilometreEffect(sitter.rider,segment,{
    phase:'cruise',energy:energyById.get(sitterId),
    exposed:segment.exposed});
  const shelteredCostPerKm=TUNING.effortCost[byId.get(sitterId).effort]*
    sitterEffect.energyCostMultiplier*DRAFT_COST_FRACTION;
  if(leadCostPerKm<=shelteredCostPerKm)
    throw new Error('An exposed rear leader must pay more than a sitter.');
  const continuation=continueRearContactV1({
    soloInput:sourceContact.soloInput,groupId,leaderRiderId,
    groupSpeedKph:3600/secondsPerKm,
    leadCostPerKm,shelteredCostPerKm});
  return {version:REAR_SOURCE_GROUP_VERSION,sourceKm:segment.km,
    memberDecisions:memberDecisions.map(row=>({...row})),
    leaderRiderId,sourceContact,continuation};
}

export function validateRearSourceGroupV1(input,recording){
  if(!isDeepStrictEqual(recording,continueRearSourceGroupV1(input)))
    throw new Error('Rear group differs from paid contact and rider decisions.');
  return true;
}
