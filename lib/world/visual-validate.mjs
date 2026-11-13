import {geometryBounds,objectCamera,visibleRepresentations,labelsFor} from './atlas-view.mjs';
import {REGION_VISUALS,validateVisualStyle} from './visual-style.mjs';

const near=(a,b,tolerance=.01)=>Math.hypot(a[0]-b[0],a[1]-b[1])<=tolerance;
export function pointInPolygon(point,geometry){
 if(geometry?.type!=='Polygon')return false;
 const ring=geometry.coordinates[0];let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}

/** Checks rendering against canonical objects; it does not author geography. */
export function validateVisualGeography(world){
 const errors=validateVisualStyle(world),byId=new Map(world.objects.map(o=>[o.id,o]));
 const get=id=>byId.get(id),fail=(id,message)=>errors.push(`${id}: ${message}`);
 const national=get('WORLD-001')?.geometry,major=world.objects.filter(o=>o.type==='settlement'&&o.id.startsWith('CITY-'));
 if(major.length!==9)errors.push('Exactly nine established major cities must be present');
 if(national?.type!=='Polygon')fail('WORLD-001','missing illustrated coastline');
 for(const city of major){
  if(!city.representations?.some(r=>r.label&&r.minZoom<=1))fail(city.id,'major-city label missing at L1');
  if(city.geometry?.type==='Point'&&!pointInPolygon(city.geometry.coordinates,national))fail(city.id,'city footprint lies outside the main island');
 }
 const island=get('V12-ISLAND-001')?.geometry,link=get('INF-001')?.geometry,ferry=get('V13-FERRY-RING');
 if(link?.type!=='LineString'||!island||!pointInPolygon(link.coordinates[0],national)||!pointInPolygon(link.coordinates.at(-1),island))fail('INF-001','link does not reach mainland and canonical island land');
 else {
  if(pointInPolygon(link.coordinates[1],national)||pointInPolygon(link.coordinates[1],island))fail('INF-001','link fails to cross open water');
  const length=link.coordinates.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-link.coordinates[i][0],p[1]-link.coordinates[i][1]),0);
  if(length<35||length>45)fail('INF-001','prototype exceeds specified length range');
  if(!near(link.coordinates[0],ferry?.geometry?.coordinates?.[0]??[])||!near(link.coordinates.at(-1),ferry?.geometry?.coordinates?.[1]??[]))fail('INF-001','link ends do not meet existing transport corridor');
 }
 const lake=get('PHY-011')?.geometry,rim=get('DISC-012')?.geometry;
 if(lake?.type!=='Polygon'||rim?.type!=='Polygon'||lake.coordinates[0].some(p=>!pointInPolygon(p,rim)))fail('PHY-011','caldera lake escapes the canonical caldera representation');
 const river=get('RIV-001')?.geometry,dam=get('INF-003')?.geometry,reservoir=get('HYD-RES-CROWN')?.geometry;
 if(river?.type!=='LineString'||dam?.type!=='Point'||reservoir?.type!=='Polygon'||
   !river.coordinates.some(p=>near(p,dam.coordinates))||!reservoir.coordinates[0].some(p=>near(p,dam.coordinates)))fail('INF-003','dam, Great River and Crown Reservoir do not meet');
 const ice=get('PHY-007');
 if(ice?.geometry?.type!=='Polygon'||ice.geometry.coordinates[0].some(p=>!pointInPolygon(p,national)))fail('PHY-007','permanent ice lies outside land');
 else {
  const points=ice.geometry.coordinates[0],centre=points.reduce((sum,p)=>[sum[0]+p[0]/points.length,sum[1]+p[1]/points.length],[0,0]);
  if(!pointInPolygon(centre,get('REG-005')?.geometry))fail('PHY-007','permanent ice is not centred in Great Range high terrain');
 }
 if(REGION_VISUALS['REG-003'].texture!=='canopy'||REGION_VISUALS['REG-009'].texture!=='arid')errors.push('Wet Emerald Coast and sparse Redlands must remain distinct');
 const countryCamera=objectCamera(get('WORLD-001'));
 if(countryCamera){
  const visible=visibleRepresentations(world.objects,countryCamera),labels=labelsFor(visible,countryCamera);
  if(visible.some(r=>r.object.type==='grid_cell'))errors.push('Normal L1 view contains a grid seam');
  if(visible.some(r=>r.object.minZoom>=3&&!['road','rail'].includes(r.object.type)))errors.push('L3/L4 object clutters L1');
  if(!labels.some(r=>r.object.properties.isCapital))errors.push('Capital label absent at L1');
  if(!visible.some(r=>r.object.id==='PHY-007')||!visible.some(r=>r.object.id==='PHY-013'))errors.push('L1 physical landmarks missing');
  for(const kind of ['road','rail'])if(!visible.some(r=>r.object.type===kind&&r.object.properties.networkKind===kind))errors.push(`National ${kind} missing at L1`);
 }
 for(const object of world.objects){
  if(['road','rail'].includes(object.type)&&object.properties?.networkKind===object.type&&object.properties?.continuity==='national'&&
    !object.representations?.some(r=>JSON.stringify(r.geometry?.coordinates)===JSON.stringify(object.geometry?.coordinates)))fail(object.id,'visual line diverges from canonical network');
  if(!object.representations)continue;
  for(const representation of object.representations){
   const bounds=geometryBounds(representation.geometry);
   if(!bounds)fail(object.id,'empty visual geometry');
   if(object.type==='grid_cell'&&representation.minZoom<=2)fail(object.id,'grid visible in normal play');
  }
 }
 return errors;
}

export function assertVisualGeography(world){const errors=validateVisualGeography(world);if(errors.length)throw new Error(errors.join('\n'));return world;}
