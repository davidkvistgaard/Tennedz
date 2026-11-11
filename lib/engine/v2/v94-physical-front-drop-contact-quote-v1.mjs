// Quote one recorded drop at an observed paid road contact.
// An eligible quote does not itself join a group or change its road.
import {priceRearEnergyDemandV1,
  quoteRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {orderAt} from './orders.mjs';
import {MOTOR_DRAFT_SHELTER,TUNING} from './tuning.mjs';

export const V94_PHYSICAL_FRONT_DROP_CONTACT_QUOTE_VERSION=
  'v94-physical-front-drop-contact-quote-1';
const EPS=1e-7;

export function quoteV94PhysicalFrontDropContactV1(
  recording,prior,physicalRoads,{riderId,
    clockSeconds,atDistanceM,requiredAbility}){
  const km=prior?.sourceKm+1;
  const segment=recording.route.kilometres[km-1];
  const drop=physicalRoads?.newFrontDrops?.find(row=>
    row.riderId===riderId);
  const member=recording.committedInputs.teams.flatMap(team=>
    team.riders.filter(rider=>rider.id===riderId).map(rider=>
      ({rider,team})))[0];
  const previous=prior?.finishes?.find(row=>
    row.riderId===riderId);
  const stake=recording.committedInputs.rivalIntent?.find(row=>
    row.teamId===member?.team.id);
  const onPaidRoad=drop?.segments?.some(path=>{
    if(clockSeconds<path.startClockSeconds-EPS||
      clockSeconds>path.endClockSeconds+EPS)return false;
    const fraction=(clockSeconds-path.startClockSeconds)/
      (path.endClockSeconds-path.startClockSeconds);
    return Math.abs(path.startDistanceM+fraction*
      (path.endDistanceM-path.startDistanceM)-
      atDistanceM)<=1e-5;
  });
  if(!Number.isInteger(km)||segment?.km!==km||
    !drop||!onPaidRoad||!member||!previous||
    previous.physicalGroup!=='peloton'||
    !stake?.sportingGoal||
    !Number.isFinite(requiredAbility)||
    !Number.isFinite(clockSeconds)||
    !Number.isFinite(atDistanceM)||
    atDistanceM<=(km-1)*1000+EPS||
    atDistanceM>=km*1000-EPS)
    throw new Error('Front-drop quote needs measured paid contact.');
  const order=orderAt(member.team.orders,km-1);
  const slice=physicalRoads.front.road.flatMap(turn=>
    turn.riderSlices.filter(row=>
      row.riderId===riderId&&row.role==='solo'&&
      clockSeconds>=turn.startClockSeconds-EPS&&
      clockSeconds<=turn.endClockSeconds+EPS&&
      atDistanceM>=row.startDistanceM-EPS&&
      atDistanceM<=row.endDistanceM+EPS))[0];
  let energyBeforePrefix,effort,prefixDistanceM;
  if(slice){
    energyBeforePrefix=slice.energyBefore;
    effort=slice.effort;
    prefixDistanceM=atDistanceM-slice.startDistanceM;
    if(order.effort!==effort&&!(
      physicalRoads.front.recordedRestMode===true&&
      slice.decision?.recordedSourceRest===true&&
      slice.decision?.teamOrderEffort===order.effort&&
      effort==='conserve'))
      throw new Error('Front-drop quote changed committed effort.');
  }else{
    const atFront=physicalRoads.front.atFrontClock.find(row=>
      row.riderId===riderId&&!row.attached);
    if(!atFront||
      clockSeconds<physicalRoads.front.frontClockSeconds-EPS||
      atDistanceM<=atFront.atDistanceM+EPS)
      throw new Error('Front-drop quote lacks paid solo slice.');
    energyBeforePrefix=atFront.reserveBeforeRecovery;
    effort=order.effort;
    prefixDistanceM=atDistanceM-atFront.atDistanceM;
  }
  const prefix=priceRearEnergyDemandV1({
    rider:member.rider,segment,
    energyBefore:energyBeforePrefix,
    effort,role:'solo',distanceM:prefixDistanceM});
  const remainingDistanceM=km*1000-atDistanceM;
  const shelter=quoteRearEnergyDemandV1({
    rider:member.rider,segment,
    energyBefore:prefix.energyAfter,
    effort,role:'sheltered',
    distanceM:remainingDistanceM});
  const hold=energy=>
    riderKilometreEffect(member.rider,segment,{
      phase:'cruise',energy,
      exposed:segment.exposed}).ability+
      (TUNING.effortPressure[effort]-1)*20+
      MOTOR_DRAFT_SHELTER[segment.terrain];
  const holdNow=hold(prefix.energyAfter);
  const holdEnd=hold(Math.max(0,
    prefix.energyAfter-shelter.energyDemand));
  const canShelter=shelter.energyDemand<=
    prefix.energyAfter+EPS&&
    holdNow+EPS>=requiredAbility&&
    holdEnd+EPS>=requiredAbility;
  return {version:V94_PHYSICAL_FRONT_DROP_CONTACT_QUOTE_VERSION,
    sourceKm:km,riderId,teamId:member.team.id,
    contactClockSeconds:clockSeconds,
    atDistanceM,remainingDistanceM,
    managerEffort:order.effort,
    effectiveEffort:effort,
    managerBreakWork:order.breakWork,
    sportingGoal:stake.sportingGoal,
    sportingCaptainId:stake.sportingCaptainId,
    energyBeforeKm:previous.energyAfter,
    energyAtContact:prefix.energyAfter,
    paidEnergyToContact:previous.energyAfter-
      prefix.energyAfter,
    requiredAbility,
    perceivedShelterHoldAbility:holdNow,
    perceivedShelterHoldAbilityAtEnd:holdEnd,
    quotedShelterEnergyDemand:shelter.energyDemand,
    choice:canShelter?'eligible_for_paid_shelter':
      'continue_separate_paid_road',
    physicalGroupFormed:false,officialResults:false};
}
