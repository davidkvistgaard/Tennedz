// Isolated rider choices after a recorded rear contact. A distinct explicit
// rear-work directive is required; a breakaway work order is not relabelled.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearSourceContactV1} from './rear-source-contact-v1.mjs';
import {continueRearSourceGroupV1} from './rear-source-group-v1.mjs';
import {orderAt} from './orders.mjs';
import {assertRoadGroups} from './road-groups.mjs';
import {TUNING} from './tuning.mjs';

export const REAR_GROUP_CHOICE_VERSION='v2-rear-group-choice-2';

function validStagePlan(plan,riderId,stageNumber,stageCount){
  return plan?.riderId===riderId&&
    plan.currentStageNumber===stageNumber&&
    Number.isInteger(plan.targetStageNumber)&&
    plan.targetStageNumber>stageNumber&&
    plan.targetStageNumber<=stageCount&&
    plan.currentGoal==='finish_safely'&&
    plan.futureGoal==='target_stage'&&
    Number.isFinite(plan.reserveEnergy)&&
    plan.reserveEnergy>=0&&plan.reserveEnergy<=100;
}

// Shared by the first paid turn and later kilometres of the same group.
// Energy and membership must come from an independently replayed road source.
export function decideRearGroupMembersV2({riderIds,energyByRider,teams,
  rearGoals,roadGroups=[],stageNumber,stageCount,km}){
  assertRoadGroups(roadGroups);
  if(!Array.isArray(riderIds)||riderIds.length<2||
    new Set(riderIds).size!==riderIds.length||
    !Array.isArray(teams)||!Array.isArray(rearGoals)||
    rearGoals.length!==riderIds.length||
    new Set(rearGoals.map(row=>row?.riderId)).size!==riderIds.length||
    !Number.isInteger(km)||km<1||
    !Number.isInteger(stageNumber)||stageNumber<1||
    !Number.isInteger(stageCount)||stageCount<stageNumber)
    throw new Error('Rear group needs committed goals for every rider.');
  if(roadGroups.some(group=>group.riderIds.some(id=>
    riderIds.includes(id)))||
    new Set(teams.flatMap(team=>team.riders.map(rider=>rider.id))).size!==
      teams.reduce((count,team)=>count+team.riders.length,0))
    throw new Error('Rear rider cannot occupy a second road group or team.');
  const teamByRider=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,team])));
  const goalByRider=new Map(rearGoals.map(row=>[row.riderId,row]));
  const memberDecisions=riderIds.map(riderId=>{
    const team=teamByRider.get(riderId),goal=goalByRider.get(riderId);
    if(!team?.orders||!goal||!['finish_safely','rejoin_bunch',
      'save_for_stage'].includes(goal.goal)||
      !['cooperate','drive','sit_on'].includes(goal.rearWork)||
      goal.goal==='save_for_stage'&&
        !validStagePlan(goal.committedStagePlan,riderId,
          stageNumber,stageCount))
      throw new Error('Rear rider needs a real roster and sporting goal.');
    const order=orderAt(team.orders,km-1);
    if(!['conserve','steady','hard'].includes(order.effort))
      throw new Error('Rear rider needs a committed effort order.');
    const ownAhead=roadGroups.some(group=>group.riderIds.some(id=>
      team.riders.some(rider=>rider.id===id)));
    const energy=energyByRider[riderId];
    if(!Number.isFinite(energy)||energy<0||energy>100)
      throw new Error('Rear rider needs recorded remaining energy.');
    const reason=ownAhead?'teammate_further_ahead':
      goal.rearWork==='sit_on'?'rear_sit_on_directive':
        energy<=TUNING.breakaway.minPullEnergy?'insufficient_energy':
          goal.goal==='save_for_stage'&&goal.rearWork!=='drive'?
            'committed_future_stage_reserve':
            goal.rearWork==='drive'?'rear_drive_directive':goal.goal;
    const choice=['teammate_further_ahead','rear_sit_on_directive',
      'insufficient_energy','committed_future_stage_reserve']
      .includes(reason)?'sit_in':'pull';
    return {riderId,choice,effort:order.effort,reason};
  });
  const pullers=memberDecisions.filter(row=>row.choice==='pull');
  if(!pullers.length)
    throw new Error('No rear rider is willing and able to lead.');
  return {memberDecisions,pullerIds:pullers.map(row=>row.riderId)};
}

export function decideRearGroupChoiceV2({contactInput,teams,roadGroups=[],
  rearGoals,groupId,stageNumber,stageCount}){
  const contact=advanceRearSourceContactV1(contactInput).contact;
  if(!contact.event)
    throw new Error('Rear group needs two committed rider goals.');
  const {memberDecisions,pullerIds}=decideRearGroupMembersV2({
    riderIds:contact.event.riderIds,
    energyByRider:Object.fromEntries(contact.riders.map(row=>
      [row.riderId,row.energy])),teams,rearGoals,roadGroups,
    stageNumber,stageCount,km:contactInput.segment.km});
  const leaderRiderId=pullerIds[(contactInput.segment.km-1)%pullerIds.length];
  const groupInput={contactInput,groupId,memberDecisions,leaderRiderId};
  const group=continueRearSourceGroupV1(groupInput);
  return {version:REAR_GROUP_CHOICE_VERSION,groupId,
    rearGoals:rearGoals.map(row=>structuredClone(row)),
    memberDecisions,leaderRiderId,group};
}

export function validateRearGroupChoiceV2(input,recording){
  if(!isDeepStrictEqual(recording,decideRearGroupChoiceV2(input)))
    throw new Error('Rear choice differs from committed goals and source.');
  return true;
}
