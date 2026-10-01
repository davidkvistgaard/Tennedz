import {flatScenario,STRATEGIES} from '../../race-lab/scenario.mjs';
import {LAB_ROUTE_OPTIONS,runKilometreLab} from './lab.mjs';

export const PREVIEW_PLANS=Object.freeze(['sprint','break','balanced','conserve']);
export const PREVIEW_ROUTES=LAB_ROUTE_OPTIONS;
export const PREVIEW_ORDER_OPTIONS=Object.freeze({
 chaseContribution:['follow_plan','ignore','all'],
 breakResponse:['hold_plan','chase_if_threatened'],
 breakWork:['cooperate','sit_on','drive'],
 lateEffort:['follow_plan','conserve','steady','hard'],
 breakAttackMarker:['none','40','80','120'],
 roadCaptain:['standard','experienced'],
 captainSupport:['hold_position','drop_back_if_dropped'],
 helperAttackPolicy:['open','hold_for_captain','release_if_dropped'],
});

function normalizePreviewOrders(input){
 if(input===undefined)return {chaseContribution:'follow_plan',breakResponse:'hold_plan',breakWork:'cooperate',lateEffort:'follow_plan',breakAttackMarker:'none',roadCaptain:'standard',captainSupport:'hold_position',helperAttackPolicy:'open'};
 if(!input||typeof input!=='object'||Array.isArray(input)||
   Object.keys(input).some(key=>!Object.hasOwn(PREVIEW_ORDER_OPTIONS,key)))
  throw new Error('Choose valid advanced orders.');
 const orders={chaseContribution:'follow_plan',breakResponse:'hold_plan',breakWork:'cooperate',lateEffort:'follow_plan',breakAttackMarker:'none',roadCaptain:'standard',captainSupport:'hold_position',helperAttackPolicy:'open',...input};
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
 // The ridge sprint exercise gives Amber a sprinter who can briefly lose
 // contact on climbs and helpers capable of reaching them. Other presets keep
 // their existing rider profiles and Coast remains unchanged.
 if(routeId==='ridge'&&plan==='sprint')scenario.teams[0].riders.forEach((rider,index)=>{
  rider.mountain=index===0?22:55;
 });
 Object.assign(scenario.teams[0],{
  ...(orders.chaseContribution==='follow_plan'?{}:{chaseContribution:orders.chaseContribution}),
  breakResponse:orders.breakResponse,
  breakWork:orders.breakWork,
  captainSupport:orders.captainSupport,
  helperAttackPolicy:orders.helperAttackPolicy,
  ...(orders.roadCaptain==='experienced'?{roadCaptainLeadership:85}:{}),
  ...(orders.breakAttackMarker==='none'?{}:{breakAttackAtKm:Number(orders.breakAttackMarker)}),
  ...(orders.lateEffort==='follow_plan'?{}:{phaseAtKm:120,phaseEffort:orders.lateEffort}),
 });
 const race=runKilometreLab({scenario,seed:`guided-preview:${seed}`,routeId});
 const amberHelperIds=new Set(race.committedInputs.teams.find(team=>team.id==='team-0').orders.helperIds);
 const amberRiderIds=new Set(race.committedInputs.teams.find(team=>team.id==='team-0').riders.map(rider=>rider.id));
 const amberBunchAttackAttempts=race.frames.reduce((sum,frame)=>sum+
  frame.attackers.filter(id=>amberRiderIds.has(id)).length,0);
 const amberHelperAttackAttempts=race.frames.reduce((sum,frame)=>sum+
  frame.attackers.filter(id=>amberHelperIds.has(id)).length,0);
 const names=new Map(scenario.teams.flatMap(team=>team.riders.map(rider=>[rider.id,rider.name])));
 const teamNames=new Map(scenario.teams.map(team=>[team.id,team.name]));
 const riderNames=ids=>ids.map(id=>names.get(id)??id);
 const frames=race.frames.map((frame,index)=>{
  const segment=race.route.kilometres[frame.km-1];
  const priorGroups=race.frames[index-1]?.roadGroups??[];
  const priorLeadSeconds=priorGroups[0]?.gapSeconds??0;
  const moments=[];
  if(frame.km===121&&orders.lateEffort!=='follow_plan')
   moments.push(`Amber switched to ${orders.lateEffort} effort`);
  for(const support of frame.supportEvents.filter(event=>event.teamId==='team-0'&&event.recoveredSeconds>0))
   moments.push(`${names.get(support.helperId)} helped Amber Captain recover ${support.recoveredSeconds.toFixed(1)} s`);
  for(const decision of frame.decisions.filter(item=>item.teamId==='team-0')){
   if(decision.kind==='chase_break')
    moments.push(`Amber road captain called a chase with the leader ${priorLeadSeconds.toFixed(1)} s ahead`);
   if(decision.kind==='resume_plan')moments.push(priorGroups.some(group=>group.teamIds.includes('team-0'))?
    'Amber road captain ended the chase with a teammate ahead':
    'Amber road captain ended the chase after the break was caught');
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
  const ridersAhead=new Set(frame.roadGroups.flatMap(group=>group.riderIds));
  return {
   km:frame.km,terrain:frame.terrain,surface:frame.surface,exposed:frame.exposed,
   elevationM:segment.endM,gradientPct:segment.gradientPct,weather:segment.weather,
   groups:frame.roadGroups.map(group=>({id:group.id,gapSeconds:group.gapSeconds,
    riders:riderNames(group.riderIds),workers:riderNames(group.riderIds.filter(id=>frame.pullRiderIds.includes(id)))})),
   pelotonCount:frame.riderGroups.filter(rider=>rider.group==='peloton').length,
   droppedCount:frame.riderGroups.filter(rider=>rider.group==='dropped').length,
   chasingTeams:frame.chasers.map(id=>teamNames.get(id)??id),
   chaseReasons:frame.chaseReasons.map(({teamId,reason})=>({
    team:teamNames.get(teamId)??teamId,reason,
   })),
   waitingTeams:frame.roadGroups.length?frame.heldChaseTeamIds.map(id=>teamNames.get(id)??id):[],
   holdingHelpers:frame.withheldChaseTeamIds.map(id=>teamNames.get(id)??id),
   decisionLeadGapSeconds:priorLeadSeconds,
   selectiveChaseSafeGapSeconds:frame.selectiveChaseSafeGapSeconds,
   teamsUpRoad:[...new Set(frame.roadGroups.flatMap(group=>group.teamIds))]
    .map(id=>teamNames.get(id)??id),
   attackAttempts:riderNames(frame.attackers),
   attacksWithoutGap:riderNames(frame.attackers.filter(id=>!ridersAhead.has(id))),
   amberEnergy:frame.teamEnergy.find(team=>team.teamId==='team-0')?.mean??null,
   amberCaptainDropped:frame.riderGroups.find(rider=>rider.id==='r-0-0')?.group==='dropped',
   moments,
  };
 });
 const episodes=[];
 let activeEpisode=null;
 for(const frame of frames){
  if(frame.groups.length){
   activeEpisode??={startKm:frame.km,lastKm:frame.km,peakGapSeconds:0,
    chasedKm:0,waitingKm:0,teams:new Set()};
   activeEpisode.lastKm=frame.km;
   activeEpisode.peakGapSeconds=Math.max(activeEpisode.peakGapSeconds,frame.groups[0].gapSeconds);
   if(frame.chasingTeams.length)activeEpisode.chasedKm++;
   if(frame.waitingTeams.length)activeEpisode.waitingKm++;
   frame.teamsUpRoad.forEach(team=>activeEpisode.teams.add(team));
  }else if(activeEpisode){
   episodes.push({...activeEpisode,teams:[...activeEpisode.teams],caughtAtKm:frame.km});
   activeEpisode=null;
  }
 }
 if(activeEpisode)episodes.push({...activeEpisode,teams:[...activeEpisode.teams],caughtAtKm:null});
 return {
  kind:'fictional-motor-lab',engineVersion:race.version,tuningVersion:race.tuningVersion,
  scenarioName:race.routeName,routeId,plan,planLabel:STRATEGIES[plan],orders,seed,
  distanceKm:race.route.distanceKm,
  amberHelperAttackAttempts,
  amberBunchAttackAttempts,
  teams:scenario.teams.map(team=>({id:team.id,name:team.name,riderCount:team.riders.length})),
  frames,episodes,
  results:race.provisionalResults.map(result=>({position:result.position,name:result.name,
   team:teamNames.get(result.teamId)??result.teamId,gapSeconds:result.gapSeconds,
   group:result.group})),
 };
}
