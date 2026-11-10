// Quote a front pass without moving or charging sheltered wheels. A
// simultaneous shelter loss must be settled by a separate paid step.
import {isDeepStrictEqual} from 'node:util';
import {planPhysicalFirstPelotonLeaderV1} from
  './physical-first-leader-plan-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {MOTOR_RACE_DYNAMICS,TUNING} from './tuning.mjs';

export const PHYSICAL_FIRST_POSITION_FRONT_PASS_QUOTE_VERSION=
  'physical-first-position-front-pass-quote-1';
const EPS=1e-6;

const speedFor=(source,segment,energy,phase)=>{
  const order=orderAt(source.team.orders,segment.km-1);
  const ability=riderKilometreEffect(source.rider,segment,{
    phase,energy,exposed:segment.exposed}).ability+
    (TUNING.effortPressure[order.effort]-1)*20;
  const seconds=segmentBaseSeconds(segment)+
    (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Front pass quote lacks payable speed.');
  return 1000/seconds;
};

export function quotePhysicalFirstPositionFrontPassV1({
  prior,segment,input}){
  const km=prior?.sourceKm+1;
  const positions=prior?.positions?.filter(row=>
    row.roadId==='peloton');
  const front=positions?.[0];
  if(!Number.isInteger(km)||km<1||
    segment?.km!==km||
    !isDeepStrictEqual(segment,
      input?.kilometres?.[km-1])||
    !front||positions.length<2||
    Math.abs(front.distanceM-(km-1)*1000)>EPS||
    !Number.isFinite(front.energy)||
    !Number.isFinite(prior.clockSeconds)||
    !Number.isFinite(prior.grid?.wheelSpacingM))
    throw new Error('Front pass quote needs a committed front.');
  const sources=new Map(input.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  if(positions.some(row=>sources.get(row.riderId)
    ?.team.id!==row.teamId))
    throw new Error('Front pass quote changed the peloton roster.');
  const leaderPlan=planPhysicalFirstPelotonLeaderV1({
    prior:{sourceKm:km-1,
      roads:[{roadId:'peloton',
        riderIds:positions.map(row=>row.riderId),
        clockSeconds:prior.clockSeconds}],
      riders:positions.map(row=>({
        riderId:row.riderId,teamId:row.teamId,
        roadId:'peloton',distanceM:(km-1)*1000,
        clockSeconds:prior.clockSeconds,
        reserve:row.energy,quietKm:row.quietKm}))},
    segment,teams:input.teams,stakes:input.stakes,
    emergencyFrontWorkers:
      input.emergencyFrontWorkers??[]});
  const candidate=positions.find(row=>
    row.riderId===leaderPlan.leaderRiderId);
  if(!candidate||candidate.riderId===front.riderId)
    return null;
  const source=sources.get(candidate.riderId);
  const oldSpeedMps=speedFor(sources.get(front.riderId),
    segment,front.energy,'solo');
  const surgeSpeedMps=speedFor(source,segment,
    candidate.energy,'attack');
  const relativeSpeedMps=surgeSpeedMps-oldSpeedMps;
  const requiredGainM=front.distanceM-
    candidate.distanceM+prior.grid.wheelSpacingM;
  const clearLane=candidate.lane!==front.lane&&
    !positions.some(row=>row.riderId!==
      candidate.riderId&&
      row.lane===candidate.lane&&
      row.distanceM>candidate.distanceM+EPS);
  if(!clearLane||relativeSpeedMps<=EPS)
    return null;
  const firstSeconds=requiredGainM/
    relativeSpeedMps;
  const firstDistanceM=oldSpeedMps*firstSeconds;
  const surgeDistanceM=surgeSpeedMps*firstSeconds;
  const secondDistanceM=1000-firstDistanceM-
    prior.grid.wheelSpacingM;
  if(firstDistanceM<=EPS||secondDistanceM<=EPS||
    surgeDistanceM>1000||candidate.energy<=EPS)
    return null;
  let surgePayment;
  try{
    surgePayment=priceRearEnergyDemandV1({
      rider:source.rider,segment,
      energyBefore:candidate.energy,
      effort:orderAt(source.team.orders,km-1).effort,
      role:'solo',distanceM:surgeDistanceM});
  }catch(error){
    if(error.message===
      'Rear rider cannot pay terrain-priced work.')
      return null;
    throw error;
  }
  const newSpeedMps=speedFor(source,segment,
    surgePayment.energyAfter,'solo');
  const secondSeconds=secondDistanceM/newSpeedMps;
  return {version:
    PHYSICAL_FIRST_POSITION_FRONT_PASS_QUOTE_VERSION,
  sourceKm:km,leaderPlan,
  fromRiderId:front.riderId,
  toRiderId:candidate.riderId,
  passingLane:candidate.lane,
  requiredGainM,relativeSpeedMps,
  firstSeconds,secondSeconds,
  firstDistanceM,secondDistanceM,
  surgeDistanceM,oldSpeedMps,
  surgeSpeedMps,newSpeedMps,
  surgePaidFromReserve:surgePayment.energyDemand};
}
