import seedrandom from 'seedrandom';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';
import {assertRoadGroups} from './road-groups.mjs';

export function segmentBaseSeconds(segment){
  const tune=TUNING.finish,grade=segment.gradientPct;
  const slope=grade>0?grade*tune.climbFactor:Math.max(-.12,grade*tune.descentFactor);
  const surface=segment.surface==='cobbles'?tune.cobbleFactor:segment.surface==='road'?0:tune.roughSurfaceFactor;
  return tune.baseSecondsPerKm*(1+slope+surface+segment.weather.windKph*tune.windFactor+
    segment.weather.rainMm*tune.rainFactor);
}

function finishRows({route,teams,states,breakawayRiderIds=[],gapSeconds=0,roadGroups=null,seed}){
  const finalSegment=route.kilometres.at(-1),ahead=new Set(breakawayRiderIds);
  const roadGroupByRider=new Map();
  if(roadGroups!==null){
    assertRoadGroups(roadGroups);
    for(const group of roadGroups)for(const id of group.riderIds)
      roadGroupByRider.set(id,group);
    const rosterIds=new Set(teams.flatMap(team=>team.riders.map(rider=>rider.id)));
    if([...roadGroupByRider.keys()].some(id=>!rosterIds.has(id)))
      throw new Error('Road group contains a rider outside the finish roster.');
  }
  const stateById=new Map(states.map(state=>[state.id,state]));
  const base=route.kilometres.reduce((sum,segment)=>sum+segmentBaseSeconds(segment),0);
  return teams.flatMap(team=>team.riders.map(rider=>{
    const state=stateById.get(rider.id);
    if(!state)throw new Error(`Missing final state for ${rider.id}.`);
    const finale=riderKilometreEffect(rider,finalSegment,{phase:'finale',energy:state.energy,exposed:finalSegment.exposed});
    const noise=seedrandom(`${seed}:finish:${rider.id}`)()*TUNING.finish.noiseSeconds;
    const roadGroup=roadGroupByRider.get(rider.id);
    if(roadGroups!==null&&(state.group==='breakaway')!==Boolean(roadGroup))
      throw new Error(`Road-group membership differs from final state for ${rider.id}.`);
    const riderGap=roadGroups===null?(ahead.has(rider.id)?gapSeconds:0):roadGroup?.gapSeconds??0;
    const rawTime=base+state.deficitSeconds-riderGap+
      (100-finale.ability)*TUNING.finish.finaleSecondsPerPoint+noise;
    return {riderId:rider.id,teamId:team.id,name:rider.name??rider.id,
      rawTime,energy:state.energy,group:state.group,roadGroupId:roadGroup?.id??null,
      finaleAbility:finale.ability};
  }));
}

function rankFinish(rows,{gapSeconds,roadGroups=null,preserveGroupOrder=true}){
  const unsorted=rows.map(rider=>({...rider}));
  // A finale can reorder riders within their final group, but it cannot put
  // the bunch ahead of an uncaught break or a dropped rider ahead of the bunch.
  if(preserveGroupOrder){
    let previousGroupEnd=null;
    const bands=roadGroups===null?
      [['breakaway',0],['peloton',gapSeconds],['dropped',.05]]:
      [...roadGroups.map((group,index)=>[group.id,index===0?0:
        roadGroups[index-1].gapSeconds-group.gapSeconds]),
      ['peloton',roadGroups.at(-1)?.gapSeconds??0],['dropped',.05]];
    for(const [band,separation] of bands){
      const members=unsorted.filter(rider=>rider.roadGroupId===band||
        rider.roadGroupId===null&&rider.group===band);
      if(!members.length)continue;
      const earliest=Math.min(...members.map(rider=>rider.rawTime));
      const shift=previousGroupEnd===null?0:Math.max(0,previousGroupEnd+separation-earliest);
      for(const rider of members)rider.rawTime+=shift;
      previousGroupEnd=Math.max(...members.map(rider=>rider.rawTime));
    }
  }
  unsorted.sort((a,b)=>a.rawTime-b.rawTime||String(a.riderId).localeCompare(String(b.riderId)));
  const winnerTime=unsorted[0].rawTime;
  return unsorted.map((rider,index)=>({riderId:rider.riderId,teamId:rider.teamId,name:rider.name,
    position:index+1,timeSeconds:+rider.rawTime.toFixed(2),gapSeconds:+(rider.rawTime-winnerTime).toFixed(2),
    energy:rider.energy,group:rider.group,
    ...(roadGroups===null?{}:{roadGroupId:rider.roadGroupId}),
    finaleAbility:rider.finaleAbility}));
}

export function provisionalFinish(input){
  return rankFinish(finishRows(input),{gapSeconds:input.gapSeconds});
}

// A provisional two-group result for isolated road-group scenarios. The full
// sprint/catch calculation remains single-group until tour integration.
export function provisionalRoadGroupFinish(input){
  if(!Array.isArray(input.roadGroups))throw new Error('Road groups are required.');
  return rankFinish(finishRows(input),{roadGroups:input.roadGroups});
}

// The final burst may catch only the slower members of the leading group.
// Its outcome is calculated once and then written into the last replay frame.
export function resolveFinishingSprint(input){
  const rows=finishRows(input);
  const bunch=rows.filter(rider=>rider.group==='peloton');
  const bunchLeader=bunch.length?Math.min(...bunch.map(rider=>rider.rawTime)):Infinity;
  const caughtRiderIds=rows.filter(rider=>rider.group==='breakaway'&&rider.rawTime>=bunchLeader)
    .map(rider=>rider.riderId);
  const caught=new Set(caughtRiderIds);
  const remainingBreakawayRiderIds=input.breakawayRiderIds.filter(id=>!caught.has(id));
  const remaining=rows.filter(rider=>remainingBreakawayRiderIds.includes(rider.riderId));
  const gapSeconds=caught.size===0?input.gapSeconds:remaining.length?
    Math.max(.01,+(bunchLeader-Math.max(...remaining.map(rider=>rider.rawTime))).toFixed(2)):0;
  for(const rider of rows)if(caught.has(rider.riderId))rider.group='peloton';
  return {caughtRiderIds,remainingBreakawayRiderIds,gapSeconds,
    results:rankFinish(rows,{gapSeconds})};
}
