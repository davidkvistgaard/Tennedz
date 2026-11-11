// First measured bunch crossing of an opt-in, manager-ordered rear
// solo. This is a contact source, not an automatic bunch return.
import {isDeepStrictEqual} from 'node:util';
import {startPhysicalBunchV1,
  runPhysicalStaggeredBunchLossV1} from
  './physical-start-bunch-v1.mjs';
import {completePhysicalStaggeredLossKmV1} from
  './physical-pace-loss-completion-v1.mjs';
import {physicalRearIntentAtKmV2} from
  './physical-rear-intent-v2.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_ORDERED_SOLO_BUNCH_CONTACT_VERSION=
  'v2-physical-ordered-solo-bunch-contact-1';

function paidSoloKm({startInput,riderId,km,
  energyBefore,distanceM}){
  const segment=startInput.routeKilometres[km-1];
  const rider=startInput.teams.flatMap(team=>
    team.riders).find(row=>row.id===riderId);
  const intent=physicalRearIntentAtKmV2({
    startInput,riderId,km});
  const effect=riderKilometreEffect(rider,segment,{
    phase:'solo',energy:energyBefore,
    exposed:segment.exposed});
  const ability=effect.ability+
    (TUNING.effortPressure[intent.effort]-1)*20;
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-ability)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||
    secondsPerKm<=0||distanceM<=0||
    distanceM>1000)
    throw new Error('Ordered solo needs payable road.');
  const paid=priceRearEnergyDemandV1({rider,
    segment,energyBefore,
    effort:intent.effort,role:'solo',
    distanceM});
  const recovery=recoveryForKilometre({
    rider,segment,effort:intent.effort,
    group:'solo',working:true,quietKm:0});
  if(recovery.recovery!==0)
    throw new Error('Ordered solo cannot claim recovery.');
  const cap=replayRearEnergyCapV1({rider,
    kilometres:startInput.routeKilometres,
    throughKm:km}).cap;
  const energyAfter=+Math.min(cap,
    paid.energyAfter).toFixed(3);
  if(intent.action==='save_for_stage'&&
    Math.min(cap,paid.energyAfter)<
      intent.committedStagePlan
      .reserveEnergy)
    throw new Error('Ordered solo breaks stage reserve.');
  return {intent,secondsPerKm,
    energyBefore,energySpent:paid.energyDemand,
    energyAfter,cap,recoveryAward:0};
}

