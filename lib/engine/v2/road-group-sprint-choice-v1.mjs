// Opt-in per-rider front-group intention. Rival sprint estimates are the
// observer's bounded view; the physical road still uses exact paid ability.
import {perceiveRivalStrength} from './break-threat-perception.mjs';
import {isDeepStrictEqual} from 'node:util';
import {assertRoadGroups} from './road-groups.mjs';
import {orderAt} from './orders.mjs';
import {TUNING} from './tuning.mjs';

export const ROAD_GROUP_SPRINT_CHOICE_VERSION=
  'v2-road-group-sprint-choice-1';
const GOALS=new Set(['win_stage','cooperate','protect_teammate']);
const SPRINT_WINDOW_KM=20;

export function decideRoadGroupSprintChoiceV1({roadGroups,groupId,
  teams,riderGoals,km,distanceKm,raceSeed}){
  assertRoadGroups(roadGroups);
  const group=roadGroups.find(row=>row.id===groupId);
  if(!group||!Array.isArray(teams)||
    !Array.isArray(riderGoals)||
    riderGoals.length!==group.riderIds.length||
    new Set(riderGoals.map(row=>row?.riderId)).size!==
      group.riderIds.length||
    !Number.isInteger(km)||km<1||
    !Number.isInteger(distanceKm)||distanceKm<km||
    typeof raceSeed!=='string'||!raceSeed)
    throw new Error('Front riders need their current group and goals.');
  const teamByRider=new Map(teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team])));
  const goalByRider=new Map(riderGoals.map(row=>[row.riderId,row]));
  if(roadGroups.some(row=>{
    const actual=new Set(row.riderIds.map(id=>
      teamByRider.get(id)?.id));
    return actual.has(undefined)||actual.size!==row.teamIds.length||
      row.teamIds.some(id=>!actual.has(id));
  })||group.riderIds.some(id=>!teamByRider.has(id)||
    !GOALS.has(goalByRider.get(id)?.goal))||
    new Set(teams.flatMap(team=>team.riders.map(rider=>
      rider.id))).size!==teams.reduce((sum,team)=>
      sum+team.riders.length,0))
    throw new Error('Front rider needs a real team and sporting goal.');
  const index=roadGroups.indexOf(group);
  const views=new Map();
  const decisions=group.riderIds.map(riderId=>{
    const team=teamByRider.get(riderId);
    const rider=team.riders.find(row=>row.id===riderId);
    const order=orderAt(team.orders,km-1);
    const energy=Number(team.energy?.[riderId]??100);
    if(!Number.isFinite(energy)||energy<0||energy>100||
      !Number.isFinite(rider.sprint)||
      !['cooperate','drive','sit_on'].includes(order.breakWork))
      throw new Error('Front rider needs recorded capacity and work order.');
    const ownAhead=roadGroups.slice(0,index).some(ahead=>
      ahead.riderIds.some(id=>teamByRider.get(id)?.id===team.id));
    let view=views.get(team.id);
    if(!view){
      view=perceiveRivalStrength({teams,observerTeamId:team.id,
        raceSeed});
      views.set(team.id,view);
    }
    const rivalSprintIntervals=group.riderIds.filter(id=>
      teamByRider.get(id)?.id!==team.id).map(id=>({riderId:id,
      interval:[...view.intervalsByRiderId[id].skillIntervals.sprint]}));
    const strongestPerceivedRival=rivalSprintIntervals.length?
      Math.max(...rivalSprintIntervals.map(row=>
        (row.interval[0]+row.interval[1])/2)):null;
    const weakerSprint=rider.sprint<
      (strongestPerceivedRival??-Infinity);
    const reason=order.breakWork==='sit_on'?'committed_sit_on':
      ownAhead?'teammate_further_ahead':
        energy<=TUNING.breakaway.minPullEnergy?'insufficient_energy':
          order.breakWork==='drive'?'committed_drive':
            goalByRider.get(riderId).goal==='protect_teammate'?
              'protect_teammate':
              goalByRider.get(riderId).goal==='win_stage'&&
              distanceKm-km<=SPRINT_WINDOW_KM&&weakerSprint?
                'preserve_sprint_chance':'cooperate';
    const choice=['committed_sit_on','teammate_further_ahead',
      'insufficient_energy','preserve_sprint_chance']
      .includes(reason)?'sit_in':'pull';
    return {roadGroupId:group.id,riderId,teamId:team.id,
      goal:goalByRider.get(riderId).goal,
      choice,reason,energy,
      ownSprint:rider.sprint,rivalSprintIntervals};
  });
  return {version:ROAD_GROUP_SPRINT_CHOICE_VERSION,
    sourceKm:km,groupId,decisions,
    pullRiderIds:decisions.filter(row=>row.choice==='pull')
      .map(row=>row.riderId)};
}

export function validateRoadGroupSprintChoiceV1(input,recording){
  if(!isDeepStrictEqual(recording,decideRoadGroupSprintChoiceV1(input)))
    throw new Error('Front rider choice differs from observed source.');
  return true;
}
