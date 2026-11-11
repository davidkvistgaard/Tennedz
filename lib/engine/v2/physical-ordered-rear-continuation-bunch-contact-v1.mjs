// Measure a detached solo's first meeting with the paid bunch before
// changing membership or assigning shelter for the remaining road.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalOrderedRearBoundaryFromStateV1} from
  './physical-ordered-rear-next-boundary-v1.mjs';
import {physicalRearIntentAtKmV2} from
  './physical-rear-intent-v2.mjs';
import {riderKilometreEffect} from
  './physiology.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {segmentBaseSeconds} from
  './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS,
  MOTOR_DRAFT_SHELTER} from
  './tuning.mjs';

export const PHYSICAL_ORDERED_REAR_CONTINUATION_BUNCH_CONTACT_VERSION=
  'v2-physical-ordered-rear-continuation-bunch-contact-1';
const EPS=1e-6;

export function measurePhysicalOrderedRearSoloBunchContactV1({
  startInput,next,event,solo}){
  if(!event?.involvesBunch||
    event.roadIds.length!==2||
    !event.roadIds.includes('peloton')||
    event.metresIntoKm<=0||
    event.metresIntoKm>=1000)
    throw new Error(
      'Rear bunch probe needs first measured contact.');
  const roadId=event.roadIds.find(id=>
    id!=='peloton');
  if(!solo||solo.id!==roadId||
    solo.kind!=='solo'||
    solo.riderIds.length!==1||
    event.riders.length!==1)
    throw new Error(
      'Rear bunch probe needs one paid solo road.');
  const riderId=solo.riderIds[0];
  const team=startInput.teams.find(item=>
    item.riders.some(rider=>
      rider.id===riderId));
  const rider=team.riders.find(item=>
    item.id===riderId);
  const km=next.sourceKm;
  const segment=startInput.routeKilometres[km-1];
  const intent=physicalRearIntentAtKmV2({
    startInput,riderId,km});
  const metres=event.metresIntoKm;
  const approachMetres=metres-
    (solo.domainStartM??0);
  if(approachMetres<=0)
    throw new Error(
      'Rear bunch probe needs paid solo approach.');
  const energyAtContact=event.riders[0]
    .energyAtContact;
  const soloPaid=priceRearEnergyDemandV1({
    rider,segment,
    energyBefore:solo.rows[0].energyBefore,
    effort:intent.effort,role:'solo',
    distanceM:approachMetres});
  if(Math.abs(soloPaid.energyAfter-
    energyAtContact)>.002||
    Math.abs(next.bunchStartClock+
      next.step.elapsedSeconds*metres/1000-
      event.clockSeconds)>EPS)
    throw new Error(
      'Rear bunch probe breaks paid contact.');
  const effect=riderKilometreEffect(rider,
    segment,{phase:'cruise',
      energy:energyAtContact,
      exposed:segment.exposed});
  const holdAbility=effect.ability+
    (TUNING.effortPressure[
      intent.effort]-1)*20+
    MOTOR_DRAFT_SHELTER[segment.terrain];
  const leaderAbility=50+
    (segmentBaseSeconds(segment)-
      next.step.elapsedSeconds)/
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  const remainingM=1000-metres;
  const sheltered=priceRearEnergyDemandV1({
    rider,segment,energyBefore:energyAtContact,
    effort:intent.effort,
    role:'sheltered',distanceM:remainingM});
  const exposed=priceRearEnergyDemandV1({
    rider,segment,energyBefore:energyAtContact,
    effort:intent.effort,
    role:'solo',distanceM:remainingM});
  const reserveOkay=intent.action!==
    'save_for_stage'||
    sheltered.energyAfter>=intent
      .committedStagePlan.reserveEnergy;
  const bunchRiders=next.step.physicalGroup
    .riderIds.map(id=>{
      const row=next.step.riders.find(item=>
        item.riderId===id);
      return {riderId:id,role:row.role,
        energyBefore:row.energyBefore,
        energyAtContact:row.energyBefore-
          row.energySpent*metres/1000};
    });
  if(bunchRiders.filter(row=>
    row.role==='leader').length!==1||
    bunchRiders.some(row=>
      !Number.isFinite(row.energyAtContact)||
      row.energyAtContact<0))
    throw new Error(
      'Rear bunch probe lacks paid bunch leader.');
  return {...event,riderId,
    soloDecision:solo.rows[0].decision,
    intent,
    soloEnergyBefore:solo.rows[0]
      .energyBefore,
    soloEnergySpentToContact:
      soloPaid.energyDemand,
    energyAtContact,
    holdAbility,leaderAbility,
    payable:energyAtContact+EPS>=
      sheltered.energyDemand,
    canHold:holdAbility+EPS>=
      leaderAbility,
    reserveOkay,
    shelterCheaper:
      sheltered.energyDemand<
        exposed.energyDemand,
    shelteredEnergyDemand:
      sheltered.energyDemand,
    exposedAlternativeEnergyDemand:
      exposed.energyDemand,
    bunchLeaderRiderId:
      next.step.leaderRiderId,
    bunchRiders,
    nextChoiceUnsettled:true,
    physicalGroupsStillSeparate:true};
}

export function probePhysicalOrderedRearContinuationBunchContactV1({
  startInput,prior}){
  const {recording:boundary,tracks,next}=
    sourcePhysicalOrderedRearBoundaryFromStateV1({
      startInput,prior});
  const event=boundary.firstEvent;
  const solo=tracks.find(track=>
    track.id===event?.roadIds.find(id=>
      id!=='peloton'));
  const contact=measurePhysicalOrderedRearSoloBunchContactV1({
    startInput,next,event,solo});
  return {version:
    PHYSICAL_ORDERED_REAR_CONTINUATION_BUNCH_CONTACT_VERSION,
  sourceKm:next.sourceKm,sources:{boundary},
  contact,
  movesGuidedRace:false,
  officialResults:false};
}

export function validatePhysicalOrderedRearContinuationBunchContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    probePhysicalOrderedRearContinuationBunchContactV1(
      input)))
    throw new Error(
      'Rear continuation bunch probe differs from paid source.');
  return true;
}