export function probePhysicalOrderedSoloBunchContactV1({
  startInput,start,staggered,riderId,throughKm}){
  if(startInput?.physicalRearIntentVersion!==2||
    !isDeepStrictEqual(start,
      startPhysicalBunchV1(startInput))||
    !Number.isInteger(throughKm)||
    throughKm<2||
    throughKm>staggered?.throughKm||
    !isDeepStrictEqual(staggered,
      runPhysicalStaggeredBunchLossV1({
        startInput,start,
        throughKm:staggered?.throughKm})))
    throw new Error('Ordered bunch contact needs replayed source.');
  const loss=staggered.losses.find(row=>
    row.riderId===riderId);
  if(!loss||loss.sourceKm>=throughKm)
    throw new Error('Ordered bunch contact needs later solo road.');
  const completion=completePhysicalStaggeredLossKmV1({
    startInput,start,staggered,riderId});
  let soloClock=completion.elapsedSeconds;
  let soloEnergy=completion.energyAfter;
  let bunchClock=staggered.road.slice(0,
    loss.sourceKm).reduce((sum,row)=>
    sum+row.elapsedSeconds,0);
  let gap=completion.gapSecondsToBunch;
  if(gap<=0)
    throw new Error('Ordered solo needs paid rear gap.');
  const earlier=[];
  for(let km=loss.sourceKm+1;km<=throughKm;km++){
    const bunch=staggered.road[km-1];
    const projection=paidSoloKm({startInput,
      riderId,km,energyBefore:soloEnergy,
      distanceM:1000});
    const nextGap=soloClock+
      projection.secondsPerKm-
      bunchClock-bunch.elapsedSeconds;
    if(nextGap>0){
      const elapsedSeconds=soloClock+
        projection.secondsPerKm;
      earlier.push({sourceKm:km,riderId,
        startClock:soloClock,elapsedSeconds,
        bunchEndClock:bunchClock+
          bunch.elapsedSeconds,
        gapSecondsToBunch:nextGap,
        ...projection});
      soloClock=elapsedSeconds;
      soloEnergy=projection.energyAfter;
      bunchClock+=bunch.elapsedSeconds;
      gap=nextGap;
      continue;
    }
    const closingSecondsPerKm=
      bunch.elapsedSeconds-
        projection.secondsPerKm;
    const metresIntoKm=gap/
      closingSecondsPerKm*1000;
    if(closingSecondsPerKm<=0||
      metresIntoKm<=0||
      metresIntoKm>1000||
      bunch.splits.length)
      throw new Error(
        'Ordered contact needs uninterrupted paid bunch road.');
    const paid=paidSoloKm({startInput,
      riderId,km,energyBefore:soloEnergy,
      distanceM:metresIntoKm});
    const clockSeconds=soloClock+
      paid.secondsPerKm*metresIntoKm/1000;
    if(Math.abs(clockSeconds-(bunchClock+
      bunch.elapsedSeconds*metresIntoKm/1000))>1e-7)
      throw new Error('Ordered contact clocks differ.');
    const bunchRiders=bunch.physicalGroup
      .riderIds.map(id=>{
        const row=bunch.riders.find(item=>
          item.riderId===id);
        return {riderId:id,role:row.role,
          energyBefore:row.energyBefore,
          energySpentToContact:row.energySpent*
            metresIntoKm/1000,
          energyAtContact:row.energyBefore-
            row.energySpent*metresIntoKm/1000};
      });
    if(bunchRiders.filter(row=>
      row.role==='leader').length!==1||
      bunchRiders.some(row=>
        !Number.isFinite(row.energyAtContact)||
        row.energyAtContact<0))
      throw new Error('Ordered contact lacks paid bunch energy.');
    const otherDetachedRiderIds=staggered.losses
      .filter(row=>row.riderId!==riderId&&
        row.sourceKm<=km).map(row=>row.riderId);
    return {version:
      PHYSICAL_ORDERED_SOLO_BUNCH_CONTACT_VERSION,
    riderId,throughKm,lossKm:loss.sourceKm,
    sources:{completion,earlier,
      bunchStep:bunch},
    contact:{sourceKm:km,riderId,
      atDistanceM:(km-1)*1000+
        metresIntoKm,
      metresIntoKm,clockSeconds,
      previousGapSeconds:gap,
      soloSecondsPerKm:paid.secondsPerKm,
      bunchSecondsPerKm:bunch.elapsedSeconds,
      soloEnergyBefore:soloEnergy,
      soloEnergySpentToContact:
        paid.energySpent,
      soloEnergyAtContact:paid.energyAfter,
      soloDecision:paid.intent,
      bunchLeaderRiderId:bunch.leaderRiderId,
      bunchRiders,
      otherDetachedRiderIds,
      otherRearRoadsUnsettled:
        otherDetachedRiderIds.length>0,
      candidateOnly:
        otherDetachedRiderIds.length>0,
      physicalGroupsStillSeparate:true,
      nextChoiceUnsettled:true},
    movesGuidedRace:false,
    officialResults:false};
  }
  return {version:
    PHYSICAL_ORDERED_SOLO_BUNCH_CONTACT_VERSION,
  riderId,throughKm,lossKm:loss.sourceKm,
  sources:{completion,earlier},
  contact:null,movesGuidedRace:false,
  officialResults:false};
}

export function validatePhysicalOrderedSoloBunchContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    probePhysicalOrderedSoloBunchContactV1(input)))
    throw new Error(
      'Ordered bunch contact differs from paid source.');
  return true;
}
