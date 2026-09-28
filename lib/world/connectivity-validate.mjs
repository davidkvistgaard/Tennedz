import {traceLineCells,lineCells,contiguousCellSequence} from './network.mjs';

const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===2&&b.length===2&&Math.hypot(a[0]-b[0],a[1]-b[1])<.001;
const routes=g=>g?.type==='MultiLineString'?g.coordinates:g?.type==='LineString'?[g.coordinates]:[];
const pointToLine=(point,geometry)=>Math.min(...routes(geometry).flatMap(path=>path.slice(1).map((b,i)=>{
 const a=path[i],vx=b[0]-a[0],vy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*vx+(point[1]-a[1])*vy)/(vx*vx+vy*vy||1)));
 return Math.hypot(point[0]-a[0]-t*vx,point[1]-a[1]-t*vy);
})));

/** Physical network invariants beyond the generic object schema. */
export function validateConnectivity(world){
 const errors=[],ids=new Map(world.objects.map(o=>[o.id,o]));
 const aliases=new Map(world.objects.flatMap(o=>(o.properties.sourceAliases??[]).map(a=>[a,o])));
 const get=id=>ids.get(id)??aliases.get(id);
 const fail=(o,message)=>errors.push(`${o.id}: ${message}`);
 for(const o of world.objects){
  const p=o.properties??{};
  if(p.networkKind&&Array.isArray(p.segmentIds)){
   const segments=p.segmentIds.map(get);
   if(segments.some(s=>!s||s.parentId!==o.id||s.properties?.networkParentId!==o.id)){fail(o,'missing or foreign network segment');continue;}
   for(const s of segments){
    if(!routes(s.geometry).length||!contiguousCellSequence(traceLineCells(s.geometry))||JSON.stringify(lineCells(s.geometry))!==JSON.stringify(s.gridCells))fail(s,'segment geometry or cell crossing is discontinuous');
    if(['road','rail'].includes(o.type)&&s.gridCells.some(cell=>get(`GRID-${cell}`)?.properties.regionId===null))fail(s,'land route crosses an ocean cell');
   }
   if(p.networkKind==='watershed'){
    if(p.sourceKind!=='headwaters'||p.terminalKind!=='ocean-mouth')fail(o,'major river lacks source/mouth');
    const path=routes(o.geometry)[0];
    if(!path||!segments.length||!same(segments[0].properties.fromPoint,path[0])||!same(segments.at(-1).properties.toPoint,path.at(-1)))fail(o,'river segments do not span source to mouth');
    for(let i=1;i<segments.length;i++)if(!same(segments[i-1].properties.toPoint,segments[i].properties.fromPoint))fail(o,'river segment gap');
    if(!Array.isArray(p.tributaryIds)||p.tributaryIds.some(id=>get(id)?.parentId!==o.id))fail(o,'missing tributary reference');
    for(const id of p.tributaryIds??[]){const tributary=get(id);
     if(!tributary||!routes(tributary.geometry).length||pointToLine(tributary.geometry.coordinates.at(-1),o.geometry)>.001||!same(tributary.properties.confluencePoint,tributary.geometry.coordinates.at(-1)))fail(o,`tributary ${id} lacks a confluence`);
    }
   }
   if(['road','rail'].includes(p.networkKind)){
    if(!Array.isArray(p.waypointIds)||p.waypointIds.length<2||p.waypointIds.some(id=>!get(id)))fail(o,'route has missing settlement/infrastructure waypoint');
    for(const s of segments){
     const index=p.waypointIds.indexOf(s.properties.fromId);
     if(index<0||p.waypointIds[index+1]!==s.properties.toId)fail(s,'segment endpoints do not match route waypoints');
    }
    if(p.continuity==='multimodal'){
     if(!p.transferRouteIds?.length||p.transferRouteIds.some(id=>!get(id)||get(id).type!=='ferry_route'))fail(o,'multimodal road gap lacks ferry transfer');
    }else if(segments.length!==p.waypointIds.length-1)fail(o,'route has missing segment');
   }
   if(p.networkKind==='ferry_route'){
    if(!Array.isArray(p.terminalIds)||p.terminalIds.length!==p.waypointIds?.length||p.terminalIds.some(id=>get(id)?.type!=='ferry_terminal'))fail(o,'ferry missing endpoint terminals');
    if(segments.length!==p.terminalIds.length-1)fail(o,'ferry segment/terminal mismatch');
    for(const [i,s] of segments.entries())if(s.properties.terminalFromId!==p.terminalIds[i]||s.properties.terminalToId!==p.terminalIds[i+1]||!same(s.properties.fromPoint,get(p.terminalIds[i])?.geometry?.coordinates)||!same(s.properties.toPoint,get(p.terminalIds[i+1])?.geometry?.coordinates))fail(s,'ferry segment does not meet both terminals');
   }
  }
  if(o.type==='lake'&&p.basinStatus){
   if(!['open','closed','seasonal','limited-outlet','artificial'].includes(p.basinStatus))fail(o,'invalid lake basin status');
   if(p.basinStatus==='closed'&&p.outflowId!==null)fail(o,'closed lake has an outlet');
   if(p.outflowId!==null&&p.outflowId!==undefined&&!get(p.outflowId))fail(o,'lake outlet is missing');
   if(new Set(p.inflowIds??[]).size!==(p.inflowIds??[]).length)fail(o,'duplicate lake inflow');
   for(const id of p.inflowIds??[])if(!get(id))fail(o,'missing lake inflow');
  }
  if(o.type==='dam'&&p.riverId){
   const river=get(p.riverId),reservoir=get(p.reservoirId);
   if(river?.type!=='river_system'||reservoir?.type!=='lake'||!o.geometry||pointToLine(o.geometry.coordinates,river.geometry)>.001)fail(o,'dam does not intersect its river/reservoir system');
  }
  if(p.carriedByRouteId){
   const route=get(p.carriedByRouteId);
   if(!route||!o.geometry||pointToLine(o.geometry.coordinates,route.geometry)>.001)fail(o,'bridge/tunnel is off its carrying route');
  }
  if(o.type==='airport'&&p.sourceVersion==='1.5'){
   if(!['settlement','region'].includes(get(o.parentId)?.type)||!o.gridCells?.length||o.gridCells.some(cell=>get(`GRID-${cell}`)?.properties.regionId===null))fail(o,'airport lacks a plausible land settlement/region');
  }
  if(o.type==='settlement_corridor'&&p.densityByCell)for(const [cell,density] of Object.entries(p.densityByCell)){
   const code=get(`GRID-${cell}`)?.properties.environmentCode;
   if(!code||!['sparse','settled'].includes(density)||density==='settled'&&['O','M','D','R','F'].includes(code))fail(o,`population contradicts protected/wilderness ${cell}`);
  }
  if(o.type==='grid_cell'&&p.localDetail?.version==='1.5'){
   if(!Array.isArray(p.localDetail.objectIds)||p.localDetail.objectIds.some(id=>!get(id)?.gridCells.includes(o.name)))fail(o,'local detail references an object outside its cell');
  }
 }
 return errors;
}
