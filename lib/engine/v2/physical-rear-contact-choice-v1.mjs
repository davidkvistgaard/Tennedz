// A rear rider sees paid road speed at contact, not a rival's hidden
// skills. Committed goals and team orders determine whether roads join.
import {rearSoloPlanAtKmV1} from
  './rear-solo-commitment-v1.mjs';
import {physicalRearIntentAtKmV2} from
  './physical-rear-intent-v2.mjs';
import {teamChaseStakeAtKmV1} from
  './team-chase-stake-v1.mjs';
import {orderAt} from './orders.mjs';

export const PHYSICAL_REAR_CONTACT_CHOICE_VERSION=
  'v2-physical-rear-contact-choice-1';
const EPS=1e-7;
const ACTIVE_STAKES=new Set(['sprint_finish',
  'summit_attack','break_stage']);

export function decidePhysicalRearContactV1({startInput,
  km,roadIds,riderIdsByRoad,catchingRoadId,
  observedSecondsPerKmByRoad,leaderRiderId}){
  if(!Number.isInteger(km)||km<1||
    km>startInput?.routeKilometres?.length||
    !Array.isArray(roadIds)||roadIds.length!==2||
    roadIds[0]===roadIds[1]||
    !roadIds.every(id=>Array.isArray(
      riderIdsByRoad?.[id])&&
      riderIdsByRoad[id].length>0&&
      Number.isFinite(
        observedSecondsPerKmByRoad?.[id])&&
      observedSecondsPerKmByRoad[id]>0)||
    catchingRoadId!==null&&
      !roadIds.includes(catchingRoadId))
    throw new Error('Rear choice needs observed paid roads.');
  const riderIds=roadIds.flatMap(id=>
    riderIdsByRoad[id]);
  if(new Set(riderIds).size!==riderIds.length||
    !riderIds.includes(leaderRiderId))
    throw new Error('Rear choice needs distinct contact riders.');
  const riders=riderIds.map(riderId=>{
    const team=startInput.teams.find(row=>
      row.riders.some(rider=>rider.id===riderId));
    if(!team)
      throw new Error('Rear choice lacks committed team.');
    const plan=startInput.soloCommitments?.find(row=>
      row.riderId===riderId);
    const intent=startInput.physicalRearIntentVersion===2?
      physicalRearIntentAtKmV2({startInput,riderId,km}):
      plan?rearSoloPlanAtKmV1({
        commitment:plan,km}):
        {action:'finish_safely',effort:'conserve'};
    const stake=teamChaseStakeAtKmV1({
      commitment:startInput.commitment,
      teamId:team.id,km});
    const order=orderAt(team.orders,km-1);
    const roadId=roadIds.find(id=>
      riderIdsByRoad[id].includes(riderId));
    const otherRoadId=roadIds.find(id=>
      id!==roadId);
    const urgent=intent.action==='rejoin_bunch'||
      stake.captainId===riderId&&
        ACTIVE_STAKES.has(stake.goal);
    return {riderId,teamId:team.id,roadId,
      goal:intent.action,effort:intent.effort,
      ...(startInput.physicalRearIntentVersion===2?{
        intentSource:intent.source}:{}),
      committedTeamStake:stake.goal,
      teamOrderEffort:order.effort,
      observedOwnSecondsPerKm:
        observedSecondsPerKmByRoad[roadId],
      observedRivalSecondsPerKm:
        observedSecondsPerKmByRoad[otherRoadId],
      urgent};
  });
  const catcherPasses=catchingRoadId!==null&&
    observedSecondsPerKmByRoad[
      roadIds.find(id=>id!==catchingRoadId)]>
        observedSecondsPerKmByRoad[
          catchingRoadId]+EPS&&
    riders.some(row=>row.roadId===
      catchingRoadId&&row.urgent);
  const version=startInput.physicalDecisionVersion===1?
    `${PHYSICAL_REAR_CONTACT_CHOICE_VERSION}-decisions-1`:
    PHYSICAL_REAR_CONTACT_CHOICE_VERSION;
  return {version,
    sourceKm:km,roadIds:[...roadIds],
    catchingRoadId,
    outcome:catcherPasses?'pass_through':'join',
    riderDecisions:riders.map(row=>({
      riderId:row.riderId,
      ...(startInput.physicalDecisionVersion===1?{
        version}:{}),
      teamId:row.teamId,
      goal:row.goal,
      effort:row.effort,
      ...(startInput.physicalRearIntentVersion===2?{
        intentSource:row.intentSource}:{}),
      committedTeamStake:row.committedTeamStake,
      teamOrderEffort:row.teamOrderEffort,
      observedOwnSecondsPerKm:
        row.observedOwnSecondsPerKm,
      observedRivalSecondsPerKm:
        row.observedRivalSecondsPerKm,
      choice:catcherPasses?
        row.roadId===catchingRoadId?
          'pass_through':'continue_on_own_road':
        row.riderId===leaderRiderId?
          'pull':'join_shelter',
      reason:catcherPasses?
        row.roadId===catchingRoadId?
          'committed_goal_keeps_observed_faster_pace':
          'passed_by_faster_committed_road':
        row.riderId===leaderRiderId?
          'paid_contact_cooperation_turn':
          'save_finish_energy_at_paid_contact'})),
    movesGuidedRace:false,officialResults:false};
}
