// Quote a measured front-drop/solo meeting before changing any road.
// The quote grants no wheel, group, finish or official placing.
import {isDeepStrictEqual} from 'node:util';
import {replayV94PhysicalSixthKmV1} from
  './v94-physical-sixth-km-v1.mjs';
import {priceRearEnergyDemandV1,
  quoteRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {orderAt} from './orders.mjs';
import {MOTOR_DRAFT_SHELTER,TUNING} from './tuning.mjs';

export const V94_PHYSICAL_FRONT_DROP_CONTACT_CHOICE_VERSION=
  'v94-physical-front-drop-contact-choice-1';
export const V94_PHYSICAL_FRONT_DROP_CONTACT_RIDER_VERSION=
  'v94-physical-front-drop-contact-rider-1';
const EPS=1e-8;

export function decideV94PhysicalFrontDropContactChoiceV1(
  recording,prior){
  if(prior?.sourceKm!==5||!prior.fullFieldKilometre)
    throw new Error('Front-drop contact choice needs paid km 5.');
  let evidence,physicalRoads;
  try{
    replayV94PhysicalSixthKmV1(recording,prior);
  }catch(error){
    if(error.message!==
      'Physical front drop/rear contact needs paid resolution.')
      throw error;
    evidence=error.sourceEvidence;
    physicalRoads=error.physicalRoads;
  }
  const km=6;
  const segment=recording.route.kilometres[km-1];
  const drop=physicalRoads?.newFrontDrops?.find(row=>
    row.riderId===evidence?.riderId);
  const road=physicalRoads?.roads?.find(row=>
    row.roadId===evidence?.roadId);
  const slice=physicalRoads?.front?.road?.flatMap(turn=>
    turn.riderSlices.filter(row=>
      row.riderId===drop?.riderId&&
      evidence.atDistanceM>=row.startDistanceM-EPS&&
      evidence.atDistanceM<=row.endDistanceM+EPS))
    .find(row=>row.role==='solo');
  const roadWork=road?.riderDecisions?.[0];
  const contactM=evidence?.atDistanceM-5000;
  if(segment?.km!==km||!drop||!slice||
    road?.kind!=='solo'||road.riderDecisions.length!==1||
    roadWork.role!=='solo'||
    roadWork.riderId===drop.riderId||
    !Number.isFinite(contactM)||contactM<=0||contactM>=1000||
    evidence.clockSeconds<=road.startClockSeconds||
    evidence.clockSeconds>=road.finishClockSeconds||
    !drop.segments.some(row=>
      evidence.clockSeconds>=row.startClockSeconds-EPS&&
      evidence.clockSeconds<=row.endClockSeconds+EPS))
    throw new Error('Front-drop choice lacks measured paid roads.');
  const sources=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[
      rider.id,{rider,team}])));
  const stakes=new Map(recording.committedInputs.rivalIntent?.map(
    row=>[row.teamId,row])??[]);
  const priorFinishes=new Map(prior.finishes.map(row=>[
    row.riderId,row]));
  const remainingM=6000-evidence.atDistanceM;
  const dropSource=sources.get(drop.riderId);
  const soloSource=sources.get(roadWork.riderId);
  const dropPrior=priorFinishes.get(drop.riderId);
  const soloPrior=priorFinishes.get(roadWork.riderId);
  if(!dropSource||!soloSource||!dropPrior||!soloPrior||
    dropPrior.physicalGroup!=='peloton'||
    soloPrior.physicalGroup!==road.previousGroupIds[0]||
    roadWork.energyBefore!==soloPrior.energyAfter||
    !stakes.get(dropSource.team.id)?.sportingGoal||
    !stakes.get(soloSource.team.id)?.sportingGoal)
    throw new Error('Front-drop choice lacks committed riders.');
  const dropPrice=priceRearEnergyDemandV1({
    rider:dropSource.rider,segment,
    energyBefore:slice.energyBefore,effort:slice.effort,
    role:'solo',distanceM:evidence.atDistanceM-
      slice.startDistanceM});
  const soloPrice=priceRearEnergyDemandV1({
    rider:soloSource.rider,segment,
    energyBefore:roadWork.energyBefore,
    effort:roadWork.effort,role:'solo',distanceM:contactM});
  const atContact=[{
    source:dropSource,prior:dropPrior,
    priorRoadId:`solo-${drop.riderId}`,
    roleBeforeContact:'front_drop_solo',
    effectiveEffort:slice.effort,
    energyAtContact:dropPrice.energyAfter,
    paidEnergyToContact:dropPrior.energyAfter-
      dropPrice.energyAfter,
    frontDropDecision:drop.completionDecision
  },{
    source:soloSource,prior:soloPrior,
    priorRoadId:road.roadId,
    roleBeforeContact:'solo',
    effectiveEffort:roadWork.effort,
    energyAtContact:soloPrice.energyAfter,
    paidEnergyToContact:soloPrice.energyDemand,
    frontDropDecision:null
  }];
  const candidates=atContact.map(row=>{
    const {rider,team}=row.source;
    const order=orderAt(team.orders,km-1);
    const stake=stakes.get(team.id);
    const bonus=(TUNING.effortPressure[
      row.effectiveEffort]-1)*20;
    const soloAbility=riderKilometreEffect(rider,segment,{
      phase:'solo',energy:row.energyAtContact,
      exposed:segment.exposed}).ability+bonus;
    const shelterAbility=riderKilometreEffect(rider,segment,{
      phase:'cruise',energy:row.energyAtContact,
      exposed:segment.exposed}).ability+bonus+
      MOTOR_DRAFT_SHELTER[segment.terrain];
    const lead=quoteRearEnergyDemandV1({rider,segment,
      energyBefore:row.energyAtContact,
      effort:row.effectiveEffort,role:'leader',
      distanceM:remainingM});
    const shelter=quoteRearEnergyDemandV1({rider,segment,
      energyBefore:row.energyAtContact,
      effort:row.effectiveEffort,role:'sheltered',
      distanceM:remainingM});
    const shelterAbilityAtEnd=riderKilometreEffect(
      rider,segment,{phase:'cruise',
        energy:Math.max(0,row.energyAtContact-
          shelter.energyDemand),exposed:segment.exposed})
      .ability+bonus+MOTOR_DRAFT_SHELTER[segment.terrain];
    return {version:V94_PHYSICAL_FRONT_DROP_CONTACT_RIDER_VERSION,
      sourceKm:km,riderId:rider.id,teamId:team.id,
      previousPhysicalGroup:row.prior.physicalGroup,
      paidRoleBeforeContact:row.roleBeforeContact,
      managerEffort:order.effort,
      effectiveEffort:row.effectiveEffort,
      managerChase:order.chase,
      managerFrontWork:order.frontWork??null,
      managerBreakWork:order.breakWork??null,
      sportingGoal:stake.sportingGoal,
      sportingCaptainId:stake.sportingCaptainId,
      energyBeforeKm:row.prior.energyAfter,
      paidEnergyToContact:row.paidEnergyToContact,
      energyAtContact:row.energyAtContact,
      perceivedSoloAbility:soloAbility,
      perceivedShelterHoldAbility:shelterAbility,
      perceivedShelterHoldAbilityAtEnd:shelterAbilityAtEnd,
      quotedLeaderEnergyDemand:lead.energyDemand,
      quotedShelterEnergyDemand:shelter.energyDemand,
      willingToLead:row.roleBeforeContact==='solo'&&
        order.breakWork!=='sit_on'&&
        lead.energyDemand<=row.energyAtContact+EPS};
  });
  const leader=candidates.find(row=>row.willingToLead);
  const follower=candidates.find(row=>row.riderId!==
    leader?.riderId);
  const shelterPossible=!!leader&&!!follower&&
    follower.perceivedShelterHoldAbility+EPS>=
      leader.perceivedSoloAbility&&
    follower.perceivedShelterHoldAbilityAtEnd+EPS>=
      leader.perceivedSoloAbility&&
    follower.quotedShelterEnergyDemand<=
      follower.energyAtContact+EPS;
  return {version:V94_PHYSICAL_FRONT_DROP_CONTACT_CHOICE_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    contactClockSeconds:evidence.clockSeconds,
    atDistanceM:evidence.atDistanceM,
    remainingDistanceM:remainingM,
    observedRoadIds:[evidence.roadId,
      `solo-${drop.riderId}`],
    candidates:candidates.map(row=>({...row,
      choice:shelterPossible?
        row.riderId===leader.riderId?
          'volunteer_paid_turn_after_contact':
          'eligible_for_paid_shelter_after_contact':
        'continue_individual_paid_road'})),
    pendingLeaderRiderId:shelterPossible?
      leader.riderId:null,
    pendingShelterRiderIds:shelterPossible?
      [follower.riderId]:[],
    paidWorkPending:shelterPossible,
    physicalGroupFormed:false,
    fullFieldKilometre:false,officialResults:false};
}

export function validateV94PhysicalFrontDropContactChoiceV1(
  recording,prior,choice){
  if(!isDeepStrictEqual(choice,
    decideV94PhysicalFrontDropContactChoiceV1(
      recording,prior)))
    throw new Error(
      'Front-drop contact choice differs from paid source.');
  return true;
}
