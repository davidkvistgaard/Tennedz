// Quote continuation of one paid contact fragment at its next meeting.
// Existing shelter stays paid; new wheels remain proposals until settled.
import {isDeepStrictEqual} from 'node:util';
import {replayV94PhysicalSixthKmV1} from
  './v94-physical-sixth-km-v1.mjs';
import {replayV94PhysicalFrontDropContactFragmentV1} from
  './v94-physical-front-drop-contact-fragment-v1.mjs';
import {inspectV94PhysicalFrontDropContactNextV1} from
  './v94-physical-front-drop-contact-next-probe-v1.mjs';
import {priceRearEnergyDemandV1,
  quoteRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {orderAt} from './orders.mjs';
import {MOTOR_DRAFT_SHELTER,TUNING} from './tuning.mjs';

export const V94_PHYSICAL_FRONT_DROP_SECOND_CONTACT_CHOICE_VERSION=
  'v94-physical-front-drop-second-contact-choice-1';
export const V94_PHYSICAL_FRONT_DROP_SECOND_CONTACT_RIDER_VERSION=
  'v94-physical-front-drop-second-contact-rider-1';
const EPS=1e-8;

export function decideV94PhysicalFrontDropSecondContactChoiceV1(
  recording,prior){
  const first=replayV94PhysicalFrontDropContactFragmentV1(
    recording,prior);
  const probe=inspectV94PhysicalFrontDropContactNextV1(
    recording,prior);
  const contact=probe.firstAdditionalContact;
  const km=first.sourceKm;
  const segment=recording.route.kilometres[km-1];
  const middleM=contact?.atDistanceM-first.atDistanceM;
  const remainingM=km*1000-contact?.atDistanceM;
  if(contact?.riderIds.length<1||
    contact.priorRoadKinds.some(kind=>
      kind!=='front_drop_solo')||
    !Number.isFinite(middleM)||middleM<=0||
    !Number.isFinite(remainingM)||remainingM<=0||
    new Set(contact.riderIds).size!==contact.riderIds.length)
    throw new Error('Second contact needs measured co-located drops.');
  let physicalRoads;
  try{replayV94PhysicalSixthKmV1(recording,prior);}
  catch(error){
    if(error.message!==
      'Physical front drop/rear contact needs paid resolution.')
      throw error;
    physicalRoads=error.physicalRoads;
  }
  if(!physicalRoads?.newFrontDrops||!physicalRoads.front?.road)
    throw new Error('Second contact lacks paid drop roads.');
  const sources=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[
      rider.id,{rider,team}])));
  const stakes=new Map(recording.committedInputs.rivalIntent?.map(
    row=>[row.teamId,row])??[]);
  const priorFinishes=new Map(prior.finishes.map(row=>[
    row.riderId,row]));
  const existing=first.riderWork.map(work=>{
    const source=sources.get(work.riderId);
    if(!source||!['leader','sheltered'].includes(
      work.roleAfterContact))
      throw new Error('Second contact lacks first paid work.');
    const price=priceRearEnergyDemandV1({
      rider:source.rider,segment,
      energyBefore:work.energyAtContact,
      effort:work.effectiveEffort,
      role:work.roleAfterContact,distanceM:middleM});
    return {source,energyBeforeKm:work.energyBeforeKm,
      priorRole:work.roleAfterContact,
      previousPhysicalGroup:first.road.roadId,
      effectiveEffort:work.effectiveEffort,
      paidEnergyToContact:work.paidEnergyToContact+
        price.energyDemand,
      energyAtContact:price.energyAfter,
      joinedFirstContact:true};
  });
  const newlyMet=contact.riderIds.map(riderId=>{
    const source=sources.get(riderId);
    const previous=priorFinishes.get(riderId);
    const drop=physicalRoads.newFrontDrops.find(row=>
      row.riderId===riderId);
    const slice=physicalRoads.front.road.flatMap(turn=>
      turn.riderSlices.filter(row=>
        row.riderId===riderId&&
        contact.atDistanceM>=row.startDistanceM-EPS&&
        contact.atDistanceM<=row.endDistanceM+EPS))
      .find(row=>row.role==='solo');
    if(!source||!previous||!drop||!slice||
      previous.physicalGroup!=='peloton')
      throw new Error('Second contact lacks new drop source.');
    const price=priceRearEnergyDemandV1({
      rider:source.rider,segment,
      energyBefore:slice.energyBefore,
      effort:slice.effort,role:'solo',
      distanceM:contact.atDistanceM-
        slice.startDistanceM});
    return {source,energyBeforeKm:previous.energyAfter,
      priorRole:'front_drop_solo',
      previousPhysicalGroup:`solo-${riderId}`,
      effectiveEffort:slice.effort,
      paidEnergyToContact:previous.energyAfter-
        price.energyAfter,
      energyAtContact:price.energyAfter,
      joinedFirstContact:false};
  });
  const candidates=[...existing,...newlyMet].map(row=>{
    const {rider,team}=row.source;
    const stake=stakes.get(team.id);
    const order=orderAt(team.orders,km-1);
    if(!stake?.sportingGoal||!stake.sportingCaptainId)
      throw new Error('Second contact lacks sporting stake.');
    const bonus=(TUNING.effortPressure[
      row.effectiveEffort]-1)*20;
    const soloAbility=riderKilometreEffect(rider,segment,{
      phase:'solo',energy:row.energyAtContact,
      exposed:segment.exposed}).ability+bonus;
    const shelter=quoteRearEnergyDemandV1({rider,segment,
      energyBefore:row.energyAtContact,
      effort:row.effectiveEffort,role:'sheltered',
      distanceM:remainingM});
    const holdAt=(energy)=>riderKilometreEffect(
      rider,segment,{phase:'cruise',energy,
        exposed:segment.exposed}).ability+bonus+
        MOTOR_DRAFT_SHELTER[segment.terrain];
    const lead=quoteRearEnergyDemandV1({rider,segment,
      energyBefore:row.energyAtContact,
      effort:row.effectiveEffort,role:'leader',
      distanceM:remainingM});
    return {
      version:V94_PHYSICAL_FRONT_DROP_SECOND_CONTACT_RIDER_VERSION,
      sourceKm:km,riderId:rider.id,teamId:team.id,
      previousPhysicalGroup:row.previousPhysicalGroup,
      paidRoleBeforeContact:row.priorRole,
      joinedFirstContact:row.joinedFirstContact,
      managerEffort:order.effort,
      effectiveEffort:row.effectiveEffort,
      managerChase:order.chase,
      managerBreakWork:order.breakWork??null,
      sportingGoal:stake.sportingGoal,
      sportingCaptainId:stake.sportingCaptainId,
      energyBeforeKm:row.energyBeforeKm,
      paidEnergyToContact:row.paidEnergyToContact,
      energyAtContact:row.energyAtContact,
      perceivedSoloAbility:soloAbility,
      perceivedShelterHoldAbility:holdAt(
        row.energyAtContact),
      perceivedShelterHoldAbilityAtEnd:holdAt(
        Math.max(0,row.energyAtContact-
          shelter.energyDemand)),
      quotedLeaderEnergyDemand:lead.energyDemand,
      quotedShelterEnergyDemand:shelter.energyDemand};
  });
  const leader=candidates.find(row=>
    row.riderId===first.road.leaderRiderId);
  if(!leader||leader.quotedLeaderEnergyDemand>
    leader.energyAtContact+EPS||
    leader.managerBreakWork==='sit_on')
    throw new Error('Second contact loses the paid leader.');
  const hold=row=>
    row.perceivedShelterHoldAbility+EPS>=
      leader.perceivedSoloAbility&&
    row.perceivedShelterHoldAbilityAtEnd+EPS>=
      leader.perceivedSoloAbility&&
    row.quotedShelterEnergyDemand<=
      row.energyAtContact+EPS;
  if(candidates.some(row=>row.joinedFirstContact&&
    row.riderId!==leader.riderId&&!hold(row)))
    throw new Error('Second contact loses paid prior shelter.');
  const sheltered=candidates.filter(row=>
    row.riderId!==leader.riderId&&hold(row));
  return {
    version:V94_PHYSICAL_FRONT_DROP_SECOND_CONTACT_CHOICE_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    priorFragmentVersion:first.version,
    nextProbeVersion:probe.version,
    contactClockSeconds:contact.clockSeconds,
    atDistanceM:contact.atDistanceM,
    remainingDistanceM:remainingM,
    observedRoadIds:[first.road.roadId,
      ...contact.roadIds],
    candidates:candidates.map(row=>({...row,
      choice:row.riderId===leader.riderId?
        'continue_paid_lead_after_contact':
        sheltered.includes(row)?
          'hold_paid_shelter_after_contact':
          'continue_individual_paid_road'})),
    pendingLeaderRiderId:leader.riderId,
    pendingShelterRiderIds:sheltered.map(row=>
      row.riderId),
    physicalGroupFormed:false,
    fullFieldKilometre:false,officialResults:false};
}

export function validateV94PhysicalFrontDropSecondContactChoiceV1(
  recording,prior,choice){
  if(!isDeepStrictEqual(choice,
    decideV94PhysicalFrontDropSecondContactChoiceV1(
      recording,prior)))
    throw new Error(
      'Second front-drop choice differs from paid source.');
  return true;
}
