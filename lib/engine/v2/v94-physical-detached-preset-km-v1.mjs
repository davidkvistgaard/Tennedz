// A source preset attack cannot launch from the peloton when its rider
// already occupies a paid rear road. Continue that road and record the
// rejected source claim; explicit manager attacks still require a replay.
import {isDeepStrictEqual} from 'node:util';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';
import {decideV94PhysicalBoundaryFromPriorV1} from
  './v94-physical-third-boundary-choice-v1.mjs';
import {decideV94PhysicalForwardBoundaryChoicesV1} from
  './v94-physical-forward-boundary-choice-v1.mjs';
import {replayV94PhysicalFrontKmFromPriorV1} from
  './v94-physical-second-front-km-v1.mjs';
import {replayV94PhysicalRearKmFromPriorV1} from
  './v94-physical-third-rear-km-v1.mjs';
import {planV94PhysicalAvailableFrontTurnsV1} from
  './v94-physical-available-front-turns-v1.mjs';

export const V94_PHYSICAL_DETACHED_PRESET_KM_VERSION=
  'v94-physical-detached-preset-km-1';
export const V94_PHYSICAL_DETACHED_PRESET_DECISION_VERSION=
  'v94-physical-detached-preset-decision-1';
const FRONT_VERSION='v94-physical-detached-preset-front-1';
const FRONT_DECISION_VERSION=
  'v94-physical-detached-preset-front-decision-1';
const REAR_DECISION_VERSION=
  'v94-physical-detached-preset-rear-decision-1';
const BOUNDARY_VERSION=
  'v94-physical-detached-preset-boundary-1';
const AVAILABLE_VERSION=
  'v94-physical-detached-preset-available-km-1';
const AVAILABLE_DECISION_VERSION=
  'v94-physical-detached-preset-available-decision-1';

