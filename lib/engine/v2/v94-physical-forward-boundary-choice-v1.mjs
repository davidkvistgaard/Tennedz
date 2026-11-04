// Select a payable break-work leader only where source break riders
// actually share a paid boundary clock. No wheel or source group is used.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalBoundaryFromPriorV1} from
  './v94-physical-third-boundary-choice-v1.mjs';
import {quoteRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {orderAt} from './orders.mjs';

export const V94_PHYSICAL_FORWARD_BOUNDARY_CHOICE_VERSION=
  'v94-physical-forward-boundary-choice-1';
const EPS=1e-8;
const EFFORT_RANK={conserve:0,steady:1,hard:2};

export function decideV94PhysicalForwardBoundaryChoicesV1(
  recording,prior,{allowPaidMixedContact=false}={}){
  const km=prior?.sourceKm+1;
  if(!Number.isInteger(km)||km<8||
    !prior.fullFieldKilometre||
    !Array.isArray(prior.sourceBreakRiderIds)||
    !prior.sourceBreakRiderIds.length)
    throw new Error('Forward choice needs paid prior field.');
  const sourceBreakIds=new Set(prior.sourceBreakRiderIds);
  if(sourceBreakIds.size!==prior.sourceBreakRiderIds.length||
    prior.sourceBreakRiderIds.some(id=>
      !prior.finishes.some(row=>row.riderId===id&&
        row.physicalGroup!=='peloton')))
    throw new Error('Forward choice needs detached paid riders.');
  const base=decideV94PhysicalBoundaryFromPriorV1(recording,{
    km,prior,version:V94_PHYSICAL_FORWARD_BOUNDARY_CHOICE_VERSION});
  const byId=new Map(recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const segment=recording.route.kilometres[km-1];
  let forwardCandidateSets=0;
  const choices=base.choices.map(choice=>{
    const forwardIds=choice.riderIds.filter(id=>
      sourceBreakIds.has(id));
    if(!forwardIds.length)return choice;
    const mixedPaidContact=
      forwardIds.length!==choice.riderIds.length;
    if(mixedPaidContact){
      const paidGroup=prior.physicalRearGroups?.find(group=>
        group.roadId===choice.previousGroupIds[0]);
      if(!allowPaidMixedContact||
        choice.previousGroupIds.length!==1||
        paidGroup?.kind!=='rear_group'||
        paidGroup.riderDecisions.length!==
          choice.riderIds.length||
        paidGroup.riderDecisions.some(row=>
          !choice.riderIds.includes(row.riderId)||
          !(row.sourceContactFragmentVersion||
            prior.mixedPaidContactFromPrior===true&&
            row.sourceBoundaryVersion===
              V94_PHYSICAL_FORWARD_BOUNDARY_CHOICE_VERSION)))
        throw new Error(
          'Mixed forward/rear contact needs paid joint choice.');
    }
    forwardCandidateSets++;
    const candidates=choice.riderDecisions.map(row=>{
      const source=byId.get(row.riderId);
      const order=orderAt(source.team.orders,km-1);
      if(order.effort!==row.managerEffort)
        throw new Error('Forward choice changed committed effort.');
      const leaderQuote=quoteRearEnergyDemandV1({
        rider:source.rider,segment,
        energyBefore:row.energyAtBoundary,
        effort:order.effort,role:'leader',distanceM:1000});
      const shelterQuote=quoteRearEnergyDemandV1({
        rider:source.rider,segment,
        energyBefore:row.energyAtBoundary,
        effort:order.effort,role:'sheltered',distanceM:1000});
      return {...row,managerBreakWork:order.breakWork,
        sourceBreakMembershipClaim:
          sourceBreakIds.has(row.riderId),
        willingToLead:(sourceBreakIds.has(row.riderId)?
          order.breakWork!=='sit_on':row.willingToLead)&&
          leaderQuote.energyDemand<=row.energyAtBoundary+EPS,
        quotedLeaderEnergyDemand:leaderQuote.energyDemand,
        quotedShelterEnergyDemand:shelterQuote.energyDemand};
    });
    const volunteers=candidates.filter(row=>
      row.willingToLead).sort((a,b)=>
      EFFORT_RANK[b.managerEffort]-
        EFFORT_RANK[a.managerEffort]||
      b.perceivedSoloAbility-a.perceivedSoloAbility||
      a.riderId.localeCompare(b.riderId));
    const leader=volunteers[0]??null;
    const eligibleShelter=leader?candidates.filter(row=>
      row.riderId!==leader.riderId&&
      row.perceivedShelterHoldAbility+EPS>=
        leader.perceivedSoloAbility&&
      row.quotedShelterEnergyDemand<=
        row.energyAtBoundary+EPS):[];
    const pendingLeader=eligibleShelter.length?leader:null;
    return {...choice,
      pendingLeaderRiderId:pendingLeader?.riderId??null,
      pendingShelterRiderIds:pendingLeader?
        eligibleShelter.map(row=>row.riderId):[],
      riderDecisions:candidates.map(row=>({
        ...row,choice:!pendingLeader?'continue_paid_solo':
          row.riderId===pendingLeader.riderId?
            'volunteer_next_paid_break_turn':
            eligibleShelter.includes(row)?
              'eligible_for_shelter_after_paid_turn':
              'cannot_hold_proposed_break_turn'})),
      paidWorkPending:!!pendingLeader,
      formsRearGroup:false,
      forwardContactCandidate:true,
      ...(mixedPaidContact?{mixedPaidContact:true}:{}),
      sourceBreakGroupNotAdopted:true};
  });
  return {...base,choices,forwardCandidateSets,
    pendingGroupCount:choices.filter(row=>
      row.pendingLeaderRiderId!==null).length,
    sourceBreakGroupNotAdopted:true,
    physicalRearGroups:[],officialResults:false};
}

export function validateV94PhysicalForwardBoundaryChoicesV1(
  recording,prior,choices,options){
  if(!isDeepStrictEqual(choices,
    decideV94PhysicalForwardBoundaryChoicesV1(
      recording,prior,options)))
    throw new Error('Forward choices differ from paid source.');
  return true;
}
