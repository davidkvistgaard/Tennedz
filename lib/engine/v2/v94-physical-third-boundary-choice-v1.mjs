// Decisions at the paid km-2 boundary. Equal arrival clocks prove
// co-location, not a wheel or permission to share the next metre.
import {isDeepStrictEqual} from 'node:util';
import {replayV94PhysicalSecondRearKmV1} from
  './v94-physical-second-rear-km-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {MOTOR_DRAFT_SHELTER,TUNING} from './tuning.mjs';

export const V94_PHYSICAL_THIRD_BOUNDARY_CHOICE_VERSION=
  'v94-physical-third-boundary-choice-1';
const EPS=1e-8;
const ACTIVE_STAKES=new Set(['sprint_finish',
  'summit_attack','break_stage']);
const EFFORT_RANK={conserve:0,steady:1,hard:2};

export function decideV94PhysicalThirdBoundaryChoicesV1(recording){
  const second=replayV94PhysicalSecondRearKmV1(recording);
  const segment=recording.route.kilometres[2];
  if(segment?.km!==3||!second.fullFieldKilometre)
    throw new Error('Third boundary needs a complete paid km 2.');
  const byRider=new Map(recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const stakes=new Map(recording.committedInputs.rivalIntent?.map(row=>
    [row.teamId,row])??[]);
  const ordered=[...second.finishes].sort((a,b)=>
    a.clockSeconds-b.clockSeconds||a.riderId.localeCompare(b.riderId));
  if(ordered.some(row=>row.endDistanceM!==2000||
    !Number.isFinite(row.clockSeconds)||
    !Number.isFinite(row.energyAfter)))
    throw new Error('Third boundary lacks paid arrivals.');
  const arrivals=[];
  for(const finish of ordered){
    const last=arrivals.at(-1);
    if(last&&Math.abs(last[0].clockSeconds-finish.clockSeconds)<EPS)
      last.push(finish);
    else arrivals.push([finish]);
  }
  const choices=arrivals.filter(rows=>rows.length>1&&
    rows.some(row=>row.physicalGroup!=='peloton')).map(rows=>{
    if(rows.some(row=>row.physicalGroup==='peloton'))
      throw new Error('Third boundary rear/front contact needs paid resolution.');
    const clockSeconds=rows[0].clockSeconds;
    const previousGroupIds=[...new Set(rows.map(row=>
      row.physicalGroup))].sort();
    const candidates=rows.map(finish=>{
      const {rider,team}=byRider.get(finish.riderId);
      const order=orderAt(team.orders,2);
      const stake=stakes.get(team.id);
      if(!stake?.sportingGoal||!stake.sportingCaptainId)
        throw new Error('Third boundary needs committed stakes.');
      const bonus=(TUNING.effortPressure[order.effort]-1)*20;
      const solo=riderKilometreEffect(rider,segment,{phase:'solo',
        energy:finish.energyAfter,exposed:segment.exposed});
      const cruise=riderKilometreEffect(rider,segment,{
        phase:'cruise',energy:finish.energyAfter,
        exposed:segment.exposed});
      const willing=order.frontWork!=='sit_in'&&(
        order.chase==='all'||order.chase==='selective'&&
        ACTIVE_STAKES.has(stake.sportingGoal));
      return {riderId:finish.riderId,teamId:team.id,
        previousPhysicalGroup:finish.physicalGroup,
        managerEffort:order.effort,managerChase:order.chase,
        managerFrontWork:order.frontWork??null,
        sportingGoal:stake.sportingGoal,
        sportingCaptainId:stake.sportingCaptainId,
        energyAtBoundary:finish.energyAfter,
        perceivedSoloAbility:solo.ability+bonus,
        perceivedShelterHoldAbility:cruise.ability+bonus+
          MOTOR_DRAFT_SHELTER[segment.terrain],
        willingToLead:willing};
    });
    const volunteers=candidates.filter(row=>
      row.willingToLead).sort((a,b)=>
      EFFORT_RANK[b.managerEffort]-
        EFFORT_RANK[a.managerEffort]||
      a.riderId.localeCompare(b.riderId));
    const leader=volunteers[0]??null;
    const canHold=leader?candidates.filter(row=>
      row.riderId===leader.riderId||
      row.perceivedShelterHoldAbility+EPS>=
        leader.perceivedSoloAbility):[];
    const pendingLeader=canHold.length>1?leader:null;
    return {version:V94_PHYSICAL_THIRD_BOUNDARY_CHOICE_VERSION,
      sourceKm:3,atDistanceM:2000,clockSeconds,
      previousGroupIds,riderIds:rows.map(row=>row.riderId),
      paidArrivalEvidence:rows.map(row=>({riderId:row.riderId,
        sourceKm:row.sourceKm,physicalGroup:row.physicalGroup,
        clockSeconds:row.clockSeconds,
        paidFromReserve:row.paidFromReserve,
        energyAfter:row.energyAfter})),
      pendingLeaderRiderId:pendingLeader?.riderId??null,
      pendingShelterRiderIds:pendingLeader?canHold.filter(row=>
        row.riderId!==pendingLeader.riderId).map(row=>
        row.riderId):[],
      riderDecisions:candidates.map(row=>({
        version:V94_PHYSICAL_THIRD_BOUNDARY_CHOICE_VERSION,
        ...row,choice:!pendingLeader?'continue_paid_solo':
          row.riderId===pendingLeader.riderId?
            'volunteer_next_paid_turn':
            canHold.includes(row)?
              'accept_shelter_after_paid_turn':
              'cannot_hold_proposed_turn'})),
      paidWorkPending:!!pendingLeader,formsRearGroup:false};
  });
  const unpairedSoloRiderIds=arrivals.filter(rows=>
    rows.length===1&&rows[0].physicalGroup!=='peloton').map(
    rows=>rows[0].riderId);
  const rearCount=second.finishes.filter(row=>
    row.physicalGroup!=='peloton').length;
  if(choices.reduce((sum,row)=>sum+row.riderIds.length,0)+
    unpairedSoloRiderIds.length!==rearCount)
    throw new Error('Third boundary lacks paid rear coverage.');
  return {version:V94_PHYSICAL_THIRD_BOUNDARY_CHOICE_VERSION,
    sourceKm:3,second,choices,
    unpairedSoloRiderIds,
    pendingGroupCount:choices.filter(row=>
      row.pendingLeaderRiderId!==null).length,
    physicalRearGroups:[],officialResults:false};
}

export function validateV94PhysicalThirdBoundaryChoicesV1(
  recording,choices){
  if(!isDeepStrictEqual(choices,
    decideV94PhysicalThirdBoundaryChoicesV1(recording)))
    throw new Error('Third boundary choices differ from paid source.');
  return true;
}