export function replayV94PhysicalDetachedPresetKmV1(
  recording,prior,{useAvailableFront=false}={}){
  const km=prior?.sourceKm+1;
  const frame=recording.frames[km-1];
  const segment=recording.route.kilometres[km-1];
  const old=prior?.sourceBreakRiderIds;
  const fresh=frame?.attackers;
  if(!Number.isInteger(km)||km<8||segment?.km!==km||
    !prior.fullFieldKilometre||
    prior.sourceCheckpointCalibrationFailed!==true||
    !Array.isArray(old)||!old.length||
    new Set(old).size!==old.length||
    !Array.isArray(fresh)||!fresh.length||
    new Set(fresh).size!==fresh.length||
    fresh.some(id=>old.includes(id)||
      !prior.formerSourceBreakRiderIds?.includes(id))||
    !Array.isArray(frame.freshAttackRiderDecisions)||
    frame.freshAttackRiderDecisions.length!==fresh.length||
    frame.joinedBreakawayRiderIds.length!==fresh.length||
    fresh.some(id=>!frame.joinedBreakawayRiderIds.includes(id))||
    frame.breakawayRiderIds.length!==old.length+fresh.length||
    frame.breakawayRiderIds.some(id=>
      !old.includes(id)&&!fresh.includes(id))||
    new Set(frame.roadGroups.flatMap(group=>
      group.riderIds)).size!==frame.breakawayRiderIds.length||
    frame.roadGroups.some(group=>group.riderIds.some(id=>
      !frame.breakawayRiderIds.includes(id))))
    throw new Error(
      'Detached preset needs exact paid rear and source membership.');
  const teams=new Map(recording.committedInputs.teams.map(team=>
    [team.id,team]));
  const byRider=new Map([...teams.values()].flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const stakes=new Map(recording.committedInputs.rivalIntent.map(row=>
    [row.teamId,row]));
  const priorById=new Map(prior.finishes.map(row=>
    [row.riderId,row]));
  const sourceById=new Map(frame.freshAttackRiderDecisions.map(row=>
    [row.riderId,row]));
  if(sourceById.size!==fresh.length)
    throw new Error('Detached preset needs unique source decisions.');
  const ledger=new Map(frame.energyLedger.map(row=>
    [row.riderId,row]));
  const decisions=fresh.map(riderId=>{
    const physical=priorById.get(riderId);
    const source=sourceById.get(riderId);
    const entry=byRider.get(riderId);
    const stake=stakes.get(entry?.team.id);
    const order=entry&&orderAt(entry.team.orders,km-1);
    const sourceEnergy=ledger.get(riderId);
    if(!physical||physical.physicalGroup==='peloton'||
      physical.endDistanceM!==(km-1)*1000||
      !Number.isFinite(physical.energyAfter)||
      !Number.isFinite(physical.clockSeconds)||
      source?.sourceKm!==km||
      source.choice!=='launch_paid_attack'||
      source.attackReason!=='preset_cadence'||
      source.teamId!==entry?.team.id||
      source.teamOrderEffort!==order?.effort||
      source.teamOrderAttack!==order?.attack||
      order?.attackRiderId||
      source.goal!==stake?.sportingGoal||
      source.sportingCaptainId!==stake?.sportingCaptainId||
      !Number.isFinite(sourceEnergy?.energyBefore))
      throw new Error(
        'Detached preset cannot override a physical or manager attack.');
    const bonus=(TUNING.effortPressure[order.effort]-1)*20;
    const solo=riderKilometreEffect(entry.rider,segment,{
      phase:'solo',energy:physical.energyAfter,
      exposed:segment.exposed});
    const attack=riderKilometreEffect(entry.rider,segment,{
      phase:'attack',energy:physical.energyAfter,
      exposed:segment.exposed});
    return {version:V94_PHYSICAL_DETACHED_PRESET_DECISION_VERSION,
      sourceKm:km,riderId,teamId:entry.team.id,
      atDistanceM:(km-1)*1000,
      priorPhysicalGroup:physical.physicalGroup,
      priorClockSeconds:physical.clockSeconds,
      energyAtBoundary:physical.energyAfter,
      managerEffort:order.effort,
      managerAttack:order.attack,
      managerBreakWork:order.breakWork,
      sportingGoal:stake.sportingGoal,
      sportingCaptainId:stake.sportingCaptainId,
      perceivedSoloAbility:solo.ability+bonus,
      perceivedAttackAbility:attack.ability+bonus,
      sourceAttackReason:source.attackReason,
      sourceEnergyBefore:sourceEnergy.energyBefore,
      choice:'continue_paid_rear_road_refuse_preset_front_launch',
      paidNewDistanceM:0,paidNewEnergy:0};
  });
  const ordinary=decideV94PhysicalBoundaryFromPriorV1(
    recording,{km,prior,version:BOUNDARY_VERSION});
  const boundary=ordinary.choices.some(choice=>
    choice.riderIds.some(id=>old.includes(id)))?
    decideV94PhysicalForwardBoundaryChoicesV1(recording,
      prior,{allowPaidMixedContact:
        prior.mixedPaidContactFromPrior===true||
        !!prior.contactFragmentVersion}):ordinary;
  const front=replayV94PhysicalFrontKmFromPriorV1(recording,{
    km,prior,frontClockSeconds:prior.front.frontClockSeconds,
    version:useAvailableFront?AVAILABLE_VERSION:FRONT_VERSION,
    decisionVersion:useAvailableFront?
      AVAILABLE_DECISION_VERSION:FRONT_DECISION_VERSION,
    priorField:null,
    unattachedSourceRoadRiderIds:[...old,...fresh],
    sourceRearAttackRiderIds:[...fresh],
    allowNamedChaseTurns:true,
    ...(useAvailableFront?{availableFrontPlan:
      planV94PhysicalAvailableFrontTurnsV1(recording,prior)}:{})});
  const paid=replayV94PhysicalRearKmFromPriorV1(recording,{
    km,priorTrace:prior,boundary,front,
    version:useAvailableFront?AVAILABLE_VERSION:
      V94_PHYSICAL_DETACHED_PRESET_KM_VERSION,
    decisionVersion:useAvailableFront?
      AVAILABLE_DECISION_VERSION:REAR_DECISION_VERSION});
  return {...paid,priorSourceKm:prior.sourceKm,
    priorVersion:prior.version,
    sourceBreakRiderIds:[...old,...fresh],
    formerSourceBreakRiderIds:
      prior.formerSourceBreakRiderIds.filter(id=>
        !fresh.includes(id)),
    detachedPresetDecisions:decisions,
    sourcePresetFrontLaunchDeclinedRiderIds:[...fresh],
    sourceBreakRoadNotPhysical:true,
    sourceCheckpointCalibrationFailed:true,
    ...(boundary.choices.some(row=>row.mixedPaidContact)?{
      mixedPaidContactFromPrior:true}:{}),
    officialResults:false};
}

export function validateV94PhysicalDetachedPresetKmV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalDetachedPresetKmV1(recording,prior)))
    throw new Error('Detached preset differs from paid source.');
  return true;
}
