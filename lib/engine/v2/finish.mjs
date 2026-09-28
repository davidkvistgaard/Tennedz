import seedrandom from 'seedrandom';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export function segmentBaseSeconds(segment){
  const tune=TUNING.finish,grade=segment.gradientPct;
  const slope=grade>0?grade*tune.climbFactor:Math.max(-.12,grade*tune.descentFactor);
  const surface=segment.surface==='cobbles'?tune.cobbleFactor:segment.surface==='road'?0:tune.roughSurfaceFactor;
  return tune.baseSecondsPerKm*(1+slope+surface+segment.weather.windKph*tune.windFactor+
    segment.weather.rainMm*tune.rainFactor);
}

export function provisionalFinish({route,teams,states,breakawayRiderIds,gapSeconds,seed}){
  const finalSegment=route.kilometres.at(-1),ahead=new Set(breakawayRiderIds);
  const stateById=new Map(states.map(state=>[state.id,state]));
  const base=route.kilometres.reduce((sum,segment)=>sum+segmentBaseSeconds(segment),0);
  const unsorted=teams.flatMap(team=>team.riders.map(rider=>{
    const state=stateById.get(rider.id);
    if(!state)throw new Error(`Missing final state for ${rider.id}.`);
    const finale=riderKilometreEffect(rider,finalSegment,{phase:'finale',energy:state.energy,exposed:finalSegment.exposed});
    const noise=seedrandom(`${seed}:finish:${rider.id}`)()*TUNING.finish.noiseSeconds;
    const rawTime=base+state.deficitSeconds-(ahead.has(rider.id)?gapSeconds:0)+
      (100-finale.ability)*TUNING.finish.finaleSecondsPerPoint+noise;
    return {riderId:rider.id,teamId:team.id,name:rider.name??rider.id,
      rawTime,energy:state.energy,group:state.group,finaleAbility:finale.ability};
  }));
  unsorted.sort((a,b)=>a.rawTime-b.rawTime||String(a.riderId).localeCompare(String(b.riderId)));
  const winnerTime=unsorted[0].rawTime;
  return unsorted.map((rider,index)=>({riderId:rider.riderId,teamId:rider.teamId,name:rider.name,
    position:index+1,timeSeconds:+rider.rawTime.toFixed(2),gapSeconds:+(rider.rawTime-winnerTime).toFixed(2),
    energy:rider.energy,group:rider.group,finaleAbility:rider.finaleAbility}));
}
