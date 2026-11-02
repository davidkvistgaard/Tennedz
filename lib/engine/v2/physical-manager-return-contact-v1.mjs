// Source a slid break rider's paid physical return to the bunch.
// The rider pays solo work to the measured metre, then shelter on
// the remainder of the same bunch kilometre.
import {isDeepStrictEqual} from 'node:util';
import {advancePhysicalBunchAfterCaughtSlideKmV1,
  advancePhysicalBunchAfterPerceivedCatchKmV1} from
  './physical-start-bunch-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_MANAGER_RETURN_CONTACT_VERSION=
  'v2-physical-manager-return-contact-1';

export function contactPhysicalManagerReturnV1({
  roadInput,bunchStep,chaseOrder,chasingTeamId,
  priorKilometre,frontRiderId}){
  const {startInput,prior,segment}=roadInput;
  const chasingTeam=startInput.teams.find(team=>
    team.id===chasingTeamId);
  const chasingOrder=chasingTeam?orderAt(
    chasingTeam.orders,segment.km-1):null;
  if(!['ignore','selective','all'].includes(chaseOrder)||
    chasingOrder?.frontWork!=='rotate'||
    chasingOrder.chase!==chaseOrder||
    frontRiderId!==roadInput.caughtRiderId||
    !isDeepStrictEqual(bunchStep,chaseOrder==='ignore'?
      advancePhysicalBunchAfterCaughtSlideKmV1(
        roadInput):
      advancePhysicalBunchAfterPerceivedCatchKmV1({
        ...roadInput,chasingTeamId}))||
    priorKilometre?.sourceKm!==segment.km-1||
    !Array.isArray(priorKilometre.riderStates))
    throw new Error('Return contact needs replayed bunch road.');
  const priorBunch=priorKilometre.riderStates
    .filter(row=>row.physicalGroupId==='peloton');
  const priorFront=priorKilometre.riderStates.find(row=>
    row.riderId===frontRiderId);
  const priorBunchClock=priorBunch[0]?.elapsedSeconds;
  if(priorBunch.length!==prior.riderIds.length||
    priorBunch.some(row=>
      !prior.riderIds.includes(row.riderId)||
      row.elapsedSeconds!==priorBunchClock||
      row.energyAfter!==prior.energyByRider[
        row.riderId])||
    !priorFront||priorFront.physicalGroupId!==
      `solo-${frontRiderId}`||
    !Number.isFinite(priorFront.elapsedSeconds)||
    priorFront.elapsedSeconds<=priorBunchClock)
    throw new Error('Return contact needs prior physical gap.');
  const team=startInput.teams.find(row=>row.riders.some(
    rider=>rider.id===frontRiderId));
  const rider=team?.riders.find(row=>row.id===
    frontRiderId);
  const order=orderAt(team?.orders,segment.km-1);
  if(!rider||!order||
    !Number.isFinite(priorFront.energyAfter))
    throw new Error('Return contact needs paid rider state.');
  const effort='conserve';
  const soloEffect=riderKilometreEffect(rider,segment,{
    phase:'solo',energy:priorFront.energyAfter,
    exposed:segment.exposed});
  const soloAbility=soloEffect.ability+
    (TUNING.effortPressure[effort]-1)*20;
  const soloSeconds=segmentBaseSeconds(segment)+
    (50-soloAbility)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  const bunchSeconds=bunchStep.elapsedSeconds;
  const closingRate=bunchSeconds-soloSeconds;
  const gapAtStart=priorFront.elapsedSeconds-
    priorBunchClock;
  const contactM=gapAtStart/closingRate*1000;
  if(!Number.isFinite(contactM)||
    closingRate<=0||contactM<=0||contactM>=1000)
    throw new Error('Return contact needs crossing paid clocks.');
  const contactClock=priorFront.elapsedSeconds+
    soloSeconds*contactM/1000;
  const bunchContactClock=priorBunchClock+
    bunchSeconds*contactM/1000;
  if(Math.abs(contactClock-bunchContactClock)>1e-7)
    throw new Error('Return contact clocks do not meet.');
  const soloPaid=priceRearEnergyDemandV1({
    rider,segment,energyBefore:priorFront.energyAfter,
    effort,role:'solo',distanceM:contactM});
  const followerEffect=riderKilometreEffect(rider,
    segment,{phase:'cruise',energy:soloPaid.energyAfter,
      exposed:segment.exposed});
  const followerAbility=followerEffect.ability+
    (TUNING.effortPressure[effort]-1)*20+
      TUNING.breakaway.bunchDraftAdvantage;
  const leaderAbility=50+(
    segmentBaseSeconds(segment)-bunchSeconds)/
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(followerAbility+1e-9<leaderAbility)
    throw new Error('Returning rider cannot hold paid bunch.');
  const shelteredPaid=priceRearEnergyDemandV1({
    rider,segment,energyBefore:soloPaid.energyAfter,
    effort,role:'sheltered',
    distanceM:1000-contactM});
  const cap=replayRearEnergyCapV1({
    rider,kilometres:startInput.routeKilometres,
    throughKm:segment.km}).cap;
  const energyAfter=+Math.min(cap,
    shelteredPaid.energyAfter).toFixed(3);
  const bunchEndClock=priorBunchClock+bunchSeconds;
  return {version:PHYSICAL_MANAGER_RETURN_CONTACT_VERSION,
    sourceKm:segment.km,
    contactAtDistanceM:(segment.km-1)*1000+
      contactM,contactClockSeconds:contactClock,
    bunchEndClockSeconds:bunchEndClock,
    riderId:frontRiderId,teamId:team.id,
    priorSoloClockSeconds:priorFront.elapsedSeconds,
    priorBunchClockSeconds:priorBunchClock,
    soloSecondsPerKm:soloSeconds,
    bunchSecondsPerKm:bunchSeconds,
    soloDistanceM:contactM,
    shelteredDistanceM:1000-contactM,
    energyBefore:priorFront.energyAfter,
    soloEnergySpent:soloPaid.energyDemand,
    shelteredEnergySpent:shelteredPaid.energyDemand,
    recoveryAward:0,cap,energyAfter,
    decision:{riderId:frontRiderId,
      goal:'finish_safely',
      teamOrderEffort:order.effort,
      effort,choice:'rejoin_bunch',
      reason:'paid_return_contact'},
    physicalGroup:{id:'peloton',
      riderIds:[...bunchStep.physicalGroup.riderIds,
        frontRiderId],
      atDistanceM:segment.km*1000},
    officialResults:false};
}

export function validatePhysicalManagerReturnContactV1(
input,recording){
  if(!isDeepStrictEqual(recording,
    contactPhysicalManagerReturnV1(input)))
    throw new Error('Return contact differs from paid source.');
  return true;
}
