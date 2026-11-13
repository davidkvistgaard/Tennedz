// Add eligible riders at the next measured contact with a paid group.
// Existing leader and sheltered work retain their original paid finish.
import {inspectV94PhysicalFrontDropFirstBatchNextV1} from
  './v94-physical-front-drop-first-batch-next-v1.mjs';
import {quoteV94PhysicalFrontDropContactV1} from
  './v94-physical-front-drop-contact-quote-v1.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';

export const V94_PHYSICAL_FRONT_DROP_BATCH_EXTENSION_VERSION=
  'v94-physical-front-drop-batch-extension-1';
const EPS=1e-7;

export function extendV94PhysicalFrontDropBatchV1(
  recording,prior,physicalRoads,fragment){
  const probe=inspectV94PhysicalFrontDropFirstBatchNextV1(
    physicalRoads,fragment);
  const contact=probe.firstAdditionalContact;
  const km=prior?.sourceKm+1;
  const segment=recording.route.kilometres[km-1];
  if(fragment.sourceKm!==km||segment?.km!==km||
    !contact||
    !contact.roadIds.every(row=>
      row[0]===fragment.road.roadId&&
      row[1].startsWith('solo-'))||
    !Number.isFinite(fragment.requiredAbility))
    throw new Error('Front-drop extension needs paid group contact.');
  const riderIds=contact.riderIds.flat();
  if(new Set(riderIds).size!==riderIds.length)
    throw new Error('Front-drop extension repeats a rider.');
  const quotes=riderIds.map(riderId=>
    quoteV94PhysicalFrontDropContactV1(
      recording,prior,physicalRoads,{
        riderId,clockSeconds:contact.clockSeconds,
        atDistanceM:contact.atDistanceM,
        requiredAbility:fragment.requiredAbility}));
  const eligible=quotes.filter(row=>
    row.choice==='eligible_for_paid_shelter');
  if(!eligible.length)
    throw new Error('Front-drop extension has no payable join.');
  const riders=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[rider.id,rider])));
  const addedWork=eligible.map(row=>{
    const rider=riders.get(row.riderId);
    const paid=priceRearEnergyDemandV1({rider,segment,
      energyBefore:row.energyAtContact,
      effort:row.effectiveEffort,role:'sheltered',
      distanceM:row.remainingDistanceM});
    const rest=recoveryForKilometre({rider,segment,
      effort:row.effectiveEffort,group:'dropped',
      working:false,quietKm:0});
    if(rest.recovery!==0)
      throw new Error('Front-drop extension cannot claim recovery.');
    const cap=replayRearEnergyCapV1({rider,
      kilometres:recording.route.kilometres,
      throughKm:km}).cap;
    const paidFromReserve=row.paidEnergyToContact+
      paid.energyDemand;
    const capAdjustment=Math.max(0,paid.energyAfter-cap);
    const energyAfter=+Math.min(cap,paid.energyAfter)
      .toFixed(3);
    if(Math.abs(row.energyBeforeKm-paidFromReserve-
      capAdjustment-energyAfter)>.001+EPS)
      throw new Error('Front-drop extension breaks reserve.');
    return {version:V94_PHYSICAL_FRONT_DROP_BATCH_EXTENSION_VERSION,
      sourceKm:km,riderId:row.riderId,
      previousPhysicalGroup:'peloton',
      roleAfterContact:'sheltered',
      teamOrderEffort:row.managerEffort,
      effectiveEffort:row.effectiveEffort,
      sportingGoal:row.sportingGoal,
      sportingCaptainId:row.sportingCaptainId,
      perceivedAbilityAtChoice:
        row.perceivedShelterHoldAbility,
      energyBeforeKm:row.energyBeforeKm,
      paidEnergyToContact:row.paidEnergyToContact,
      energyAtContact:row.energyAtContact,
      paidEnergyAfterContact:paid.energyDemand,
      paidFromReserve,recoveryAward:0,
      capAdjustment,energyAfter,
      atContactDistanceM:row.atDistanceM,
      endDistanceM:km*1000,
      finishClockSeconds:fragment.road.finishClockSeconds};
  });
  const unjoined=quotes.filter(row=>
    row.choice!=='eligible_for_paid_shelter');
  const receipts=[...(fragment.passThroughContacts??[]),
    ...unjoined.map(row=>({version:
        V94_PHYSICAL_FRONT_DROP_BATCH_EXTENSION_VERSION,
      sourceKm:km,clockSeconds:row.contactClockSeconds,
      atDistanceM:row.atDistanceM,
      passingRoadId:fragment.road.roadId,
      passedRoadId:`solo-${row.riderId}`,
      passedRiderId:row.riderId,
      energyAtContact:row.energyAtContact,
      requiredAbility:row.requiredAbility,
      perceivedShelterHoldAbility:
        row.perceivedShelterHoldAbility,
      choice:'continue_separate_paid_road',
      formsRearGroup:false}))];
  return {version:V94_PHYSICAL_FRONT_DROP_BATCH_EXTENSION_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    firstFragmentVersion:fragment.firstFragmentVersion??
      fragment.version,
    previousFragmentVersion:fragment.version,
    contactProbeVersion:probe.version,
    contactClockSeconds:contact.clockSeconds,
    atDistanceM:contact.atDistanceM,
    requiredAbility:fragment.requiredAbility,
    road:{...fragment.road,
      shelteredRiderIds:[...fragment.road.shelteredRiderIds,
        ...eligible.map(row=>row.riderId)]},
    riderWork:[...fragment.riderWork,...addedWork],
    contactHistory:[...(fragment.contactHistory??[]),{
      clockSeconds:contact.clockSeconds,
      atDistanceM:contact.atDistanceM,
      joinedRiderIds:eligible.map(row=>row.riderId),
      passedRiderIds:unjoined.map(row=>row.riderId)}],
    passThroughContacts:receipts,
    paidContactGroupFragment:true,
    otherRoadContactsUnchecked:true,
    fullFieldKilometre:false,officialResults:false};
}
