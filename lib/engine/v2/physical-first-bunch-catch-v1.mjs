// A faster paid bunch catches one paid solo road inside a kilometre.
// The caught rider may take payable shelter or slide through the bunch.
import {isDeepStrictEqual} from 'node:util';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {quoteRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {advancePhysicalFirstRoadV1} from
  './physical-first-road-step-v1.mjs';
import {projectPhysicalFirstRoadMeetingV1} from
  './physical-first-road-crossing-guard-v1.mjs';
import {MOTOR_DRAFT_SHELTER,TUNING} from './tuning.mjs';

export const PHYSICAL_FIRST_BUNCH_CATCH_VERSION=
  'physical-first-bunch-catch-1';
const EPS=.002;

export function resolvePhysicalFirstBunchCatchV1({prior,
  pelotonStep,soloStep,segment,kilometres,
  teams,stakes}){
  const km=prior?.sourceKm+1;
  const bunch=prior?.roads?.find(row=>
    row.roadId==='peloton');
  const oldSolo=prior?.roads?.find(row=>
    row.roadId===soloStep?.road?.roadId);
  const soloId=oldSolo?.riderIds?.[0];
  const riderState=prior?.riders?.find(row=>
    row.riderId===soloId);
  const source=teams?.flatMap(team=>
    team.riders.map(rider=>({team,rider})))
    .find(row=>row.rider.id===soloId);
  const order=source&&orderAt(source.team.orders,
    km-1);
  const stake=stakes?.find(row=>
    row.teamId===source?.team.id);
  const paidBunch=pelotonStep?.road;
  const paidSolo=soloStep?.road;
  if(segment?.km!==km||kilometres?.[km-1]?.km!==km||
    !bunch||!oldSolo||oldSolo.roadId==='peloton'||
    oldSolo.riderIds.length!==1||
    !riderState||!source||!order?.effort||
    !stake?.sportingGoal||!stake.sportingCaptainId||
    riderState.roadId!==oldSolo.roadId||
    riderState.distanceM!==(km-1)*1000||
    Math.abs(riderState.clockSeconds-
      oldSolo.clockSeconds)>EPS||
    paidBunch?.roadId!=='peloton'||
    paidSolo?.kind!=='solo'||
    paidSolo.riderIds?.[0]!==soloId||
    paidSolo.riderIds.length!==1||
    paidBunch.startDistanceM!==(km-1)*1000||
    paidSolo.startDistanceM!==(km-1)*1000||
    paidBunch.endDistanceM!==km*1000||
    paidSolo.endDistanceM!==km*1000||
    Math.abs(paidBunch.startClockSeconds-
      bunch.clockSeconds)>EPS||
    Math.abs(paidSolo.startClockSeconds-
      oldSolo.clockSeconds)>EPS||
    !(pelotonStep.finishes?.length>0)||
    soloStep.finishes?.length!==1)
    throw new Error('Bunch catch needs paid full-road approaches.');
  const expectedSolo=advancePhysicalFirstRoadV1({
    prior,roadId:oldSolo.roadId,
    leaderRiderId:soloId,
    planVersion:soloStep.planVersion,
    segment,kilometres,teams,stakes});
  if(!isDeepStrictEqual(soloStep,expectedSolo))
    throw new Error('Caught solo work differs from paid road.');
  const meeting=projectPhysicalFirstRoadMeetingV1(
    prior.sourceKm,bunch.clockSeconds,
    oldSolo.clockSeconds,
    paidBunch.finishClockSeconds,
    paidSolo.finishClockSeconds);
  const fraction=meeting?.fractionOfKilometre;
  if(!(fraction>EPS&&fraction<1-EPS)||
    !(bunch.clockSeconds>oldSolo.clockSeconds+EPS)||
    !(paidBunch.finishClockSeconds<
      paidSolo.finishClockSeconds-EPS))
    throw new Error('Bunch does not catch solo inside kilometre.');
  const approach=quoteRearEnergyDemandV1({
    rider:source.rider,segment,
    energyBefore:riderState.reserve,
    effort:order.effort,role:'solo',
    distanceM:fraction*1000});
  const reserveAtContact=riderState.reserve-
    approach.energyDemand;
  if(reserveAtContact<0)
    throw new Error('Caught solo cannot pay approach.');
  const remainingM=(1-fraction)*1000;
  const shelter=quoteRearEnergyDemandV1({
    rider:source.rider,segment,
    energyBefore:reserveAtContact,
    effort:order.effort,role:'sheltered',
    distanceM:remainingM});
  const bunchLeader=paidBunch.leaderRiderId;
  const leaderDecision=paidBunch.riderDecisions
    ?.find(row=>row.riderId===bunchLeader);
  if(!leaderDecision||
    leaderDecision.role!=='leader'||
    !Number.isFinite(leaderDecision.leaderAbility))
    throw new Error('Bunch catch lacks one paid leader.');
  const effortBonus=(TUNING.effortPressure[
    order.effort]-1)*20+
    MOTOR_DRAFT_SHELTER[segment.terrain];
  const holdAt=energy=>energy>=0&&
    riderKilometreEffect(source.rider,segment,{
      phase:'cruise',energy,
      exposed:segment.exposed}).ability+
      effortBonus+EPS>=
      leaderDecision.leaderAbility;
  const canHold=holdAt(reserveAtContact)&&
    holdAt(reserveAtContact-
      shelter.energyDemand);
  const event={version:PHYSICAL_FIRST_BUNCH_CATCH_VERSION,
    sourceKm:km,atDistanceM:meeting.atDistanceM,
    atClockSeconds:meeting.atClockSeconds,
    fromRoadId:oldSolo.roadId,toRoadId:'peloton',
    riderId:soloId,bunchLeaderRiderId:bunchLeader,
    paidSoloApproachM:fraction*1000,
    paidSoloApproachCost:approach.energyDemand,
    reserveAtContact,
    perceivedShelterHoldAbility:
      riderKilometreEffect(source.rider,segment,{
        phase:'cruise',energy:reserveAtContact,
        exposed:segment.exposed}).ability+
      effortBonus,
    bunchLeaderAbility:
      leaderDecision.leaderAbility,
    choice:canHold?'join_paid_bunch_shelter':
      'slide_through_unholdable_bunch',
    recordedPaidContact:true,
    officialResults:false};
  if(!canHold)return {version:
    PHYSICAL_FIRST_BUNCH_CATCH_VERSION,
    event,road:paidBunch,
    finish:null,joined:false};
  const paidFromReserve=approach.energyDemand+
    shelter.energyDemand;
  const cap=replayRearEnergyCapV1({
    rider:source.rider,kilometres,
    throughKm:km}).cap;
  const beforeCap=riderState.reserve-
    paidFromReserve;
  const energyAfter=+Math.min(cap,
    beforeCap).toFixed(3);
  const capAdjustment=Math.max(0,beforeCap-cap);
  const decision={version:PHYSICAL_FIRST_BUNCH_CATCH_VERSION,
    sourceKm:km,riderId:soloId,
    teamId:source.team.id,roadId:'peloton',
    fromRoadId:oldSolo.roadId,
    leaderRiderId:bunchLeader,role:'sheltered',
    teamOrderEffort:order.effort,
    sportingGoal:stake.sportingGoal,
    sportingCaptainId:stake.sportingCaptainId,
    perceivedAbilityAtChoice:
      event.perceivedShelterHoldAbility,
    choice:'join_paid_bunch_shelter',
    energyBefore:riderState.reserve,
    approachCost:approach.energyDemand,
    remainderCost:shelter.energyDemand,
    paidFromReserve,recoveryAward:0,
    capAdjustment,energyAfter,quietKm:0};
  const road={...paidBunch,
    riderIds:[...paidBunch.riderIds,soloId],
    riderDecisions:[...paidBunch.riderDecisions,
      decision]};
  const finish={riderId:soloId,sourceKm:km,
    physicalGroup:'peloton',
    endDistanceM:km*1000,
    clockSeconds:paidBunch.finishClockSeconds,
    energyBefore:riderState.reserve,
    paidFromReserve,recoveryAward:0,
    capAdjustment,energyAfter,quietKm:0};
  return {version:PHYSICAL_FIRST_BUNCH_CATCH_VERSION,
    event,road,finish,joined:true};
}
