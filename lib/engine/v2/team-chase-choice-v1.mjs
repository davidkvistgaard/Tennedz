// Opt-in tactical choice from an observer's uncertain road forecast. It can
// ask for help, but never spends another team's energy or moves a gap.
import {isDeepStrictEqual} from 'node:util';
import {assertRoadGroups} from './road-groups.mjs';
import {orderAt} from './orders.mjs';
import {perceiveRivalStrength} from './break-threat-perception.mjs';
import {assessOneKmChaseDelay} from './break-threat-matrix.mjs';

export const TEAM_CHASE_CHOICE_VERSION='v2-team-chase-choice-1';
const STAKES=new Set(['sprint_finish','summit_attack']);

export function decideTeamChaseChoiceV1({teams,roadGroups,
  observerTeamId,raceSeed,stake,nominatedChaseTeamIds,
  conditionalChaseTeamIds=[],unavailableRiderIds=[],
  remainingSegments}){
  assertRoadGroups(roadGroups);
  const firstKm=remainingSegments?.[0]?.km;
  const observer=teams?.find(team=>team.id===observerTeamId);
  if(!observer||!STAKES.has(stake)||
    !Number.isInteger(firstKm)||firstKm<1||
    !Array.isArray(nominatedChaseTeamIds)||
    !nominatedChaseTeamIds.includes(observerTeamId)||
    !Array.isArray(conditionalChaseTeamIds)||
    !Array.isArray(unavailableRiderIds)||
    !['selective','all'].includes(orderAt(observer.orders,
      firstKm-1).chase))
    throw new Error('Chase choice needs a committed sporting stake.');
  const perception=perceiveRivalStrength({teams,observerTeamId,
    raceSeed});
  const teamByRider=new Map(teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  const forward=new Set(roadGroups.flatMap(group=>group.riderIds));
  const coalition=[...nominatedChaseTeamIds,
    ...conditionalChaseTeamIds];
  if(new Set(coalition).size!==coalition.length||
    coalition.some(id=>!teams.some(team=>team.id===id)||
      roadGroups.some(group=>group.teamIds.includes(id)))||
    unavailableRiderIds.some(id=>!teamByRider.has(id)||
      forward.has(id))||
    new Set(unavailableRiderIds).size!==
      unavailableRiderIds.length||
    roadGroups.some(group=>{
      const actual=new Set(group.riderIds.map(id=>
        teamByRider.get(id)));
      return actual.has(undefined)||actual.size!==group.teamIds.length||
        group.teamIds.some(id=>!actual.has(id));
    }))
    throw new Error('Chase choice needs separate real road groups.');
  // Other teams' private helper roster and future work orders are unknown.
  const forecastTeams=perception.teams.map(team=>
    team.id===observerTeamId?team:{...team,orders:{...team.orders,
      helperIds:team.riders.filter(rider=>
        rider.id!==team.orders.captainId)
        .map(rider=>rider.id),
      baseline:{effort:'steady',chase:'selective',
        breakWork:'cooperate'},phases:[]}});
  const assessments=roadGroups.map(group=>{
    const otherForward=roadGroups.filter(row=>row.id!==group.id)
      .flatMap(row=>row.riderIds);
    const forecast=assessOneKmChaseDelay({teams:forecastTeams,
      frontRiderIds:group.riderIds,
      unavailableRiderIds:[...unavailableRiderIds,
        ...otherForward],nominatedChaseTeamIds,
      conditionalChaseTeamIds,remainingSegments,
      gapSeconds:group.gapSeconds,rotationVersion:3});
    const now=forecast.now,deferred=forecast.deferred;
    const action=forecast.nominatedMustStartNow?'commit_now':
      forecast.expandedMustStartNow?'commit_and_request_help':
        now.nominated.allInCatchPossible?'watch':
          now.expanded.allInCatchPossible?'request_help':
            'capacity_shortfall';
    return {roadGroupId:group.id,riderIds:[...group.riderIds],
      observedGapSeconds:group.gapSeconds,
      action,nominatedCatchNow:now.nominated.allInCatchPossible,
      nominatedCatchAfterDelay:
        deferred.nominated.allInCatchPossible,
      conditionalCatchNow:now.expanded.allInCatchPossible,
      conditionalCatchAfterDelay:
        deferred.expanded.allInCatchPossible,
      nominatedHeadroomSeconds:
        now.nominated.allInGapHeadroomSeconds,
      nominatedDelayedHeadroomSeconds:
        deferred.nominated.allInGapHeadroomSeconds,
      conditionalHeadroomSeconds:
        now.expanded.allInGapHeadroomSeconds,
      conditionalDelayedHeadroomSeconds:
        deferred.expanded.allInGapHeadroomSeconds};
  });
  return {version:TEAM_CHASE_CHOICE_VERSION,
    observerTeamId,sourceKm:firstKm,stake,
    nominatedChaseTeamIds:[...nominatedChaseTeamIds],
    conditionalChaseTeamIds:[...conditionalChaseTeamIds],
    assessments};
}

export function validateTeamChaseChoiceV1(input,recording){
  if(!isDeepStrictEqual(recording,decideTeamChaseChoiceV1(input)))
    throw new Error('Chase choice differs from perceived source.');
  return true;
}
