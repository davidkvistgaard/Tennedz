import {isDeepStrictEqual} from 'node:util';
import {recordFinaleLastKmFieldHandoffFromTour} from
  './finale-last-km-field-handoff.mjs';
import {pendingFinaleAttacksAt} from './finale-attack-guard.mjs';
import {orderAt} from './orders.mjs';
import {attackCandidate,reservedAttackRiderIds} from './tactics.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_LAST_KM_NAMED_INTENTS_VERSION=
  'v2-finale-last-km-named-intents-1';
export const FINALE_LAST_KM_ALL_INTENTS_VERSION=
  'v2-finale-last-km-all-intents-2';

// Record every team's named last-kilometre intent from the validated source.
// Eligible means the rider may enter a future contest, not that a road gap or
// attack energy has been earned. Other pending actions remain explicit.
export function recordFinaleLastKmNamedIntentsFromTour(tour,{version=
  FINALE_LAST_KM_NAMED_INTENTS_VERSION}={}){
  if(![FINALE_LAST_KM_NAMED_INTENTS_VERSION,
    FINALE_LAST_KM_ALL_INTENTS_VERSION].includes(version))
    throw new Error('Unknown last-kilometre intent version.');
  const field=recordFinaleLastKmFieldHandoffFromTour(tour);
  const km=tour.route.distanceKm;
  const pending=pendingFinaleAttacksAt(tour,field,km,{
    includeBlocked:true,includeUnavailable:true});
  const byId=new Map(field.riders.map(row=>[row.riderId,row]));
  const recentCaught=new Set(tour.frames.slice(Math.max(0,
    field.sourceKm-TUNING.breakaway.reattackRecoveryKm),
  field.sourceKm).flatMap(frame=>frame.caughtBreakawayRiderIds));
  const named=[];
  for(const team of tour.committedInputs.teams){
    const order=orderAt(team.orders,km-1);
    if(!order.attackRiderId)continue;
    const rider=byId.get(order.attackRiderId);
    if(!rider||rider.teamId!==team.id)
      throw new Error('A named finale order lacks its source rider.');
    const due=pending.filter(row=>row.teamId===team.id&&
      row.riderId===rider.riderId&&
      ['peloton_attack','named_unavailable','team_break_limit']
        .includes(row.kind));
    if(due.length>1)
      throw new Error('A named finale order has conflicting decisions.');
    const event=due[0]??null;
    const status=event?.kind==='team_break_limit'?'team_break_limit':
      event?.kind==='named_unavailable'?
        rider.status==='dropped'?'dropped':
        rider.status==='breakaway'?'already_ahead':'unavailable':
        event?.kind==='peloton_attack'?
          recentCaught.has(rider.riderId)?'recently_caught':
            rider.energy<TUNING.attack.minEnergyFraction*100?
              'exhausted':'eligible':'not_due';
    if(status==='unavailable')
      throw new Error('A named finale rider has an unknown unavailable state.');
    named.push({teamId:team.id,riderId:rider.riderId,
      sourceStatus:rider.status,
      sourceEnergy:rider.energy,
      sourceAttackLoad:rider.attackLoad,
      loadAtDecision:+Math.max(0,rider.attackLoad-
        TUNING.attack.loadRecoveryPerKm).toFixed(3),
      orderAttack:order.attack,
      decision:status,
      canEnterRoadContest:status==='eligible',
      sourcePendingKind:event?.kind??null});
  }
  const namedTeams=new Set(named.map(row=>row.teamId));
  const unnamed=[];
  if(version===FINALE_LAST_KM_ALL_INTENTS_VERSION){
    const activeLeaders=new Map(tour.frames[field.sourceKm-1]
      .activeLeaders.map(row=>[row.teamId,row.riderId]));
    const segment=tour.route.kilometres[km-1];
    for(const team of tour.committedInputs.teams){
      const order=orderAt(team.orders,km-1);
      if(order.attack==='none'||order.attackRiderId!=null)continue;
      const due=pending.filter(row=>row.teamId===team.id&&
        ['peloton_attack','team_break_limit'].includes(row.kind));
      if(due.length>1)
        throw new Error('An unnamed finale order has conflicting decisions.');
      const event=due[0]??null;
      const leaderId=activeLeaders.get(team.id);
      if(!team.riders.some(rider=>rider.id===leaderId))
        throw new Error('An unnamed finale order lacks its source leader.');
      const leaderDropped=byId.get(leaderId)?.status==='dropped';
      const reserved=[...reservedAttackRiderIds(team,order,leaderDropped),
        ...(team.orders.gcObjective==='defend_top_ten'?[leaderId]:[])];
      const excluded=new Set([...field.riders.filter(row=>
        row.status!=='peloton'||recentCaught.has(row.riderId))
        .map(row=>row.riderId),...reserved]);
      const prepared={...team,activeLeaderId:leaderId,
        energy:Object.fromEntries(team.riders.map(rider=>
          [rider.id,byId.get(rider.id)?.energy])),
        attackLoad:Object.fromEntries(team.riders.map(rider=>
          [rider.id,+Math.max(0,byId.get(rider.id)?.attackLoad-
            TUNING.attack.loadRecoveryPerKm).toFixed(3)]))};
      const chosen=event?.kind==='peloton_attack'?
        attackCandidate(prepared,segment,excluded):null;
      const selected=chosen?byId.get(chosen.rider.id):null;
      unnamed.push({teamId:team.id,orderAttack:order.attack,
        sourcePendingKind:event?.kind??null,
        decision:event?.kind==='team_break_limit'?'team_break_limit':
          event?.kind==='peloton_attack'?
            chosen?'eligible':'no_available_rider':'not_due',
        riderId:chosen?.rider.id??null,
        sourceEnergy:selected?.energy??null,
        sourceAttackLoad:selected?.attackLoad??null,
        loadAtDecision:chosen?.repeatLoad??null,
        selectionPressure:chosen?.pressure??null,
        canEnterRoadContest:Boolean(chosen)});
    }
  }
  const unnamedTeams=new Set(unnamed.map(row=>row.teamId));
  const otherPendingActions=pending.filter(row=>
    !((namedTeams.has(row.teamId)||unnamedTeams.has(row.teamId))&&
    ['peloton_attack','named_unavailable','team_break_limit']
      .includes(row.kind)));
  const unresolvedSelectiveChaseTeamIds=tour.committedInputs.teams
    .filter(team=>orderAt(team.orders,km-1).chase==='selective')
    .map(team=>team.id);
  return {version,
    sourceFieldVersion:field.version,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    distanceM:field.startDistanceM,
    named,...(version===FINALE_LAST_KM_ALL_INTENTS_VERSION?{
      unnamed,eligibleUnnamedRiderIds:unnamed.filter(row=>
        row.canEnterRoadContest).map(row=>row.riderId)}:{}),
    otherPendingActions,unresolvedSelectiveChaseTeamIds,
    eligibleNamedRiderIds:named.filter(row=>row.canEnterRoadContest)
      .map(row=>row.riderId),
    roadOutcomeStatus:'unresolved',
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleLastKmNamedIntentsFromTour(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleLastKmNamedIntentsFromTour(tour,{
      version:recorded?.version})))
    throw new Error('The named last-kilometre intents do not replay.');
  return true;
}
