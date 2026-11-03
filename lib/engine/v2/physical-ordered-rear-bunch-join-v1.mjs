// Two riders may enter the paid bunch together only after their rear
// group reaches it and both pay and hold the remaining road.
import {isDeepStrictEqual} from 'node:util';
import {probePhysicalOrderedRearBunchContactV1} from
  './physical-ordered-rear-bunch-contact-v1.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';

export const PHYSICAL_ORDERED_REAR_BUNCH_JOIN_VERSION=
  'v2-physical-ordered-rear-bunch-join-1';

export function finishPhysicalOrderedRearBunchJoinKmV1(
  input){
  const source=probePhysicalOrderedRearBunchContactV1(
    input);
  const {startInput,throughKm:km}=input;
  const {contact}=source;
  const first=source.sources.first;
  const bunchStep=source.sources.bunchStep;
  if(!contact.nextChoiceUnsettled||
    !contact.physicalGroupsStillSeparate||
    contact.groupRiders.length!==2||
    contact.groupRiders.some(row=>
      !row.canHold||!row.payable||
      !row.reserveOkay||
      !row.shelterCheaper))
    throw new Error(
      'Rear bunch join needs two payable holding riders.');
  const remainingM=1000-contact.metresIntoKm;
  const groupDecisions=contact.groupRiders
    .map(row=>{
      const team=startInput.teams.find(item=>
        item.riders.some(rider=>
          rider.id===row.riderId));
      const rider=team.riders.find(item=>
        item.id===row.riderId);
      const sheltered=priceRearEnergyDemandV1({
        rider,
        segment:startInput.routeKilometres[km-1],
        energyBefore:row.energyAtContact,
        effort:row.intent.effort,
        role:'sheltered',
        distanceM:remainingM});
      const cap=replayRearEnergyCapV1({
        rider,
        kilometres:startInput.routeKilometres,
        throughKm:km}).cap;
      const energyAfter=+Math.min(cap,
        sheltered.energyAfter).toFixed(3);
      if(energyAfter<0||
        row.intent.action==='save_for_stage'&&
          energyAfter<row.intent
            .committedStagePlan.reserveEnergy)
        throw new Error(
          'Rear bunch join breaks paid energy reserve.');
      return {riderId:row.riderId,
        teamId:team.id,
        goal:row.intent.action,
        effort:row.intent.effort,
        teamOrderEffort:
          row.intent.teamOrderEffort,
        committedTeamStake:
          row.intent.committedTeamStake,
        choice:'join_bunch_shelter',
        reason:'paid_group_contact_shelter_saves_energy',
        atDistanceM:contact.atDistanceM,
        atClockSeconds:contact.clockSeconds,
        energyAtContact:
          row.energyAtContact,
        shelteredEnergySpent:
          sheltered.energyDemand,
        cap,energyAfter};
    });
  const riderIds=[...bunchStep.physicalGroup
    .riderIds,...groupDecisions.map(row=>
    row.riderId)];
  if(new Set(riderIds).size!==riderIds.length)
    throw new Error('Rear bunch join repeats rider.');
  const priorBunchClock=first.sources.boundary
    .prior.source.kilometres.at(-1)
    .riderStates.find(row=>
      row.physicalGroupId==='peloton')
    .elapsedSeconds;
  const bunchEndClock=priorBunchClock+
    bunchStep.elapsedSeconds;
  if(Math.abs(contact.clockSeconds+
    bunchStep.elapsedSeconds*remainingM/1000-
    bunchEndClock)>1e-6)
    throw new Error('Rear bunch join clock differs.');
  const bunchDecisions=new Map(
    bunchStep.riderDecisions.map(row=>[
      row.riderId,row]));
  const riderStates=bunchStep.physicalGroup
    .riderIds.map(riderId=>{
      const row=bunchStep.riders.find(item=>
        item.riderId===riderId);
      const decision=bunchDecisions.get(riderId);
      if(!row||!decision)
        throw new Error('Rear bunch join lacks prior rider.');
      return {riderId,sourceKm:km,
        physicalGroupId:'peloton',
        atDistanceM:km*1000,
        elapsedSeconds:bunchEndClock,
        energyAfter:row.energyAfter,
        decisions:[decision]};
    });
  for(const joined of groupDecisions){
    const id=joined.riderId;
    const approach=first.paidApproaches
      .find(row=>row.riderId===id);
    const rearContact=first.contact
      .riderDecisions.find(row=>
        row.riderId===id);
    const groupRoad=first.candidateGroupRoad
      .rows.find(row=>row.riderId===id);
    if(!approach||!rearContact||!groupRoad)
      throw new Error(
        'Rear bunch join lacks prior decision.');
    riderStates.push({riderId:id,
      sourceKm:km,
      physicalGroupId:'peloton',
      atDistanceM:km*1000,
      elapsedSeconds:bunchEndClock,
      energyAfter:joined.energyAfter,
      decisions:[approach.decision,
        rearContact,groupRoad.decision,
        joined]});
  }
  return {version:
    PHYSICAL_ORDERED_REAR_BUNCH_JOIN_VERSION,
  sourceKm:km,
  sources:{contact:source},
  contactAtDistanceM:
    contact.atDistanceM,
  contactClockSeconds:
    contact.clockSeconds,
  groupDecisions,
  bunchEndClock,riderStates,
  physicalGroup:{id:'peloton',
    riderIds,atDistanceM:km*1000},
  nextBunchState:{riderIds,
    energyByRider:{...bunchStep.energyByRider,
      ...Object.fromEntries(
        groupDecisions.map(row=>[
          row.riderId,row.energyAfter]))},
    quietKmByRider:{
      ...bunchStep.quietKmByRider,
      ...Object.fromEntries(
        groupDecisions.map(row=>[
          row.riderId,0]))}},
  otherRearRoadsUnsettled:true,
  fieldKilometreIncomplete:true,
  movesGuidedRace:false,
  officialResults:false};
}

export function validatePhysicalOrderedRearBunchJoinKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    finishPhysicalOrderedRearBunchJoinKmV1(input)))
    throw new Error(
      'Rear bunch join differs from paid source.');
  return true;
}
