// Reconsider a rear-group turn at the paid boundary when its proposed
// leader cannot fund the committed effort. No road is joined here.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalForwardBoundaryChoicesV1} from
  './v94-physical-forward-boundary-choice-v1.mjs';
import {quoteRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';

export const V94_PHYSICAL_PAYABLE_REAR_BOUNDARY_VERSION=
  'v94-physical-payable-rear-boundary-1';
const EPS=1e-8;
const EFFORT_RANK={conserve:0,steady:1,hard:2};

export function decideV94PhysicalPayableRearBoundaryV1(
  recording,prior,{allowPaidMixedContact=false}={}){
  const base=decideV94PhysicalForwardBoundaryChoicesV1(
    recording,prior,{allowPaidMixedContact});
  const km=base.sourceKm;
  const segment=recording.route.kilometres[km-1];
  const byId=new Map(recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const choices=base.choices.map(choice=>{
    if(choice.forwardContactCandidate)return choice;
    const candidates=choice.riderDecisions.map(row=>{
      const rider=byId.get(row.riderId);
      const leader=quoteRearEnergyDemandV1({rider,segment,
        energyBefore:row.energyAtBoundary,
        effort:row.managerEffort,role:'leader',distanceM:1000});
      const shelter=quoteRearEnergyDemandV1({rider,segment,
        energyBefore:row.energyAtBoundary,
        effort:row.managerEffort,role:'sheltered',distanceM:1000});
      return {...row,
        quotedLeaderEnergyDemand:leader.energyDemand,
        quotedShelterEnergyDemand:shelter.energyDemand,
        payableLeader:leader.energyDemand<=
          row.energyAtBoundary+EPS,
        payableShelter:shelter.energyDemand<=
          row.energyAtBoundary+EPS};
    });
    const volunteers=candidates.filter(row=>
      row.willingToLead&&row.payableLeader).sort((a,b)=>
      EFFORT_RANK[b.managerEffort]-
        EFFORT_RANK[a.managerEffort]||
      b.perceivedSoloAbility-a.perceivedSoloAbility||
      a.riderId.localeCompare(b.riderId));
    const leader=volunteers[0]??null;
    const shelter=leader?candidates.filter(row=>
      row.riderId!==leader.riderId&&row.payableShelter&&
      row.perceivedShelterHoldAbility+EPS>=
        leader.perceivedSoloAbility):[];
    const pendingLeader=shelter.length?leader:null;
    return {...choice,
      version:V94_PHYSICAL_PAYABLE_REAR_BOUNDARY_VERSION,
      previousChoiceVersion:choice.version,
      pendingLeaderRiderId:pendingLeader?.riderId??null,
      pendingShelterRiderIds:pendingLeader?
        shelter.map(row=>row.riderId):[],
      riderDecisions:candidates.map(row=>({
        ...row,version:V94_PHYSICAL_PAYABLE_REAR_BOUNDARY_VERSION,
        choice:!pendingLeader?'continue_paid_solo':
          row.riderId===pendingLeader.riderId?
            'volunteer_payable_rear_turn':
            shelter.includes(row)?
              'accept_payable_rear_shelter':
              'cannot_hold_payable_rear_turn'})),
      paidWorkPending:!!pendingLeader,
      formsRearGroup:false};
  });
  return {...base,
    version:V94_PHYSICAL_PAYABLE_REAR_BOUNDARY_VERSION,
    previousBoundaryVersion:base.version,
    choices,pendingGroupCount:choices.filter(row=>
      row.pendingLeaderRiderId!==null).length};
}

export function validateV94PhysicalPayableRearBoundaryV1(
  recording,prior,boundary,options){
  if(!isDeepStrictEqual(boundary,
    decideV94PhysicalPayableRearBoundaryV1(
      recording,prior,options)))
    throw new Error('Payable rear boundary differs from paid source.');
  return true;
}
