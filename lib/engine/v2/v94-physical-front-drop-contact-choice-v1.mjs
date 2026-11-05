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
  const drops=physicalRoads?.newFrontDrops?.filter(drop=>
    drop.segments.some(path=>{
      const t=evidence?.clockSeconds;
      if(!Number.isFinite(t)||
        t<path.startClockSeconds-EPS||
        t>path.endClockSeconds+EPS)return false;
      const distance=path.startDistanceM+
        (path.endDistanceM-path.startDistanceM)*
        (t-path.startClockSeconds)/
        (path.endClockSeconds-path.startClockSeconds);
      return Math.abs(distance-evidence.atDistanceM)<1e-6;
    }));
  const road=physicalRoads?.roads?.find(row=>
    row.roadId===evidence?.roadId);
  const roadWork=road?.riderDecisions?.[0];
  const contactM=evidence?.atDistanceM-5000;
  if(segment?.km!==km||!drops?.length||
    !drops.some(row=>row.riderId===evidence.riderId)||
    road?.kind!=='solo'||road.riderDecisions.length!==1||
    roadWork.role!=='solo'||
    drops.some(row=>row.riderId===roadWork.riderId)||
    !Number.isFinite(contactM)||contactM<=0||contactM>=1000||
    evidence.clockSeconds<=road.startClockSeconds||
    evidence.clockSeconds>=road.finishClockSeconds)
    throw new Error('Front-drop choice lacks measured paid roads.');
  const sources=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[
      rider.id,{rider,team}])));
  const stakes=new Map(recording.committedInputs.rivalIntent?.map(
    row=>[row.teamId,row])??[]);
  const priorFinishes=new Map(prior.finishes.map(row=>[
    row.riderId,row]));
  const remainingM=6000-evidence.atDistanceM;
  const soloSource=sources.get(roadWork.riderId);
  const soloPrior=priorFinishes.get(roadWork.riderId);
  if(!soloSource||!soloPrior||
    soloPrior.physicalGroup!==road.previousGroupIds[0]||
    roadWork.energyBefore!==soloPrior.energyAfter||
    !stakes.get(soloSource.team.id)?.sportingGoal)
    throw new Error('Front-drop choice lacks committed riders.');
  const soloPrice=priceRearEnergyDemandV1({
    rider:soloSource.rider,segment,
    energyBefore:roadWork.energyBefore,
    effort:roadWork.effort,role:'solo',distanceM:contactM});
  const dropCandidates=drops.map(drop=>{
    const source=sources.get(drop.riderId);
    const priorFinish=priorFinishes.get(drop.riderId);
    const slice=physicalRoads.front.road.flatMap(turn=>
      turn.riderSlices.filter(row=>
        row.riderId===drop.riderId&&
        evidence.atDistanceM>=row.startDistanceM-EPS&&
        evidence.atDistanceM<=row.endDistanceM+EPS))
      .find(row=>row.role==='solo');
    if(!source||!priorFinish||!slice||
      priorFinish.physicalGroup!=='peloton'||
      !stakes.get(source.team.id)?.sportingGoal)
      throw new Error('Co-located drop lacks paid source.');
    const price=priceRearEnergyDemandV1({
      rider:source.rider,segment,
      energyBefore:slice.energyBefore,effort:slice.effort,
      role:'solo',distanceM:evidence.atDistanceM-
        slice.startDistanceM});
    return {source,prior:priorFinish,
      roleBeforeContact:'front_drop_solo',
      effectiveEffort:slice.effort,
      energyAtContact:price.energyAfter,
      paidEnergyToContact:priorFinish.energyAfter-
        price.energyAfter};
  });
  const atContact=[...dropCandidates,{
    source:soloSource,prior:soloPrior,
    roleBeforeContact:'solo',
    effectiveEffort:roadWork.effort,
    energyAtContact:soloPrice.energyAfter,
    paidEnergyToContact:soloPrice.energyDemand
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
  const sheltered=leader?candidates.filter(row=>
    row.riderId!==leader.riderId&&
    row.perceivedShelterHoldAbility+EPS>=
      leader.perceivedSoloAbility&&
    row.perceivedShelterHoldAbilityAtEnd+EPS>=
      leader.perceivedSoloAbility&&
    row.quotedShelterEnergyDemand<=
      row.energyAtContact+EPS):[];
  const shelterPossible=!!leader&&sheltered.length>0;
  return {version:V94_PHYSICAL_FRONT_DROP_CONTACT_CHOICE_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    contactClockSeconds:evidence.clockSeconds,
    atDistanceM:evidence.atDistanceM,
    remainingDistanceM:remainingM,
    observedRoadIds:[evidence.roadId,
      ...drops.map(row=>`solo-${row.riderId}`)],
    candidates:candidates.map(row=>({...row,
      choice:shelterPossible?
        row.riderId===leader.riderId?
          'volunteer_paid_turn_after_contact':
          sheltered.includes(row)?
            'eligible_for_paid_shelter_after_contact':
            'continue_individual_paid_road':
        'continue_individual_paid_road'})),
    pendingLeaderRiderId:shelterPossible?
      leader.riderId:null,
    pendingShelterRiderIds:shelterPossible?
      sheltered.map(row=>row.riderId):[],
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
