import {flatScenario,STRATEGIES} from '../../race-lab/scenario.mjs';
import {runKilometreLab} from './lab.mjs';

export const PREVIEW_PLANS=Object.freeze(['sprint','break','balanced','conserve']);

export function createMotorLabPreview({plan,seed}){
 if(!PREVIEW_PLANS.includes(plan)||!Number.isInteger(seed)||seed<0||seed>9999)
  throw new Error('Choose a valid plan and scenario number.');
 const scenario=flatScenario(plan);
 const race=runKilometreLab({scenario,seed:`guided-preview:${seed}`});
 const names=new Map(scenario.teams.flatMap(team=>team.riders.map(rider=>[rider.id,rider.name])));
 const teamNames=new Map(scenario.teams.map(team=>[team.id,team.name]));
 const riderNames=ids=>ids.map(id=>names.get(id)??id);
 const frames=race.frames.map(frame=>{
  const moments=[];
  if(frame.joinedBreakawayRiderIds.length)
   moments.push(`${riderNames(frame.joinedBreakawayRiderIds).join(', ')} joined a break`);
  if(frame.formedChaseGroupId)
   moments.push('A new chase group left the peloton');
  for(const attack of frame.splitAttacks??[])
   if(attack.status==='split')moments.push(`${names.get(attack.riderId)??attack.riderId} attacked from a break`);
  if(frame.caughtBreakawayRiderIds.length)
   moments.push(`${riderNames(frame.caughtBreakawayRiderIds).join(', ')} caught`);
  if(frame.mergedRoadGroupIds.length)moments.push('Road groups merged');
  if(frame.finishLineCatch)moments.push('Caught in the finishing sprint');
  return {
   km:frame.km,terrain:frame.terrain,surface:frame.surface,exposed:frame.exposed,
   weather:race.route.kilometres[frame.km-1].weather,
   groups:frame.roadGroups.map(group=>({id:group.id,gapSeconds:group.gapSeconds,
    riders:riderNames(group.riderIds),workers:riderNames(group.riderIds.filter(id=>frame.pullRiderIds.includes(id)))})),
   pelotonCount:frame.riderGroups.filter(rider=>rider.group==='peloton').length,
   droppedCount:frame.riderGroups.filter(rider=>rider.group==='dropped').length,
   chasingTeams:frame.chasers.map(id=>teamNames.get(id)??id),
   amberEnergy:frame.teamEnergy.find(team=>team.teamId==='team-0')?.mean??null,
   moments,
  };
 });
 return {
  kind:'fictional-motor-lab',engineVersion:race.version,tuningVersion:race.tuningVersion,
  scenarioName:scenario.name,plan,planLabel:STRATEGIES[plan],seed,
  distanceKm:race.route.distanceKm,
  teams:scenario.teams.map(team=>({id:team.id,name:team.name,riderCount:team.riders.length})),
  frames,
  results:race.provisionalResults.map(result=>({position:result.position,name:result.name,
   team:teamNames.get(result.teamId)??result.teamId,gapSeconds:result.gapSeconds,
   group:result.group})),
 };
}
