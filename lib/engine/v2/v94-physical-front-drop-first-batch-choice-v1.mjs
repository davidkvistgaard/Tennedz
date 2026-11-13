// Decide the first measured simultaneous front-drop contact batch.
// The decision alone grants no shelter or physical group.
import {auditV94PhysicalFrontDropContactsV1} from
  './v94-physical-front-drop-contact-audit-v1.mjs';
import {priceRearEnergyDemandV1,
  quoteRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {orderAt} from './orders.mjs';
import {MOTOR_DRAFT_SHELTER,TUNING} from './tuning.mjs';

export const V94_PHYSICAL_FRONT_DROP_FIRST_BATCH_CHOICE_VERSION=
  'v94-physical-front-drop-first-batch-choice-1';
const EPS=1e-7;

export function decideV94PhysicalFrontDropFirstBatchV1(
  recording,prior,physicalRoads){
  const km=prior?.sourceKm+1;
  if(!Number.isInteger(km)||!prior.fullFieldKilometre)
    throw new Error('Front-drop batch needs a paid prior field.');
  const audit=auditV94PhysicalFrontDropContactsV1(
    physicalRoads,{sourceKm:km});
  const first=audit.firstContact;
  if(first?.kind!=='front_drop_rear_road')
    throw new Error('Front-drop batch needs rear road contact.');
  const batch=audit.contacts.filter(row=>
    Math.abs(row.clockSeconds-first.clockSeconds)<=EPS&&
    Math.abs(row.atDistanceM-first.atDistanceM)<=EPS&&
    row.secondRoadId===first.secondRoadId);
  const road=physicalRoads.roads.find(row=>
    row.roadId===first.secondRoadId);
  const work=road?.riderDecisions?.[0];
  const segment=recording.route.kilometres[km-1];
  const fromDistanceM=(km-1)*1000;
  if(segment?.km!==km||road?.kind!=='solo'||
    road.riderDecisions.length!==1||work?.role!=='solo'||
    batch.length<1||first.atDistanceM<=fromDistanceM+EPS||
    first.atDistanceM>=km*1000-EPS)
    throw new Error('Front-drop batch lacks paid solo contact.');
  const sources=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[
      rider.id,{rider,team}])));
  const stakes=new Map(recording.committedInputs.rivalIntent
    ?.map(row=>[row.teamId,row])??[]);
  const previous=new Map(prior.finishes.map(row=>[
    row.riderId,row]));
  const solo=sources.get(work.riderId);
  const soloPrior=previous.get(work.riderId);
  if(!solo||!soloPrior||
    soloPrior.physicalGroup!==road.previousGroupIds[0]||
    work.energyBefore!==soloPrior.energyAfter||
    !stakes.get(solo.team.id)?.sportingGoal)
    throw new Error('Front-drop batch lacks committed solo.');
  const soloPrice=priceRearEnergyDemandV1({
    rider:solo.rider,segment,
    energyBefore:work.energyBefore,
    effort:work.effort,role:'solo',
    distanceM:first.atDistanceM-fromDistanceM});
  const soloOrder=orderAt(solo.team.orders,km-1);
  if(soloOrder.effort!==work.effort)
    throw new Error('Front-drop batch changed solo effort.');
  const remainingDistanceM=km*1000-first.atDistanceM;
  const bonus=effort=>(TUNING.effortPressure[effort]-1)*20;
  const ability=(source,energy,effort,phase)=>
    riderKilometreEffect(source.rider,segment,{
      phase,energy,exposed:segment.exposed}).ability+
      bonus(effort)+(phase==='cruise'?
        MOTOR_DRAFT_SHELTER[segment.terrain]:0);
  const leaderAbility=ability(solo,soloPrice.energyAfter,
    work.effort,'solo');
  const leaderDemand=quoteRearEnergyDemandV1({
    rider:solo.rider,segment,
    energyBefore:soloPrice.energyAfter,
    effort:work.effort,role:'leader',
    distanceM:remainingDistanceM});
  const willingToLead=soloOrder.breakWork!=='sit_on'&&
    leaderDemand.energyDemand<=soloPrice.energyAfter+EPS;
  const drops=batch.map(contact=>{
    const source=sources.get(contact.firstRiderId);
    const priorFinish=previous.get(contact.firstRiderId);
    const slice=physicalRoads.front.road.flatMap(turn=>
      turn.riderSlices.filter(row=>
        row.riderId===contact.firstRiderId&&
        row.role==='solo'&&
        contact.atDistanceM>=row.startDistanceM-EPS&&
        contact.atDistanceM<=row.endDistanceM+EPS))[0];
    if(!source||!priorFinish||!slice||
      priorFinish.physicalGroup!=='peloton'||
      !stakes.get(source.team.id)?.sportingGoal)
      throw new Error('Front-drop batch lacks paid drop.');
    const dropOrder=orderAt(source.team.orders,km-1);
    if(dropOrder.effort!==slice.effort&&!(
      physicalRoads.front.recordedRestMode===true&&
      slice.decision?.recordedSourceRest===true&&
      slice.decision?.teamOrderEffort===dropOrder.effort&&
      slice.effort==='conserve'))
      throw new Error('Front-drop batch changed committed effort.');
    const prefix=priceRearEnergyDemandV1({
      rider:source.rider,segment,
      energyBefore:slice.energyBefore,
      effort:slice.effort,role:'solo',
      distanceM:contact.atDistanceM-slice.startDistanceM});
    const shelter=quoteRearEnergyDemandV1({
      rider:source.rider,segment,
      energyBefore:prefix.energyAfter,
      effort:slice.effort,role:'sheltered',
      distanceM:remainingDistanceM});
    const holdNow=ability(source,prefix.energyAfter,
      slice.effort,'cruise');
    const holdEnd=ability(source,Math.max(0,
      prefix.energyAfter-shelter.energyDemand),
    slice.effort,'cruise');
    const canShelter=willingToLead&&
      shelter.energyDemand<=prefix.energyAfter+EPS&&
      holdNow+EPS>=leaderAbility&&
      holdEnd+EPS>=leaderAbility;
    return {riderId:contact.firstRiderId,
      teamId:source.team.id,
      effectiveEffort:slice.effort,
      managerEffort:dropOrder.effort,
      sportingGoal:stakes.get(source.team.id).sportingGoal,
      sportingCaptainId:stakes.get(source.team.id)
        .sportingCaptainId,
      energyBeforeKm:priorFinish.energyAfter,
      energyAtContact:prefix.energyAfter,
      paidEnergyToContact:priorFinish.energyAfter-
        prefix.energyAfter,
      perceivedShelterHoldAbility:holdNow,
      perceivedShelterHoldAbilityAtEnd:holdEnd,
      quotedShelterEnergyDemand:shelter.energyDemand,
      choice:canShelter?'eligible_for_paid_shelter':
        'continue_separate_paid_road'};
  });
  return {
    version:V94_PHYSICAL_FRONT_DROP_FIRST_BATCH_CHOICE_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    auditVersion:audit.version,
    contactClockSeconds:first.clockSeconds,
    atDistanceM:first.atDistanceM,
    remainingDistanceM,
    passingRoadId:road.roadId,
    passingRiderId:work.riderId,
    passingEffectiveEffort:work.effort,
    passingManagerEffort:soloOrder.effort,
    passingManagerBreakWork:soloOrder.breakWork,
    passingSportingGoal:stakes.get(solo.team.id).sportingGoal,
    passingSportingCaptainId:stakes.get(solo.team.id)
      .sportingCaptainId,
    passingEnergyBeforeKm:soloPrior.energyAfter,
    passingEnergyAtContact:soloPrice.energyAfter,
    passingPaidEnergyToContact:soloPrice.energyDemand,
    passingPerceivedSoloAbility:leaderAbility,
    passingQuotedLeaderEnergyDemand:leaderDemand.energyDemand,
    passingWillingToLead:willingToLead,
    drops,
    pendingShelterRiderIds:drops.filter(row=>
      row.choice==='eligible_for_paid_shelter').map(row=>
      row.riderId),
    physicalGroupFormed:false,officialResults:false};
}
