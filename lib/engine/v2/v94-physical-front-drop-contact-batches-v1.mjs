// Quote every measured crossing with the same paid rear solo road.
// These are decisions at contact, not a group, road move or finish.
import {auditV94PhysicalFrontDropContactsV1} from
  './v94-physical-front-drop-contact-audit-v1.mjs';
import {decideV94PhysicalFrontDropFirstBatchV1} from
  './v94-physical-front-drop-first-batch-choice-v1.mjs';
import {quoteV94PhysicalFrontDropContactV1} from
  './v94-physical-front-drop-contact-quote-v1.mjs';
import {priceRearEnergyDemandV1,
  quoteRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const V94_PHYSICAL_FRONT_DROP_CONTACT_BATCHES_VERSION=
  'v94-physical-front-drop-contact-batches-1';
const EPS=1e-7;

export function planV94PhysicalFrontDropContactBatchesV1(
  recording,prior,physicalRoads){
  const km=prior?.sourceKm+1;
  const audit=auditV94PhysicalFrontDropContactsV1(
    physicalRoads,{sourceKm:km});
  const first=decideV94PhysicalFrontDropFirstBatchV1(
    recording,prior,physicalRoads);
  const segment=recording.route.kilometres[km-1];
  const rider=recording.committedInputs.teams.flatMap(team=>
    team.riders).find(row=>row.id===first.passingRiderId);
  if(!rider||!audit.contactCount||
    audit.contacts.some(row=>
      row.kind!=='front_drop_rear_road'||
      row.secondRoadId!==first.passingRoadId||
      row.secondRiderId!==first.passingRiderId))
    throw new Error(
      'Front-drop batch plan needs one measured passing solo.');
  const groups=[];
  for(const contact of audit.contacts){
    const last=groups.at(-1);
    if(last&&Math.abs(last.clockSeconds-
      contact.clockSeconds)<=EPS&&
      Math.abs(last.atDistanceM-
        contact.atDistanceM)<=EPS)
      last.contacts.push(contact);
    else groups.push({clockSeconds:contact.clockSeconds,
      atDistanceM:contact.atDistanceM,contacts:[contact]});
  }
  const batches=groups.map((group,index)=>{
    const travelledM=group.atDistanceM-(km-1)*1000;
    const remainingM=1000-travelledM;
    const prefix=priceRearEnergyDemandV1({rider,segment,
      energyBefore:first.passingEnergyBeforeKm,
      effort:first.passingEffectiveEffort,role:'solo',
      distanceM:travelledM});
    const bonus=(TUNING.effortPressure[
      first.passingEffectiveEffort]-1)*20;
    const ability=riderKilometreEffect(rider,segment,{
      phase:'solo',energy:prefix.energyAfter,
      exposed:segment.exposed}).ability+bonus;
    const leader=quoteRearEnergyDemandV1({rider,segment,
      energyBefore:prefix.energyAfter,
      effort:first.passingEffectiveEffort,role:'leader',
      distanceM:remainingM});
    const willing=first.passingManagerBreakWork!=='sit_on'&&
      leader.energyDemand<=prefix.energyAfter+EPS;
    const dropQuotes=group.contacts.map(row=>
      quoteV94PhysicalFrontDropContactV1(recording,
        prior,physicalRoads,{riderId:row.firstRiderId,
          clockSeconds:row.clockSeconds,
          atDistanceM:row.atDistanceM,
          requiredAbility:ability}));
    const joinableRiderIds=willing?dropQuotes.filter(row=>
      row.choice==='eligible_for_paid_shelter')
      .map(row=>row.riderId):[];
    return {sourceKm:km,batchIndex:index+1,
      clockSeconds:group.clockSeconds,
      atDistanceM:group.atDistanceM,
      passingRoadId:first.passingRoadId,
      passingRiderId:first.passingRiderId,
      passingEnergyAtContact:prefix.energyAfter,
      passingPaidEnergyToContact:prefix.energyDemand,
      passingPerceivedSoloAbility:ability,
      passingQuotedLeaderEnergyDemand:
        leader.energyDemand,
      passingWillingToLead:willing,
      dropQuotes,joinableRiderIds,
      choice:joinableRiderIds.length?
        'pending_paid_contact_group':
        'continue_separate_paid_roads',
      physicalGroupFormed:false};
  });
  if(batches[0].dropQuotes.length!==first.drops.length||
    batches[0].joinableRiderIds.length!==
      first.pendingShelterRiderIds.length||
    batches.flatMap(row=>row.dropQuotes).length!==
      audit.contactCount)
    throw new Error('Front-drop batch plan lost paid contact.');
  return {version:V94_PHYSICAL_FRONT_DROP_CONTACT_BATCHES_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    auditVersion:audit.version,
    firstChoiceVersion:first.version,
    passingRiderId:first.passingRiderId,
    contactCount:audit.contactCount,
    batches,
    firstPayableBatchIndex:batches.findIndex(row=>
      row.joinableRiderIds.length>0)+1||null,
    physicalRoadMoved:false,
    physicalGroupFormed:false,
    fullFieldKilometre:false,officialResults:false};
}
