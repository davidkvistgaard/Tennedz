// Opt-in positional road physics. A selected worker becomes front only
// after a faster, charged approach carries their wheel past the old front.
// This is a successor motor step, not a reconstruction of old group clocks.
import {isDeepStrictEqual} from 'node:util';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_DRAFT_SHELTER,MOTOR_RACE_DYNAMICS,
  TUNING} from './tuning.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {planPhysicalFirstPelotonLeaderV1} from
  './physical-first-leader-plan-v1.mjs';
import {createPhysicalFirstPositionStartV1,
  PHYSICAL_FIRST_POSITION_START_VERSION} from
  './physical-first-position-start-v1.mjs';

export const PHYSICAL_FIRST_POSITION_ROTATION_KM_VERSION=
  'physical-first-position-rotation-km-1';
const EPS=1e-6;

const speedFor=(source,segment,energy,phase)=>{
  const order=orderAt(source.team.orders,segment.km-1);
  const effect=riderKilometreEffect(source.rider,segment,
    {phase,energy,exposed:segment.exposed});
  const ability=effect.ability+
    (TUNING.effortPressure[order.effort]-1)*20;
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
    throw new Error('Rotation road lacks payable speed.');
  return {ability,speedMps:1000/secondsPerKm};
};
const quoteLeg=(source,segment,energyBefore,role,distanceM)=>
  distanceM>EPS?priceRearEnergyDemandV1({
    rider:source.rider,segment,energyBefore,
    effort:orderAt(source.team.orders,segment.km-1).effort,
    role,distanceM}):null;
const shelterAbility=(source,segment,energy)=>{
  const order=orderAt(source.team.orders,segment.km-1);
  return riderKilometreEffect(source.rider,segment,
    {phase:'cruise',energy,
      exposed:segment.exposed}).ability+
    (TUNING.effortPressure[order.effort]-1)*20+
    MOTOR_DRAFT_SHELTER[segment.terrain];
};

