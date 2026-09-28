import {GRID} from './grid.mjs';

export const cellPoint=id=>[(GRID.columns.indexOf(id[0])+.5)*GRID.cellSizeKm,(Number(id.slice(1))-.5)*GRID.cellSizeKm];
const neighbours=id=>{
 const x=GRID.columns.indexOf(id[0]),y=Number(id.slice(1))-1;
 return [[x+1,y],[x-1,y],[x,y+1],[x,y-1]].filter(([a,b])=>a>=0&&a<16&&b>=0&&b<12).map(([a,b])=>`${GRID.columns[a]}${b+1}`);
};

/** Schematic route through adjacent macro cells; not an exact engineering alignment. */
export function routeCells(world,waypoints,{water=false}={}){
 const cells=new Map(world.objects.filter(o=>o.type==='grid_cell').map(o=>[o.name,o]));
 const cost=id=>{
  const code=cells.get(id)?.properties.environmentCode;
  if(!code)return Infinity;
  if(!water&&code==='O')return Infinity;
  return water?(code==='O'?1:2):({M:6,V:3,D:3,F:2,R:2,W:2}[code]??1);
 };
 const pathBetween=(start,end)=>{
  if(!cells.has(start)||!cells.has(end)||!Number.isFinite(cost(start))||!Number.isFinite(cost(end)))throw new Error(`Invalid route endpoints ${start} → ${end}`);
  const dist=new Map([[start,0]]),prev=new Map(),open=new Set([start]);
  while(open.size){
   const at=[...open].sort((a,b)=>dist.get(a)-dist.get(b)||a.localeCompare(b))[0];open.delete(at);
   if(at===end)break;
   for(const next of neighbours(at)){
    const n=dist.get(at)+cost(next);
    if(n<(dist.get(next)??Infinity)){dist.set(next,n);prev.set(next,at);open.add(next);}
   }
  }
  if(!dist.has(end))throw new Error(`No ${water?'water':'land'} route ${start} → ${end}`);
  const result=[end];while(result[0]!==start)result.unshift(prev.get(result[0]));return result;
 };
 const path=[];
 for(let i=1;i<waypoints.length;i++){
  const leg=pathBetween(waypoints[i-1],waypoints[i]);
  path.push(...(i===1?leg:leg.slice(1)));
 }
 return path;
}
