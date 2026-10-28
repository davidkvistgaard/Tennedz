// Read-only V94 source audit: rival estimates never alter paid road frames.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {assessRoadGroupsForObserver} from
  '../lib/engine/v2/break-threat-perception.mjs';
import {orderAt} from '../lib/engine/v2/orders.mjs';

const {recording}=createV94RaceDynamicsPreview({format:'stage',
  roadGroupPaceVersion:1,settings:{distanceKm:260,terrain:'mountain',
    teamCount:20,fatigue:30,attack:'none',chase:'ignore',
    seed:'road-scale-probe-1'}});
const sourceFrames=JSON.stringify(recording.frames);
const candidates=recording.frames.filter(frame=>
  frame.km<260&&frame.roadGroups.length>=2);
const selected=candidates.filter((_,index)=>index===0||
  index===Math.floor(candidates.length/2)||index===candidates.length-1);
const results=[];
for(const frame of selected){
  const energy=Object.fromEntries(frame.riderGroups.map(row=>
    [row.id,row.energy]));
  const teams=recording.committedInputs.teams.map(team=>({...team,
    energy:Object.fromEntries(team.riders.map(rider=>
      [rider.id,energy[rider.id]]))}));
  const aheadTeamIds=new Set(frame.roadGroups.flatMap(group=>group.teamIds));
  const nominatedChaseTeamIds=teams.filter(team=>
    !aheadTeamIds.has(team.id)&&
    recording.committedInputs.raceContext.teamRoles[team.id]==='control'&&
    orderAt(team.orders,frame.km).chase!=='ignore').map(team=>team.id);
  const assessment=assessRoadGroupsForObserver({teams,
    roadGroups:frame.roadGroups,observerTeamId:'you',
    raceSeed:recording.raceSeed,nominatedChaseTeamIds,
    unavailableRiderIds:frame.riderGroups.filter(row=>
      row.group==='dropped').map(row=>row.id),
    remainingSegments:recording.route.kilometres.slice(frame.km)});
  if(assessment.groups.length!==frame.roadGroups.length)
    throw new Error('A recorded road group was lost in threat assessment.');
  results.push({km:frame.km,groupCount:assessment.groups.length,
    groups:assessment.groups.map(row=>({roadGroupId:row.roadGroupId,
      gapSeconds:row.gapSeconds,capacityBand:row.assessment.capacityBand}))});
}
if(JSON.stringify(recording.frames)!==sourceFrames)
  throw new Error('Perception mutated paid road frames.');
console.log(JSON.stringify({multiGroupFrames:candidates.length,
  assessed:results.length,results},null,2));
