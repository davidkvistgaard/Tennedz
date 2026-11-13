// Resolve two already-paid solo trajectories at their measured meeting.
// Reprice the approach and the remaining road with one exposed leader.
import {orderAt} from './orders.mjs';
import {isDeepStrictEqual} from 'node:util';
import {advancePhysicalFirstRoadV1} from
  './physical-first-road-step-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {quoteRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {projectPhysicalFirstRoadMeetingV1} from
  './physical-first-road-crossing-guard-v1.mjs';
import {MOTOR_DRAFT_SHELTER,
  MOTOR_RACE_DYNAMICS,TUNING} from './tuning.mjs';

export const PHYSICAL_FIRST_SOLO_CONTACT_VERSION=
  'physical-first-solo-contact-1';
const EPS=.002;

export function resolvePhysicalFirstSoloContactV1({prior,
  firstStep,secondStep,segment,kilometres,teams,stakes}){
  const km=prior?.sourceKm+1;
  if(segment?.km!==km||kilometres?.[km-1]?.km!==km||
    !Array.isArray(prior?.roads)||
    !Array.isArray(prior?.riders)||
    !Array.isArray(teams)||!Array.isArray(stakes))
    throw new Error('Solo contact needs committed paid roads.');
  const steps=[firstStep,secondStep];
  const bySource=new Map(teams.flatMap(team=>
    team.riders.map(rider=>
      [rider.id,{rider,team}])));
  const byStake=new Map(stakes.map(row=>
    [row.teamId,row]));
  const riders=steps.map(step=>{
    const road=step?.road;
    const riderId=road?.riderIds?.[0];
    const old=prior.roads.find(row=>
      row.roadId===road?.roadId);
    const state=prior.riders.find(row=>
      row.riderId===riderId);
    const source=bySource.get(riderId);
    const order=source&&orderAt(source.team.orders,
      km-1);
    const stake=byStake.get(source?.team.id);
    const decision=road?.riderDecisions?.[0];
    const finish=step?.finishes?.[0];
    if(!old||old.riderIds?.length!==1||
      old.riderIds[0]!==riderId||
      !source||!state||!order?.effort||
      !['cooperate','sit_on','drive'].includes(
        order.breakWork)||
      !stake?.sportingGoal||!stake.sportingCaptainId||
      state.roadId!==old.roadId||
      state.distanceM!==(km-1)*1000||
      Math.abs(state.clockSeconds-
        old.clockSeconds)>EPS||
      road.kind!=='solo'||
      road.riderIds.length!==1||
      road.startDistanceM!==(km-1)*1000||
      road.endDistanceM!==km*1000||
      Math.abs(road.startClockSeconds-
        old.clockSeconds)>EPS||
      !Number.isFinite(road.finishClockSeconds)||
      decision?.riderId!==riderId||
      decision.role!=='leader'||
      finish?.riderId!==riderId||
      finish.physicalGroup!==old.roadId||
      finish.endDistanceM!==km*1000||
      Math.abs(finish.clockSeconds-
        road.finishClockSeconds)>EPS||
      !(finish.paidFromReserve>0))
      throw new Error('Solo contact lacks paid approaches.');
    const expected=advancePhysicalFirstRoadV1({
      prior,roadId:old.roadId,
      leaderRiderId:riderId,
      planVersion:step.planVersion,
      segment,kilometres,teams,stakes});
    if(!isDeepStrictEqual(step,expected))
      throw new Error(
        'Solo contact approach differs from paid road.');
    return {riderId,road,old,state,source,order,
      stake};
  });
  if(riders[0].riderId===riders[1].riderId||
    riders[0].old.roadId===riders[1].old.roadId)
    throw new Error('Solo contact needs distinct riders.');
  const meeting=projectPhysicalFirstRoadMeetingV1(
    prior.sourceKm,
    riders[0].old.clockSeconds,
    riders[1].old.clockSeconds,
    riders[0].road.finishClockSeconds,
    riders[1].road.finishClockSeconds);
  const fraction=meeting?.fractionOfKilometre;
  if(!(fraction>EPS&&fraction<1-EPS))
    throw new Error('Solo roads do not meet inside the kilometre.');
  const approachM=fraction*1000;
  const remainingM=1000-approachM;
  const approached=riders.map(row=>{
    const quote=quoteRearEnergyDemandV1({
      rider:row.source.rider,segment,
      energyBefore:row.state.reserve,
      effort:row.order.effort,role:'solo',
      distanceM:approachM});
    const reserveAtContact=row.state.reserve-
      quote.energyDemand;
    if(reserveAtContact<0)
      throw new Error('Solo approach cannot pay contact.');
    return {...row,approachCost:quote.energyDemand,
      reserveAtContact};
  });
  const roadId=`rear:${km}:${approached.map(row=>
    row.riderId).sort().join('+')}`;
  if(prior.roads.some(row=>row.roadId===roadId))
    throw new Error('Solo contact would reuse a road ID.');
  const driving=approached.filter(row=>
    row.order.breakWork==='drive');
  const candidates=driving.length?driving:
    approached.filter(row=>
      row.order.breakWork==='cooperate');
  const options=candidates.map(row=>{
    const driveWork=row.order.breakWork==='drive';
    const effortBonus=(TUNING.effortPressure[
      row.order.effort]-1)*20;
    const ability=riderKilometreEffect(
      row.source.rider,segment,{phase:'solo',
        energy:row.reserveAtContact,
        exposed:segment.exposed}).ability+
      effortBonus+(driveWork?
        TUNING.breakaway.driveAbilityBonusPoints:0);
    const quote=quoteRearEnergyDemandV1({
      rider:row.source.rider,segment,
      energyBefore:row.reserveAtContact,
      effort:row.order.effort,role:'leader',
      distanceM:remainingM,driveWork});
    const follower=approached.find(other=>
      other!==row);
    const shelter=quoteRearEnergyDemandV1({
      rider:follower.source.rider,segment,
      energyBefore:follower.reserveAtContact,
      effort:follower.order.effort,
      role:'sheltered',distanceM:remainingM});
    const followerBonus=(TUNING.effortPressure[
      follower.order.effort]-1)*20+
      MOTOR_DRAFT_SHELTER[segment.terrain];
    const canHold=[follower.reserveAtContact,
      follower.reserveAtContact-
        shelter.energyDemand].every(energy=>
      energy>=0&&riderKilometreEffect(
        follower.source.rider,segment,{
          phase:'cruise',energy,
          exposed:segment.exposed}).ability+
        followerBonus+EPS>=ability);
    return {row,follower,ability,quote,
      shelter,canHold,driveWork};
  }).filter(row=>row.canHold&&
    row.quote.energyDemand<=
      row.row.reserveAtContact+1e-9)
    .sort((a,b)=>b.ability-a.ability||
      a.row.riderId.localeCompare(b.row.riderId));
  if(!options.length)
    throw new Error(driving.length?
      'Ordered drive cannot pay solo contact.':
      'Solo contact lacks a payable shared leader.');
  const selected=options[0];
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-selected.ability)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||
    secondsPerKm<=0)
    throw new Error('Solo contact lacks payable speed.');
  const finishClockSeconds=meeting.atClockSeconds+
    secondsPerKm*remainingM/1000;
  const decisions=approached.map(row=>{
    const leader=row===selected.row;
    const work=leader?selected.quote:
      selected.shelter;
    const paidFromReserve=row.approachCost+
      work.energyDemand;
    const cap=replayRearEnergyCapV1({
      rider:row.source.rider,kilometres,
      throughKm:km}).cap;
    const beforeCap=row.state.reserve-
      paidFromReserve;
    return {version:PHYSICAL_FIRST_SOLO_CONTACT_VERSION,
      sourceKm:km,riderId:row.riderId,
      teamId:row.source.team.id,
      roadId,fromRoadId:row.old.roadId,
      leaderRiderId:selected.row.riderId,
      role:leader?'leader':'sheltered',
      teamOrderBreakWork:row.order.breakWork,
      teamOrderEffort:row.order.effort,
      sportingGoal:row.stake.sportingGoal,
      sportingCaptainId:
        row.stake.sportingCaptainId,
      perceivedAbilityAtChoice:leader?
        selected.ability:
        riderKilometreEffect(
          row.source.rider,segment,{
            phase:'cruise',energy:
              row.reserveAtContact,
            exposed:segment.exposed}).ability+
          (TUNING.effortPressure[
            row.order.effort]-1)*20+
          MOTOR_DRAFT_SHELTER[
            segment.terrain],
      choice:leader?'pay_contact_lead':
        'hold_contact_shelter',
      energyBefore:row.state.reserve,
      approachCost:row.approachCost,
      remainderCost:work.energyDemand,
      paidFromReserve,recoveryAward:0,
      capAdjustment:Math.max(0,
        beforeCap-cap),
      energyAfter:+Math.min(cap,
        beforeCap).toFixed(3),quietKm:0};
  });
  const road={roadId,kind:'rear_group',
    riderIds:approached.map(row=>row.riderId),
    leaderRiderId:selected.row.riderId,
    startDistanceM:meeting.atDistanceM,
    endDistanceM:km*1000,
    startClockSeconds:meeting.atClockSeconds,
    finishClockSeconds,
    speedMps:1000/secondsPerKm,
    riderDecisions:decisions};
  const finishes=decisions.map(row=>({
    riderId:row.riderId,sourceKm:km,
    physicalGroup:roadId,
    endDistanceM:km*1000,
    clockSeconds:finishClockSeconds,
    energyBefore:row.energyBefore,
    paidFromReserve:row.paidFromReserve,
    recoveryAward:0,
    capAdjustment:row.capAdjustment,
    energyAfter:row.energyAfter,
    quietKm:0}));
  return {version:PHYSICAL_FIRST_SOLO_CONTACT_VERSION,
    sourceKm:km,atDistanceM:meeting.atDistanceM,
    atClockSeconds:meeting.atClockSeconds,
    fromRoadIds:approached.map(row=>
      row.old.roadId),
    road,finishes,recordedPaidContact:true,
    officialResults:false};
}
