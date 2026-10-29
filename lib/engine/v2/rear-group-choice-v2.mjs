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

export function decideRearGroupChoiceV2({contactInput,teams,roadGroups=[],
  rearGoals,groupId,stageNumber,stageCount}){
  const contact=advanceRearSourceContactV1(contactInput).contact;
  assertRoadGroups(roadGroups);
  if(!contact.event||!Array.isArray(teams)||!Array.isArray(rearGoals)||
    rearGoals.length!==2||
    new Set(rearGoals.map(row=>row?.riderId)).size!==2||
    !Number.isInteger(stageNumber)||stageNumber<1||
    !Number.isInteger(stageCount)||stageCount<stageNumber)
    throw new Error('Rear group needs two committed rider goals.');
  if(roadGroups.some(group=>group.riderIds.some(id=>
    contact.event.riderIds.includes(id)))||
    new Set(teams.flatMap(team=>team.riders.map(rider=>rider.id))).size!==
      teams.reduce((count,team)=>count+team.riders.length,0))
    throw new Error('Rear rider cannot occupy a second road group or team.');
  const teamByRider=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,team])));
  const goalByRider=new Map(rearGoals.map(row=>[row.riderId,row]));
  const energyByRider=new Map(contact.riders.map(row=>
    [row.riderId,row.energy]));
  const memberDecisions=contact.event.riderIds.map(riderId=>{
    const team=teamByRider.get(riderId),goal=goalByRider.get(riderId);
    if(!team?.orders||!goal||!['finish_safely','rejoin_bunch',
      'save_for_stage'].includes(goal.goal)||
      !['cooperate','drive','sit_on'].includes(goal.rearWork)||
      goal.goal==='save_for_stage'&&
        !validStagePlan(goal.committedStagePlan,riderId,
          stageNumber,stageCount))
      throw new Error('Rear rider needs a real roster and sporting goal.');
    const order=orderAt(team.orders,contactInput.segment.km-1);
    if(!['conserve','steady','hard'].includes(order.effort))
      throw new Error('Rear rider needs a committed effort order.');
    const ownAhead=roadGroups.some(group=>group.riderIds.some(id=>
      team.riders.some(rider=>rider.id===id)));
    const energy=energyByRider.get(riderId);
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
  const leaderRiderId=pullers[(contactInput.segment.km-1)%pullers.length].riderId;
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
