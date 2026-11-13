// Price each measured solo overtake of an early front drop. When none
// can hold paid shelter, both riders keep their separate physical roads.
import {isDeepStrictEqual} from 'node:util';
import {replayV94PhysicalSixthKmV1} from
  './v94-physical-sixth-km-v1.mjs';
import {decideV94PhysicalFrontDropContactChoiceV1} from
  './v94-physical-front-drop-contact-choice-v1.mjs';
import {firstV94SecondPiecewiseContactV1} from
  './v94-physical-second-rear-km-v1.mjs';
import {priceRearEnergyDemandV1,
  quoteRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {orderAt} from './orders.mjs';
import {MOTOR_DRAFT_SHELTER,TUNING} from './tuning.mjs';

export const V94_PHYSICAL_FRONT_DROP_NO_JOIN_CHOICE_VERSION=
  'v94-physical-front-drop-no-join-choice-1';
const EPS=1e-8;
const roadSegment=road=>({
  startClockSeconds:road.startClockSeconds,
  endClockSeconds:road.finishClockSeconds,
  startDistanceM:road.startDistanceM,
  endDistanceM:road.endDistanceM});

export function decideV94PhysicalFrontDropNoJoinChoiceV1(
  recording,prior){
  const first=decideV94PhysicalFrontDropContactChoiceV1(
    recording,prior);
  if(first.pendingLeaderRiderId!==null||
    first.pendingShelterRiderIds.length||
    first.paidWorkPending)
    throw new Error('No-join choice has a payable group.');
  let physicalRoads;
  try{replayV94PhysicalSixthKmV1(recording,prior);}
  catch(error){
    if(error.message!==
      'Physical front drop/rear contact needs paid resolution.')
      throw error;
    physicalRoads=error.physicalRoads;
  }
  const km=6;
  const segment=recording.route.kilometres[km-1];
  const {roads,newFrontDrops,frontSegments,front}=physicalRoads??{};
  if(segment?.km!==km||!Array.isArray(roads)||
    !Array.isArray(newFrontDrops)||!newFrontDrops.length||
    !Array.isArray(frontSegments)||!front?.road)
    throw new Error('No-join choice lacks measured roads.');
  const solo=roads.find(row=>
    row.roadId===first.observedRoadIds[0]);
  const soloWork=solo?.riderDecisions?.[0];
  if(solo?.kind!=='solo'||
    solo.riderDecisions.length!==1||
    soloWork.role!=='solo')
    throw new Error('No-join choice needs the paid passing solo.');
  const sources=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[
      rider.id,{rider,team}])));
  const stakes=new Map(recording.committedInputs.rivalIntent?.map(
    row=>[row.teamId,row])??[]);
  const priorFinishes=new Map(prior.finishes.map(row=>[
    row.riderId,row]));
  const soloSource=sources.get(soloWork.riderId);
  const soloPrior=priorFinishes.get(soloWork.riderId);
  if(!soloSource||!soloPrior||
    soloPrior.physicalGroup!==solo.previousGroupIds[0]||
    soloWork.energyBefore!==soloPrior.energyAfter)
    throw new Error('No-join solo lacks paid prior road.');
  const contacts=[];
  const payableContacts=[];
  for(const drop of newFrontDrops){
    const crossing=firstV94SecondPiecewiseContactV1(
      [roadSegment(solo)],drop.segments);
    if(!crossing)continue;
    if(crossing.atDistanceM<=5000||
      crossing.atDistanceM>=6000)
      throw new Error('No-join choice lacks travelled contact.');
    const source=sources.get(drop.riderId);
    const priorFinish=priorFinishes.get(drop.riderId);
    const slice=front.road.flatMap(turn=>
      turn.riderSlices.filter(row=>
        row.riderId===drop.riderId&&
        row.role==='solo'&&
        crossing.atDistanceM>=row.startDistanceM-EPS&&
        crossing.atDistanceM<=row.endDistanceM+EPS))[0];
    if(!source||!priorFinish||!slice||
      priorFinish.physicalGroup!=='peloton'||
      !stakes.get(source.team.id)?.sportingGoal||
      !stakes.get(soloSource.team.id)?.sportingGoal)
      throw new Error('No-join drop lacks paid source.');
    const dropPrice=priceRearEnergyDemandV1({
      rider:source.rider,segment,
      energyBefore:slice.energyBefore,
      effort:slice.effort,role:'solo',
      distanceM:crossing.atDistanceM-
        slice.startDistanceM});
    const soloPrice=priceRearEnergyDemandV1({
      rider:soloSource.rider,segment,
      energyBefore:soloWork.energyBefore,
      effort:soloWork.effort,role:'solo',
      distanceM:crossing.atDistanceM-5000});
    const remainingM=6000-crossing.atDistanceM;
    const order=orderAt(source.team.orders,km-1);
    const soloOrder=orderAt(soloSource.team.orders,km-1);
    if(soloOrder.effort!==soloWork.effort||
      order.effort!==slice.effort&&!(
        front.sourceRestDecisionUsed===true&&
        front.recordedSourceRestTeamIds?.includes(
          source.team.id)&&slice.effort==='conserve'))
      throw new Error('No-join choice changed committed effort.');
    const bonus=(TUNING.effortPressure[
      slice.effort]-1)*20;
    const soloBonus=(TUNING.effortPressure[
      soloWork.effort]-1)*20;
    const leaderAbility=riderKilometreEffect(
      soloSource.rider,segment,{phase:'solo',
        energy:soloPrice.energyAfter,
        exposed:segment.exposed}).ability+soloBonus;
    const shelter=quoteRearEnergyDemandV1({
      rider:source.rider,segment,
      energyBefore:dropPrice.energyAfter,
      effort:slice.effort,role:'sheltered',
      distanceM:remainingM});
    const holdAt=energy=>riderKilometreEffect(
      source.rider,segment,{phase:'cruise',energy,
        exposed:segment.exposed}).ability+bonus+
        MOTOR_DRAFT_SHELTER[segment.terrain];
    const holdNow=holdAt(dropPrice.energyAfter);
    const holdEnd=holdAt(Math.max(0,
      dropPrice.energyAfter-shelter.energyDemand));
    const canHold=holdNow+EPS>=leaderAbility&&
      holdEnd+EPS>=leaderAbility&&
      shelter.energyDemand<=dropPrice.energyAfter+EPS;
    const quote={version:
      V94_PHYSICAL_FRONT_DROP_NO_JOIN_CHOICE_VERSION,
    sourceKm:km,clockSeconds:crossing.clockSeconds,
    atDistanceM:crossing.atDistanceM,
    soloRoadId:solo.roadId,soloRiderId:soloWork.riderId,
    dropRoadId:`solo-${drop.riderId}`,
    dropRiderId:drop.riderId,
    soloManagerEffort:soloOrder.effort,
    soloManagerBreakWork:soloOrder.breakWork??null,
    soloSportingGoal:stakes.get(soloSource.team.id)
      .sportingGoal,
    dropManagerEffort:order.effort,
    dropEffectiveEffort:slice.effort,
    dropSportingGoal:stakes.get(source.team.id)
      .sportingGoal,
    soloEnergyAtContact:soloPrice.energyAfter,
    dropEnergyAtContact:dropPrice.energyAfter,
    quotedShelterEnergyDemand:shelter.energyDemand,
    perceivedLeaderAbility:leaderAbility,
    perceivedShelterHoldAbility:holdNow,
    perceivedShelterHoldAbilityAtEnd:holdEnd,
    choice:canHold?'pending_paid_shelter_contact':
      'continue_separate_paid_roads',
    physicalGroupFormed:false};
    (canHold?payableContacts:contacts).push(quote);
  }
  contacts.sort((a,b)=>a.clockSeconds-b.clockSeconds||
    a.dropRiderId.localeCompare(b.dropRiderId));
  payableContacts.sort((a,b)=>a.clockSeconds-b.clockSeconds||
    a.dropRiderId.localeCompare(b.dropRiderId));
  if(contacts.length+payableContacts.length!==
      newFrontDrops.length||
    !first.candidates.filter(row=>
      row.riderId!==soloWork.riderId).every(row=>
      contacts.some(contact=>
        contact.dropRiderId===row.riderId&&
        Math.abs(contact.clockSeconds-
          first.contactClockSeconds)<EPS))||
    payableContacts.some(row=>
      row.clockSeconds<=first.contactClockSeconds+EPS))
    throw new Error('No-join choice leaves a drop contact unresolved.');
  return {version:V94_PHYSICAL_FRONT_DROP_NO_JOIN_CHOICE_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    firstContactChoiceVersion:first.version,
    soloRoadId:solo.roadId,
    contacts,
    nextPayableContact:payableContacts.length?{
      clockSeconds:payableContacts[0].clockSeconds,
      atDistanceM:payableContacts[0].atDistanceM,
      candidates:payableContacts.filter(row=>
        Math.abs(row.clockSeconds-
          payableContacts[0].clockSeconds)<EPS&&
        Math.abs(row.atDistanceM-
          payableContacts[0].atDistanceM)<1e-6)}:null,
    laterPayableContactCount:payableContacts.length,
    checkedRearRoadCount:roads.length,
    checkedFrontDropCount:newFrontDrops.length,
    physicalGroupFormed:false,
    fullFieldKilometre:false,officialResults:false};
}

export function validateV94PhysicalFrontDropNoJoinChoiceV1(
  recording,prior,choice){
  if(!isDeepStrictEqual(choice,
    decideV94PhysicalFrontDropNoJoinChoiceV1(
      recording,prior)))
    throw new Error('No-join choice differs from paid roads.');
  return true;
}
