// Propose next paid leaders only at recorded km-5 contact clocks.
// Fresh forward co-locations use break-work orders, without a wheel.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalBoundaryFromPriorV1} from
  './v94-physical-third-boundary-choice-v1.mjs';
import {decideV94PhysicalSixthRiderBoundaryV1} from
  './v94-physical-sixth-rider-boundary-v1.mjs';
import {quoteRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';

export const V94_PHYSICAL_SIXTH_BOUNDARY_CHOICE_VERSION=
  'v94-physical-sixth-boundary-choice-1';
const EPS=1e-8;
const EFFORT_RANK={conserve:0,steady:1,hard:2};

export function decideV94PhysicalSixthBoundaryChoicesV1(
  recording,prior){
  const base=decideV94PhysicalBoundaryFromPriorV1(recording,{
    km:6,prior,version:V94_PHYSICAL_SIXTH_BOUNDARY_CHOICE_VERSION});
  const riders=decideV94PhysicalSixthRiderBoundaryV1(
    recording,prior);
  const byId=new Map(riders.decisions.map(row=>
    [row.riderId,row]));
  const sourceRiders=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[rider.id,rider])));
  const segment=recording.route.kilometres[5];
  let freshForwardCandidateSets=0;
  const choices=base.choices.map(choice=>{
    const forwardIds=choice.riderIds.filter(id=>
      byId.get(id)?.sourceBreakMembershipClaim);
    if(!forwardIds.length)return choice;
    if(forwardIds.length!==choice.riderIds.length||
      choice.previousGroupIds.some(id=>
        !id.startsWith('solo-attack-')))
      throw new Error(
        'Mixed forward/rear contact needs a paid joint decision.');
    freshForwardCandidateSets++;
    const candidates=choice.riderDecisions.map(row=>{
      const source=byId.get(row.riderId);
      const leaderQuote=quoteRearEnergyDemandV1({
        rider:sourceRiders.get(row.riderId),segment,
        energyBefore:source.energyAtBoundary,
        effort:source.managerEffort,
        role:'leader',distanceM:1000});
      const shelterQuote=quoteRearEnergyDemandV1({
        rider:sourceRiders.get(row.riderId),segment,
        energyBefore:source.energyAtBoundary,
        effort:source.managerEffort,
        role:'sheltered',distanceM:1000});
      return {...row,
        managerBreakWork:source.managerBreakWork,
        sourceBreakMembershipClaim:true,
        willingToLead:source.managerBreakWork!=='sit_on'&&
          leaderQuote.energyDemand<=source.energyAtBoundary+EPS,
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
      freshForwardContactCandidate:true,
      sourceBreakGroupNotAdopted:true};
  });
  return {...base,choices,freshForwardCandidateSets,
    pendingGroupCount:choices.filter(row=>
      row.pendingLeaderRiderId!==null).length,
    sourceBreakGroupNotAdopted:true,
    physicalRearGroups:[],officialResults:false};
}

export function validateV94PhysicalSixthBoundaryChoicesV1(
  recording,prior,choices){
  if(!isDeepStrictEqual(choices,
    decideV94PhysicalSixthBoundaryChoicesV1(recording,prior)))
    throw new Error('Sixth boundary choices differ from paid source.');
  return true;
}
