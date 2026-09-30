import {flatScenario,STRATEGIES} from '../../race-lab/scenario.mjs';
import {LAB_ROUTE_OPTIONS,runKilometreLab} from './lab.mjs';

export const PREVIEW_PLANS=Object.freeze(['sprint','break','balanced','conserve']);
export const PREVIEW_ROUTES=LAB_ROUTE_OPTIONS;
export const PREVIEW_ORDER_OPTIONS=Object.freeze({
 breakResponse:['hold_plan','chase_if_threatened'],
 breakWork:['cooperate','sit_on','drive'],
 lateEffort:['follow_plan','conserve','steady','hard'],
 breakAttackMarker:['none','40','80','120'],
 roadCaptain:['standard','experienced'],
});

function normalizePreviewOrders(input){
 if(input===undefined)return {breakResponse:'hold_plan',breakWork:'cooperate',lateEffort:'follow_plan',breakAttackMarker:'none',roadCaptain:'standard'};
 if(!input||typeof input!=='object'||Array.isArray(input)||
   Object.keys(input).some(key=>!Object.hasOwn(PREVIEW_ORDER_OPTIONS,key)))
  throw new Error('Choose valid advanced orders.');
 const orders={breakResponse:'hold_plan',breakWork:'cooperate',lateEffort:'follow_plan',breakAttackMarker:'none',roadCaptain:'standard',...input};
 if(Object.entries(orders).some(([key,value])=>!PREVIEW_ORDER_OPTIONS[key].includes(value)))
  throw new Error('Choose valid advanced orders.');
 return orders;
}

export function createMotorLabPreview({plan,seed,routeId='coast',orders:inputOrders}){
 if(!PREVIEW_PLANS.includes(plan)||!Number.isInteger(seed)||seed<0||seed>9999||
   !PREVIEW_ROUTES.includes(routeId))
  throw new Error('Choose a valid plan, route and scenario number.');
 const orders=normalizePreviewOrders(inputOrders);
 const scenario=flatScenario(plan);
 Object.assign(scenario.teams[0],{
  breakResponse:orders.breakResponse,
  breakWork:orders.breakWork,
  ...(orders.roadCaptain==='experienced'?{roadCaptainLeadership:85}:{}),
  ...(orders.breakAttackMarker==='none'?{}:{breakAttackAtKm:Number(orders.breakAttackMarker)}),
  ...(orders.lateEffort==='follow_plan'?{}:{phaseAtKm:120,phaseEffort:orders.lateEffort}),
 });
 const race=runKilometreLab({scenario,seed:`guided-preview:${seed}`,routeId});
 const names=new Map(scenario.teams.flatMap(team=>team.riders.map(rider=>[rider.id,rider.name])));
 const teamNames=new Map(scenario.teams.map(team=>[team.id,team.name]));
 const riderNames=ids=>ids.map(id=>names.get(id)??id);
 const frames=race.frames.map(frame=>{
  const segment=race.route.kilometres[frame.km-1];
  const moments=[];
  if(frame.km===121&&orders.lateEffort!=='follow_plan')
   moments.push(`Amber switched to ${orders.lateEffort} effort`);
  for(const decision of frame.decisions.filter(item=>item.teamId==='team-0')){
   if(decision.kind==='chase_break')moments.push('Amber road captain called a chase');
   if(decision.kind==='resume_plan')moments.push('Amber road captain ended the chase');
  }
  if(frame.joinedBreakawayRiderIds.length)
   moments.push(`${riderNames(frame.joinedBreakawayRiderIds).join(', ')} joined a break`);
  if(frame.formedChaseGroupId)
   moments.push('A new chase group left the peloton');
  for(const attack of frame.splitAttacks??[]){
   const rider=names.get(attack.riderId)??attack.riderId;
   if(attack.status==='split')moments.push(`${rider} attacked from a break`);
   else if(attack.teamId==='team-0'&&attack.source==='committed')
    moments.push(`${rider}'s planned break attack was ${attack.status.replaceAll('_',' ')}`);
  }
  for(const blocked of frame.blockedBreakAttacks??[])
   if(blocked.teamId==='team-0')moments.push(`Amber's planned break attack could not start: ${blocked.reason.replaceAll('_',' ')}`);
  if(frame.caughtBreakawayRiderIds.length)
   moments.push(`${riderNames(frame.caughtBreakawayRiderIds).join(', ')} caught`);
  if(frame.mergedRoadGroupIds.length)moments.push('Road groups merged');
  if(frame.finishLineCatch)moments.push('Caught in the finishing sprint');
  return {
   km:frame.km,terrain:frame.terrain,surface:frame.surface,exposed:frame.exposed,
   elevationM:segment.endM,gradientPct:segment.gradientPct,weather:segment.weather,
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
  scenarioName:race.routeName,routeId,plan,planLabel:STRATEGIES[plan],orders,seed,
  distanceKm:race.route.distanceKm,
  teams:scenario.teams.map(team=>({id:team.id,name:team.name,riderCount:team.riders.length})),
  frames,
  results:race.provisionalResults.map(result=>({position:result.position,name:result.name,
   team:teamNames.get(result.teamId)??result.teamId,gapSeconds:result.gapSeconds,
   group:result.group})),
 };
}
