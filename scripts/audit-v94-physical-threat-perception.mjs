// Read-only perceived all-in capacity at the observed shared-road handoff.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {assessRoadGroupsForObserver} from
  '../lib/engine/v2/break-threat-perception.mjs';

const rows=[];
for(const seed of [1,2])for(const fatigue of [0,30]){
  const terrain='flat';
  const settings={distanceKm:120,teamCount:20,terrain,fatigue,
    attack:'none',chase:'selective',
    seed:`chase-turn-holdout-${seed}-${terrain}-${fatigue}`};
  const {recording}=createV94RaceDynamicsPreview({format:'one_day',
    settings,roadGroupPaceVersion:3,chaseTurnVersion:1,
    bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1});
  for(const km of [10,20,30,40,50,60,69]){
    const frame=recording.frames[km-1];
    const energy=new Map(frame.riderGroups.map(row=>[row.id,row.energy]));
    const teams=recording.committedInputs.teams.map(team=>({...team,
      energy:Object.fromEntries(team.riders.map(rider=>
        [rider.id,energy.get(rider.id)]))}));
    const roles=recording.committedInputs.raceContext.teamRoles;
    const forward=new Set(frame.roadGroups.flatMap(group=>group.teamIds));
    const nominated=teams.filter(team=>roles[team.id]==='control'&&
      !forward.has(team.id)).map(team=>team.id);
    const conditional=teams.filter(team=>roles[team.id]==='protect'&&
      !forward.has(team.id)).map(team=>team.id);
    const assessed=assessRoadGroupsForObserver({teams,
      roadGroups:frame.roadGroups,observerTeamId:'you',
      raceSeed:recording.raceSeed,
      nominatedChaseTeamIds:nominated,
      conditionalChaseTeamIds:conditional,
      unavailableRiderIds:frame.riderGroups.filter(row=>
        row.group==='dropped').map(row=>row.id),
      remainingSegments:recording.route.kilometres.slice(km),
      rotationVersion:3});
    rows.push({seed,fatigue,km,
      groups:assessed.groups.map(group=>({id:group.roadGroupId,
        gapSeconds:group.gapSeconds,
        band:group.assessment.capacityBand,
        nominatedBudget:group.assessment.nominated.allInCatchableGapSeconds,
        expandedBudget:group.assessment.expanded.allInCatchableGapSeconds})),
      nominatedTeams:nominated.length,conditionalTeams:conditional.length,
      heldControls:frame.heldChaseTeamIds.filter(id=>nominated.includes(id)).length,
      paidControls:frame.chasers.filter(id=>nominated.includes(id)).length});
  }
}
console.log(JSON.stringify(rows));
