// Explicit sporting stakes for an opt-in team pursuit decision. No GC
// objective is inferred from a synthetic role or absent classification.
import {isDeepStrictEqual} from 'node:util';
import {orderMarkers} from './orders.mjs';
import {decideTeamChaseChoiceV1} from './team-chase-choice-v1.mjs';

export const TEAM_CHASE_STAKE_VERSION='v2-team-chase-stake-1';
const GOALS=new Set(['sprint_finish','summit_attack',
  'break_stage','none']);
const onlyKeys=(value,keys)=>value&&typeof value==='object'&&
  !Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));

export function commitTeamChaseStakesV1({teams,distanceKm,
  keypoints=[],intentions}){
  if(!Array.isArray(teams)||!teams.length||
    new Set(teams.map(team=>team?.id)).size!==teams.length||
    !Array.isArray(intentions)||intentions.length!==teams.length||
    new Set(intentions.map(row=>row?.teamId)).size!==teams.length)
    throw new Error('Every team needs an explicit race stake.');
  const markers=new Set(orderMarkers({distanceKm,keypoints}));
  if(!markers.size)
    throw new Error('Team stakes need a valid race route.');
  const roster=teams.map(team=>({teamId:team.id,
    riderIds:team.riders.map(rider=>rider.id)}));
  if(roster.some(row=>!row.teamId||!row.riderIds.length||
    new Set(row.riderIds).size!==row.riderIds.length)||
    new Set(roster.flatMap(row=>row.riderIds)).size!==
      roster.reduce((count,row)=>count+row.riderIds.length,0))
    throw new Error('Team stakes need real rider rosters.');
  for(const intention of intentions){
    const team=roster.find(row=>row.teamId===intention?.teamId);
    if(!team||!onlyKeys(intention,['teamId','baseline',
      'phases'])||!onlyKeys(intention.baseline,
      ['goal','captainId'])||!GOALS.has(intention.baseline.goal)||
      !team.riderIds.includes(intention.baseline.captainId)||
      !Array.isArray(intention.phases))
      throw new Error('Team stake needs a named captain and goal.');
    let priorKm=0;
    for(const phase of intention.phases){
      if(!onlyKeys(phase,['atKm','goal','captainId'])||
        !markers.has(phase.atKm)||phase.atKm<=priorKm||
        !GOALS.has(phase.goal)||
        !team.riderIds.includes(phase.captainId))
        throw new Error('Team stake may change only at a route marker.');
      priorKm=phase.atKm;
    }
  }
  return {version:TEAM_CHASE_STAKE_VERSION,
    committedAtKm:0,distanceKm,
    keypoints:structuredClone(keypoints),
    roster, intentions:structuredClone(intentions)};
}

export function teamChaseStakeAtKmV1({commitment,teamId,km}){
  if(!commitment||!isDeepStrictEqual(commitment,
    commitTeamChaseStakesV1({teams:commitment.roster?.map(row=>({
      id:row.teamId,riders:row.riderIds.map(id=>({id}))})),
    distanceKm:commitment.distanceKm,
    keypoints:commitment.keypoints,
    intentions:commitment.intentions}))||
    !Number.isInteger(km)||km<1||km>commitment.distanceKm)
    throw new Error('Team chase needs a replayed goal commitment.');
  const intention=commitment.intentions.find(row=>row.teamId===teamId);
  if(!intention)
    throw new Error('Team chase needs a committed team.');
  let active=intention.baseline;
  for(const phase of intention.phases){
    if(phase.atKm>=km)break;
    active=phase;
  }
  return {teamId,goal:active.goal,captainId:active.captainId};
}

export function decideCommittedTeamChaseV1({commitment,
  teams,roadGroups,observerTeamId,raceSeed,
  nominatedChaseTeamIds,conditionalChaseTeamIds=[],
  unavailableRiderIds=[],remainingSegments}){
  const km=remainingSegments?.[0]?.km;
  const stake=teamChaseStakeAtKmV1({commitment,
    teamId:observerTeamId,km});
  if(!isDeepStrictEqual(commitment.roster,
    teams.map(team=>({teamId:team.id,
      riderIds:team.riders.map(rider=>rider.id)}))))
    throw new Error('Team chase roster differs from commitment.');
  const choice=decideTeamChaseChoiceV1({teams,roadGroups,
    observerTeamId,raceSeed,stake:stake.goal,
    nominatedChaseTeamIds,conditionalChaseTeamIds,
    unavailableRiderIds,remainingSegments});
  return {version:TEAM_CHASE_STAKE_VERSION,
    commitment:structuredClone(commitment),stake,choice};
}

export function validateCommittedTeamChaseV1(input,recording){
  if(!isDeepStrictEqual(recording,
    decideCommittedTeamChaseV1(input)))
    throw new Error('Team chase differs from its sporting commitment.');
  return true;
}