export function advancePhysicalFirstPositionRotationKmV1({
  prior,segment,input}){
  const {kilometres,teams,stakes,
    emergencyFrontWorkers=[]}=input??{};
  const km=prior?.sourceKm+1;
  const positions=prior?.positions;
  const lineDistanceM=km*1000;
  const priorLineDistanceM=(km-1)*1000;
  const front=positions?.[0];
  if(![PHYSICAL_FIRST_POSITION_START_VERSION,
    PHYSICAL_FIRST_POSITION_ROTATION_KM_VERSION]
    .includes(prior?.version)||
    !Number.isInteger(km)||km<1||segment?.km!==km||
    !isDeepStrictEqual(kilometres?.[km-1],segment)||
    !Array.isArray(positions)||!positions.length||
    !Number.isFinite(prior.clockSeconds)||
    front?.distanceM!==priorLineDistanceM||
    !Number.isFinite(prior.grid?.wheelSpacingM)||
    !Array.isArray(teams)||!Array.isArray(stakes)||
    positions.some(row=>row.roadId!=='peloton'||
      !Number.isFinite(row.distanceM)||
      !Number.isFinite(row.energy)||row.energy<0||
      row.distanceM>front.distanceM+EPS)||
    new Set(positions.map(row=>row.riderId)).size!==
      positions.length)
    throw new Error('Rotation kilometre needs a connected position road.');
  const sources=new Map(teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const separateRoadRiderIds=prior.separateRoadRiderIds??[];
  if(!Array.isArray(separateRoadRiderIds)||
    new Set(separateRoadRiderIds).size!==
      separateRoadRiderIds.length||
    sources.size!==positions.length+
      separateRoadRiderIds.length||
    separateRoadRiderIds.some(id=>!sources.has(id)||
      positions.some(row=>row.riderId===id))||
    positions.some(row=>sources.get(row.riderId)?.team.id!==
      row.teamId))
    throw new Error('Rotation kilometre lacks committed rider roads.');
  if(createPhysicalFirstPositionStartV1({input,
    grid:prior.grid}).inputHash!==prior.inputHash)
    throw new Error('Rotation kilometre changed committed race input.');
  // The old leader planner needs a connected-road summary for its order
  // decision. This projection cannot move riders or set wheel positions.
  const planningPrior={sourceKm:km-1,
    roads:[{roadId:'peloton',
      riderIds:positions.map(row=>row.riderId),
      clockSeconds:prior.clockSeconds}],
    riders:positions.map(row=>({riderId:row.riderId,
      teamId:row.teamId,roadId:'peloton',
      distanceM:priorLineDistanceM,
      clockSeconds:prior.clockSeconds,
      reserve:row.energy,quietKm:row.quietKm}))};
  const leaderPlan=planPhysicalFirstPelotonLeaderV1({
    prior:planningPrior,segment,teams,stakes,
    emergencyFrontWorkers});
  const proposed=positions.find(row=>
    row.riderId===leaderPlan.leaderRiderId);
  const oldSource=sources.get(front.riderId);
  const oldPace=speedFor(oldSource,segment,
    front.energy,'solo');
  let pass=null,leader=front;
  if(proposed.riderId!==front.riderId){
    const proposedSource=sources.get(proposed.riderId);
    const surge=speedFor(proposedSource,segment,
      proposed.energy,'attack');
    const clearPassingLane=proposed.lane!==front.lane&&
      !positions.some(row=>row.riderId!==proposed.riderId&&
        row.lane===proposed.lane&&
        row.distanceM>proposed.distanceM+EPS);
    const relativeSpeedMps=surge.speedMps-
      oldPace.speedMps;
    const requiredGainM=front.distanceM-
      proposed.distanceM+prior.grid.wheelSpacingM;
    if(clearPassingLane&&relativeSpeedMps>EPS){
      const elapsedSeconds=requiredGainM/relativeSpeedMps;
      const oldLeadDistanceM=oldPace.speedMps*elapsedSeconds;
      const surgeDistanceM=surge.speedMps*elapsedSeconds;
      const secondDistanceM=1000-oldLeadDistanceM-
        prior.grid.wheelSpacingM;
      if(oldLeadDistanceM>EPS&&secondDistanceM>EPS&&
        surgeDistanceM<=1000&&
        proposed.energy>EPS){
        let surgePayment=null;
        try{surgePayment=quoteLeg(proposedSource,segment,
          proposed.energy,'solo',surgeDistanceM);}
        catch(error){
          if(error.message!==
            'Rear rider cannot pay terrain-priced work.')
            throw error;
        }
        if(surgePayment){
          const newPace=speedFor(proposedSource,segment,
            surgePayment.energyAfter,'solo');
          pass={riderId:proposed.riderId,
          fromFrontRiderId:front.riderId,
          requiredGainM,relativeSpeedMps,
          elapsedSeconds,oldLeadDistanceM,
          surgeDistanceM,secondDistanceM,
          surgeSpeedMps:surge.speedMps,
          oldLeadSpeedMps:oldPace.speedMps,
          newLeadSpeedMps:newPace.speedMps,
          newLeadAbility:newPace.ability,
          surgePayment};
          leader=proposed;
        }
      }
    }
  }
  const firstDistanceM=pass?.oldLeadDistanceM??1000;
  const secondDistanceM=pass?.secondDistanceM??0;
  const firstSeconds=pass?.elapsedSeconds??
    1000/oldPace.speedMps;
  const secondSeconds=pass?
    secondDistanceM/pass.newLeadSpeedMps:0;
  const endClockSeconds=prior.clockSeconds+
    firstSeconds+secondSeconds;
  const next=positions.map(row=>{
    const source=sources.get(row.riderId);
    const firstRole=row.riderId===front.riderId?
      'leader':row.riderId===leader.riderId&&pass?
        'solo':'sheltered';
    const firstTravelM=row.riderId===leader.riderId&&pass?
      pass.surgeDistanceM:firstDistanceM;
    const first=pass&&row.riderId===leader.riderId?
      pass.surgePayment:quoteLeg(source,segment,
        row.energy,firstRole,firstTravelM);
    const secondRole=row.riderId===leader.riderId?
      'leader':'sheltered';
    const second=pass?quoteLeg(source,segment,
      first.energyAfter,secondRole,secondDistanceM):null;
    const energyAfterWork=second?.energyAfter??first.energyAfter;
    if(firstRole==='sheltered'&&
      (shelterAbility(source,segment,row.energy)+.002<
        oldPace.ability||
      shelterAbility(source,segment,first.energyAfter)+.002<
        oldPace.ability))
      throw new Error('Rotation kilometre loses first shelter.');
    if(pass&&secondRole==='sheltered'&&
      (shelterAbility(source,segment,first.energyAfter)+.002<
        pass.newLeadAbility||
      shelterAbility(source,segment,energyAfterWork)+.002<
        pass.newLeadAbility))
      throw new Error('Rotation kilometre loses second shelter.');
    const order=orderAt(source.team.orders,km-1);
    const recovery=recoveryForKilometre({
      rider:source.rider,segment,effort:order.effort,
      group:'peloton',working:firstRole!=='sheltered'||
        secondRole==='leader',quietKm:row.quietKm});
    const cap=replayRearEnergyCapV1({rider:source.rider,
      kilometres,throughKm:km}).cap;
    const endDistanceM=row.distanceM+firstTravelM+
      secondDistanceM;
    const decision={riderId:row.riderId,
      firstRole,firstTravelM,
      secondRole:pass?secondRole:null,
      secondTravelM:secondDistanceM,
      energyBefore:row.energy,
      paidFromReserve:(first?.energyDemand??0)+
        (second?.energyDemand??0),
      recoveryAward:recovery.recovery,
      capAdjustment:Math.max(0,
        energyAfterWork+recovery.recovery-cap),
      energyAfter:+Math.min(cap,
        energyAfterWork+recovery.recovery).toFixed(3),
      quietKm:recovery.quietKm};
    return {position:{...row,
      distanceM:endDistanceM,
      paidDistanceM:row.paidDistanceM+firstTravelM+
        secondDistanceM,
      energy:decision.energyAfter,
      quietKm:decision.quietKm},decision};
  });
  const sorted=next.map(row=>row.position)
    .sort((a,b)=>b.distanceM-a.distanceM||
      a.riderId.localeCompare(b.riderId));
  if(sorted[0].riderId!==leader.riderId||
    Math.abs(sorted[0].distanceM-lineDistanceM)>EPS||
    sorted.some(row=>row.distanceM>lineDistanceM+EPS))
    throw new Error('Rotation kilometre lost its physical front.');
  const checkpointCrossings=next.flatMap(({position,
    decision})=>{
    const initial=positions.find(row=>
      row.riderId===position.riderId);
    const firstEnd=initial.distanceM+
      decision.firstTravelM;
    const firstSpeed=pass&&
      position.riderId===leader.riderId?
      pass.surgeSpeedMps:oldPace.speedMps;
    const crossings=[];
    for(let markerKm=1;markerKm<=km;markerKm++){
      const markerDistanceM=markerKm*1000;
      if(initial.distanceM+EPS>=markerDistanceM||
        position.distanceM+EPS<markerDistanceM)continue;
      const clockSeconds=markerDistanceM<=firstEnd+EPS?
        prior.clockSeconds+
          (markerDistanceM-initial.distanceM)/firstSpeed:
        prior.clockSeconds+firstSeconds+
          (markerDistanceM-firstEnd)/
            pass.newLeadSpeedMps;
      if(clockSeconds>endClockSeconds+EPS)
        throw new Error('Rotation crossing exceeds paid time.');
      crossings.push({riderId:position.riderId,
        km:markerKm,lineDistanceM:markerDistanceM,
        clockSeconds});
    }
    return crossings;
  }).sort((a,b)=>a.clockSeconds-b.clockSeconds||
    a.riderId.localeCompare(b.riderId));
  const event=pass?{
    version:PHYSICAL_FIRST_POSITION_ROTATION_KM_VERSION,
    type:'paid_front_pass',sourceKm:km,
    fromRiderId:front.riderId,
    toRiderId:leader.riderId,
      passingLane:leader.lane,
    atClockSeconds:prior.clockSeconds+firstSeconds,
    atDistanceM:front.distanceM+firstDistanceM,
    requiredGainM:pass.requiredGainM,
    surgeDistanceM:pass.surgeDistanceM,
    surgePaidFromReserve:pass.surgePayment.energyDemand}:
    proposed.riderId!==front.riderId?{
      version:PHYSICAL_FIRST_POSITION_ROTATION_KM_VERSION,
      type:'front_pass_refused',sourceKm:km,
      fromRiderId:front.riderId,
      toRiderId:proposed.riderId,
      reason:'no_payable_pass_before_next_kilometre'}:null;
  return {version:PHYSICAL_FIRST_POSITION_ROTATION_KM_VERSION,
    sourceStartVersion:PHYSICAL_FIRST_POSITION_START_VERSION,
    inputHash:prior.inputHash,raceSeed:prior.raceSeed,
    grid:{...prior.grid},sourceKm:km,
    clockSeconds:endClockSeconds,
    frontDistanceM:lineDistanceM,
    leaderRiderId:leader.riderId,
    proposedLeaderRiderId:proposed.riderId,
    leaderPlan,event,
    firstSeconds,secondSeconds,
    firstSpeedMps:oldPace.speedMps,
    secondSpeedMps:pass?.newLeadSpeedMps??null,
    decisions:next.map(row=>row.decision),
    checkpointCrossings,
    positions:sorted,
    sourceGroupClockUsedForMovement:false,
    officialResults:false};
}

export function replayPhysicalFirstPositionRotationKmV1(input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionRotationKmV1(input)))
    throw new Error('Position rotation differs from paid movement.');
  return recorded;
}
