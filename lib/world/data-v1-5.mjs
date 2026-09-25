import {worldV1_4,worldV1_4Reconciliation} from './data-v1-4.mjs';
import {systemsSources as source} from './systems-sources.mjs';
import {cellPoint,routeCells} from './route-grid.mjs';
import {lineCells} from './network.mjs';

const prior=new Map(worldV1_4.objects.map(o=>[o.id,structuredClone(o)]));
const added=[];
const all=()=>[...prior.values(),...added];
const get=id=>prior.get(id)??added.find(o=>o.id===id)??all().find(o=>o.properties.sourceAliases?.includes(id));
const add=o=>{if(get(o.id))throw new Error(`Duplicate world ID ${o.id}`);added.push(o);return o;};
const make=(id,name,type,parentId,minZoom,gridCells=[],properties={},extra={})=>({
 id,name,type,parentId,minZoom,maxZoom:null,gridCells,geometry:null,status:'canonical_editable',
 description:'',relations:[],properties,...extra,
});
const alias=(o,id)=>{if(o.id!==id&&!o.properties.sourceAliases?.includes(id))o.properties.sourceAliases=[...(o.properties.sourceAliases??[]),id];};
const point=(x,y)=>({coordinateSystem:'pelotonia-local-km',type:'Point',coordinates:[x,y]});
const line=coordinates=>({coordinateSystem:'pelotonia-local-km',type:'LineString',coordinates});
const represent=(geometry,style,minZoom=2,maxZoom=4,label=false)=>({geometry,style,minZoom,maxZoom,label});
const regionCell=(name)=>get(`GRID-${name}`)?.properties.regionId;
const land=id=>regionCell(id)!==null;
const named=(name)=>all().filter(o=>o.name===name&&!o.id.startsWith('CELL-'));
const namedSettlement=name=>named(name).find(o=>o.type==='settlement'&&(o.id.startsWith('CITY-')||o.id.startsWith('RC-')||o.id.startsWith('TOWN-')||o.properties.sourceAliases?.some(a=>a.startsWith('TOWN-'))))??named(name).find(o=>o.type==='settlement');
const sourceById=new Map(source.network.map(n=>[n.id,n]));

// Earlier prototype cells put separate island cities in one cell and the Aurel
// Gate pass city north of the named southern crossing. The new route system needs
// distinct schematic cells, not invented point addresses.
const revisions=[['RC-010','F10'],['RC-023','N11'],['RC-024','O11'],['TOWN-023','P11'],['TOWN-018','O9'],['RC-019','M9']];
for(const [id,cell] of revisions){
 const o=get(id);if(!o||!land(cell))throw new Error(`Invalid placement revision ${id}`);
 const before=o.gridCells;o.gridCells=[cell];
 o.properties.placementRevision={sourceVersion:'1.5',previousCells:before,reason:'Schematic network topology; exact location remains open'};
 for(const child of all().filter(x=>x.parentId===o.id&&x.gridCells.length===1&&before.includes(x.gridCells[0])))child.gridCells=[cell];
}

const endpoint=(name)=>{
 const o=namedSettlement(name)??named(name).find(x=>x.gridCells.length);
 if(!o||!o.gridCells.length)throw new Error(`Route waypoint missing: ${name}`);
 return o;
};
// A named junction and mainland ferry/road terminal are supplied by the source.
const existingCrownJunction=all().find(o=>o.parentId==='AUR-14'&&o.name==='Crown Junction');
if(!existingCrownJunction)throw new Error('Established Crown Junction is missing');
const crownJunction=add(make('V15-JUNC-CROWN','Crown Junction','local_area','AUR-14',3,['J10'],{
 sourceVersion:'1.5',placementStatus:'cell-only',geometryStatus:'prototype',canonicalFeatureId:existingCrownJunction.id,
},{status:'concept',relations:[{kind:'alias_of',targetId:existingCrownJunction.id}]}));
const seTerminal=add(make('V15-PORT-SE-MAINLAND','Southeastern mainland terminal','port','REG-009',2,['O10'],{
 sourceVersion:'1.5',placementStatus:'cell-only',geometryStatus:'prototype',
}));
const special={'Crown Junction':crownJunction,'Southeastern mainland terminal':seTerminal};
const waypoint=name=>special[name]??endpoint(name);
const waypointCell=name=>waypoint(name).gridCells[0];

const roadDefinitions=[
 ['ROAD-N01','V12-ROAD-CROWN',['Northwatch','Pinemere','Rivermere','Willowford','Valedor','Crown Junction','Aurelia','Southport']],
 ['ROAD-N02','V12-ROAD-EMERALD',['Westhaven','Mistbay','Fernhaven','Greenfall','Aurel Gate','Aurelia']],
 ['ROAD-N03','V12-ROAD-EASTERN',['Valedor','Sagecross','Kaen','Redgate','Southeastern mainland terminal']],
 ['ROAD-N04','V12-ROAD-CALDERA',['Valedor','Blackstone','Steamvale','Ember','Kaen']],
 ['ROAD-N05',null,['Northwatch','Frostvale','Stoneheath','Windmere','Rivermere']],
 ['ROAD-N06',null,['Greenfall','Greyhaven','Deepwater','Southport']],
 ['ROAD-N07',null,['Kaen','Redgate','Saltwell','Mesa Crossing','Dusthaven','Southeastern mainland terminal']],
];
const railDefinitions=[
 ['RAIL-N01','V12-RAIL-CROWN',['Northwatch','Rivermere','Valedor','Aurelia','Southport']],
 ['RAIL-N02','V12-RAIL-EMERALD',['Westhaven','Mistbay','Greenfall','Aurel Gate','Aurelia']],
 ['RAIL-N03','V12-RAIL-EASTERN',['Valedor','Sagecross','Kaen','Southeastern mainland terminal']],
 ['RAIL-N04','V12-RAIL-CALDERA',['Valedor','Blackstone','Ember']],
 ['RAIL-N05',null,['Rivermere','Stoneheath','Windmere','Northwatch']],
];

const routeSegments=(parent,code,places,{water=false,skipLegs=[]}={})=>{
 const segmentIds=[],coordinates=[],legs=[];
 for(let i=1;i<places.length;i++){
  if(skipLegs.includes(i-1))continue;
  const a=waypoint(places[i-1]),b=waypoint(places[i]);
  const cells=routeCells({objects:all()},[a.gridCells[0],b.gridCells[0]],{water});
  const coords=cells.map(cellPoint);
  if(coords.length<2)coords.push([coords[0][0]+1,coords[0][1]]);
  const geometry=line(coords),id=`${code}-SEG-${String(i).padStart(2,'0')}`;
  add(make(id,`${places[i-1]}–${places[i]}`,parent.type,parent.id,3,lineCells(geometry),{
   networkParentId:parent.id,sourceVersion:'1.5',geometryStatus:'prototype',
   fromId:a.id,toId:b.id,fromPoint:coords[0],toPoint:coords.at(-1),
  },{geometry,relations:[{kind:'connects',targetId:a.id},{kind:'connects',targetId:b.id}],representations:[represent(geometry,water?'river':'road',3,4)]}));
  segmentIds.push(id);legs.push({fromId:a.id,toId:b.id,id});
  if(!coordinates.length)coordinates.push(...coords);else if(JSON.stringify(coordinates.at(-1))===JSON.stringify(coords[0]))coordinates.push(...coords.slice(1));
  else coordinates.push(...coords);
 }
 parent.properties={...parent.properties,sourceVersion:'1.5',networkKind:parent.type,waypointIds:places.map(n=>waypoint(n).id),segmentIds,
  geometryStatus:'prototype',continuity:skipLegs.length?'multimodal':'national',transferRouteIds:skipLegs.length?['FERRY-N02']:[],
 };
 parent.relations=places.map(name=>({kind:'connects',targetId:waypoint(name).id}));
 parent.gridCells=[...new Set(legs.flatMap(l=>get(l.id).gridCells))];
 if(!skipLegs.length){
  const geometry=line(coordinates);parent.geometry=geometry;parent.gridCells=lineCells(geometry);
  parent.representations=[represent(geometry,parent.type==='ferry_route'?'river':'road',2,3)];
 } else {
  const paths=[];for(const leg of legs){const coords=get(leg.id).geometry.coordinates;
   if(!paths.length||JSON.stringify(paths.at(-1).at(-1))!==JSON.stringify(coords[0]))paths.push([...coords]);
   else paths.at(-1).push(...coords.slice(1));}
  const geometry={coordinateSystem:'pelotonia-local-km',type:'MultiLineString',coordinates:paths};
  parent.geometry=geometry;parent.representations=[represent(geometry,'road',2,3)];
 }
 return parent;
};

for(const [id,oldId,places] of [...roadDefinitions,...railDefinitions]){
 const sourceRecord=sourceById.get(id),type=id.startsWith('ROAD')?'road':'rail';
 if(!sourceRecord)throw new Error(`Missing source ${id}`);
 const parent=oldId?get(oldId):add(make(id,sourceRecord.name,type,'WORLD-001',2));
 parent.name=sourceRecord.name;alias(parent,id);
 routeSegments(parent,id,places,{skipLegs:id==='ROAD-N06'?[1]:[]});
}
// N08 consists of separate island roads linked by ferries, not a road over sea.
const islandRoad=add(make('ROAD-N08',sourceById.get('ROAD-N08').name,'road','REG-012',2,['N11','O11','P11'],{
 sourceVersion:'1.5',networkKind:'road_collection',continuity:'collection',componentIds:[],geometryStatus:'unresolved',
}));
for(const [i,city] of ['Maravista','Ternport','Beacon City'].entries()){
 const centre=cellPoint(waypointCell(city)),geometry=line([[centre[0]-2,centre[1]],[centre[0]+2,centre[1]]]);
 const id=`ROAD-N08-ISLAND-0${i+1}`;
 add(make(id,`${city} island road`,'road',islandRoad.id,3,lineCells(geometry),{
  networkParentId:islandRoad.id,sourceVersion:'1.5',geometryStatus:'prototype',fromId:waypoint(city).id,toId:waypoint(city).id,
 },{geometry,relations:[{kind:'serves',targetId:waypoint(city).id}],representations:[represent(geometry,'road',3,4)]}));
 islandRoad.properties.componentIds.push(id);
}
const metro=add(make('RAIL-N06',sourceById.get('RAIL-N06').name,'rail','CITY-001',3,['I10','J10'],{
 sourceVersion:'1.5',networkKind:'urban_collection',continuity:'collection',geometryStatus:'unresolved',
 stationIds:['AUR-LMK-003','INF-004'],
}));
metro.relations=metro.properties.stationIds.map(targetId=>({kind:'serves',targetId}));

// Hydrology: retain the four RIV IDs. The new Verdan parent is additional;
// Southern Short Rivers is a collection, never falsely joined as one watercourse.
const hydroDefinitions=[
 ['HYD-R01',null,'Verdan River System',[[190,45],[207,79],[225,75],[280,70],[350,65],[440,75]],['Rivermere Reach','Lower Verdan','Verdan Estuary']],
 ['HYD-R02','RIV-001','Great River System',null,['Upper Great River','Valedor Reach','Crown Island Channels','Lower Great River','Aurelia Reach','Great River Estuary']],
 ['HYD-R03','RIV-002','Emerald River System',null,['Greenfall Reach','Emerald Estuary']],
 ['HYD-R04','RIV-004','Kaen–Red River System',null,['Upper Red River','Red Canyon Reach','Lower Red']],
];
const tributaries={
 'HYD-R01':[['HYD-R01-A','Frost River',[175,70],[207,79]],['HYD-R01-B','Pine River',[192,50],[207,79]]],
 'HYD-R02':[['HYD-R02-A','Aurel River',[181,190],[239,174]],['HYD-R02-B','Crown River',[150,110],[190,126]],['HYD-R02-C','Greywall River',[185,240],[261,222]]],
 'HYD-R03':[['HYD-R03-TRIB-01','Cloud River',[125,130],[142,164]],['HYD-R03-TRIB-02','Crownfall River',[90,150],[105,189]],['HYD-R03-TRIB-03','Moss River',[130,220],[105,189]]],
 'HYD-R04':[['HYD-R04-TRIB-01','Ember Creek',[310,175],[322,127]],['HYD-R04-TRIB-02','Kaen River',[360,150],[353,165]],['HYD-R04-TRIB-03','Sage River',[340,190],[370,200]]],
};
for(const [id,oldId,name,coordinates,children] of hydroDefinitions){
 const parent=oldId?get(oldId):add(make(id,name,'river_system','WORLD-001',2));
 parent.name=name;alias(parent,id);
 if(coordinates){parent.geometry=line(coordinates);parent.gridCells=lineCells(parent.geometry);}
 parent.properties={...parent.properties,sourceVersion:'1.5',networkKind:'watershed',continuity:'national',geometryStatus:'prototype',
  sourceKind:'headwaters',terminalKind:'ocean-mouth',segmentIds:[],tributaryIds:[],
 };
 parent.representations=[represent(parent.geometry,'river',2,4)];
 const coords=parent.geometry.coordinates;
 // Named children are nested on the continuous main stem. Tributary names are
 // provisional line portions until their branch geometry can be authored.
 for(const [i,childName] of children.entries()){
  const start=(coords.length-1)*i/children.length,end=(coords.length-1)*(i+1)/children.length;
  const sample=t=>{const n=Math.min(Math.floor(t),coords.length-2),f=t-n;return [coords[n][0]+(coords[n+1][0]-coords[n][0])*f,coords[n][1]+(coords[n+1][1]-coords[n][1])*f];};
  const geometry=line([sample(start),sample(end)]),childId=`${id}-SEG-${String(i+1).padStart(2,'0')}`;
  add(make(childId,childName,'river_system',parent.id,3,lineCells(geometry),{
   sourceVersion:'1.5',networkParentId:parent.id,geometryStatus:'prototype',fromPoint:geometry.coordinates[0],toPoint:geometry.coordinates[1],
  },{geometry,representations:[represent(geometry,'river',3,4)]}));
  parent.properties.segmentIds.push(childId);
 }
 for(const [tributaryId,tributaryName,sourcePoint,confluence] of tributaries[id]){
  const geometry=line([sourcePoint,confluence]);
  add(make(tributaryId,tributaryName,'river_system',parent.id,3,lineCells(geometry),{
   sourceVersion:'1.5',networkParentId:parent.id,role:'tributary',sourceKind:'headwaters',
   confluencePoint:confluence,geometryStatus:'prototype',
  },{geometry,representations:[represent(geometry,'river',3,4)]}));
  parent.properties.tributaryIds.push(tributaryId);
 }
}
const southern=add(make('HYD-R05','Southern Short Rivers','river_system','WORLD-001',2,[],{
 sourceVersion:'1.5',networkKind:'watershed_collection',continuity:'collection',componentIds:[],geometryStatus:'unresolved',
}));
const southernNames=['Garden River','Cedar River','Southport River','Greyfjord River','Deepwater River','Tern River'];
for(const [i,name] of southernNames.entries()){
 const id=i===3?'RIV-003':`HYD-R05-${String(i+1).padStart(2,'0')}`;
 const start=['I10','J10','J10','E9','C9','D10'][i],end=['I12','J12','J12','C11','B11','D12'][i];
 const geometry=i===3?get(id).geometry:line([cellPoint(start),cellPoint(end)]);
 const river=i===3?get(id):add(make(id,name,'river_system',southern.id,3,lineCells(geometry),{
  sourceVersion:'1.5',networkParentId:southern.id,sourceKind:'headwaters',terminalKind:'coast',geometryStatus:'prototype',
 },{geometry,representations:[represent(geometry,'river',3,4)]}));
 river.name=name;river.parentId=southern.id;river.properties={...river.properties,networkParentId:southern.id,sourceKind:'headwaters',terminalKind:'coast',geometryStatus:'prototype'};
 southern.properties.componentIds.push(id);
}

// Major basin semantics are explicit even where the precise outlet is not.
const basins=[
 ['PHY-008','open',['HYD-R01-A','HYD-R01-B'],'HYD-R01'],
 ['PHY-009','open',[],'HYD-R02-A'],
 ['PHY-010','seasonal',[],'HYD-R04'],
 ['PHY-011','limited-outlet',[],'HYD-R04'],
];
for(const [id,status,inflowIds,outflowId] of basins){const lake=get(id);
 lake.properties={...lake.properties,basinStatus:status,inflowIds,outflowId,sourceVersion:'1.5'};
 lake.relations=[...lake.relations,{kind:'drains_to',targetId:get(outflowId).id}];
}
for(const name of ['Mirror Tarn','Salt Mirror'])for(const lake of named(name))if(['lake','site_area','salt_flat'].includes(lake.type))lake.properties={...lake.properties,basinStatus:'closed',inflowIds:[],outflowId:null};
const reservoir=add(make('HYD-RES-CROWN','Crown Reservoir','lake','INF-003',3,['I7'],{
 sourceVersion:'1.5',basinStatus:'artificial',inflowIds:['RIV-001'],outflowId:'RIV-001',placementStatus:'cell-only',
}));
// Older named outline records remain addressable but identify these same
// physical features; the later natural/engineered representation is canonical.
for(const [outlineId,featureId] of [
 ['V12-NAT-GREAT-RANGE-AURELIA-MASSIF-24','V12-005-002'],
 ['INF-003-V14-04',reservoir.id],
]){
 const outline=get(outlineId),feature=get(featureId);
 if(!outline||!feature||outline.name!==feature.name)throw new Error(`World identity mismatch ${outlineId}`);
 outline.status='concept';
 outline.properties.canonicalFeatureId=feature.id;
 if(!outline.relations.some(r=>r.kind==='alias_of'&&r.targetId===feature.id))outline.relations.push({kind:'alias_of',targetId:feature.id});
}
const dam=get('INF-003');dam.geometry=point(261,222);dam.gridCells=['I8'];
dam.properties={...dam.properties,sourceVersion:'1.5',geometryStatus:'prototype',riverId:'RIV-001',reservoirId:reservoir.id};
dam.relations=[...dam.relations,{kind:'controls',targetId:'RIV-001'},{kind:'creates',targetId:reservoir.id}];

const ferryDefinitions=[
 ['FERRY-N01','V13-FERRY-RING',['Southeastern mainland terminal','Maravista','Ternport','Beacon City','Southeastern mainland terminal']],
 ['FERRY-N02',null,['Greenfall','Greyhaven','Ternvik','Deepwater','Sealholm']],
 ['FERRY-N03',null,['Aurelia','Southport']],
 ['FERRY-N04',null,['Greywatch','Ternwick']],
];
for(const [id,oldId,places] of ferryDefinitions){
 const parent=oldId?get(oldId):add(make(id,sourceById.get(id).name,'ferry_route','WORLD-001',2));
 parent.type='ferry_route';parent.name=sourceById.get(id).name;alias(parent,id);
 const terminalIds=[];
 for(const [i,name] of places.entries()){
  if(i===places.length-1&&name===places[0]){terminalIds.push(terminalIds[0]);continue;}
  const cell=waypointCell(name),geometry=point(...cellPoint(cell)),termId=`${id}-TERM-${String(i+1).padStart(2,'0')}`;
  add(make(termId,`${name} ferry terminal`,'ferry_terminal',parent.id,3,[cell],{
   sourceVersion:'1.5',servesId:waypoint(name).id,geometryStatus:'prototype',
  },{geometry,relations:[{kind:'serves',targetId:waypoint(name).id}]}));
  terminalIds.push(termId);
 }
 const coords=places.map(name=>cellPoint(waypointCell(name))),geometry=line(coords);
 parent.geometry=geometry;parent.gridCells=lineCells(geometry);
 parent.properties={...parent.properties,sourceVersion:'1.5',networkKind:'ferry_route',continuity:'national',geometryStatus:'prototype',
  terminalIds,segmentIds:[],waypointIds:places.map(name=>waypoint(name).id),
 };
 parent.representations=[represent(geometry,'river',2,3)];
 parent.relations=[...new Set(places.map(name=>waypoint(name).id))].map(targetId=>({kind:'connects',targetId}));
 for(let i=1;i<coords.length;i++){
  const segmentGeometry=line([coords[i-1],coords[i]]),segmentId=`${id}-SEG-${String(i).padStart(2,'0')}`;
  add(make(segmentId,`${places[i-1]}–${places[i]}`,'ferry_route',parent.id,3,lineCells(segmentGeometry),{
   sourceVersion:'1.5',networkParentId:parent.id,terminalFromId:terminalIds[i-1],terminalToId:terminalIds[i],
   fromPoint:coords[i-1],toPoint:coords[i],geometryStatus:'prototype',
  },{geometry:segmentGeometry,representations:[represent(segmentGeometry,'river',3,4)]}));
  parent.properties.segmentIds.push(segmentId);
 }
}

const airportCities={
 'AIR-001':'Aurelia','AIR-002':'Westhaven','AIR-003':'Valedor','AIR-004':'Kaen',
 'AIR-005':'Northwatch','AIR-006':'Maravista','AIR-007':'Greenfall','AIR-008':'Southport',
};
for(const [id,cityName] of Object.entries(airportCities)){
 const city=waypoint(cityName),record=sourceById.get(id);
 const airport=id==='AIR-001'?get('INF-004'):add(make(id,record.name,'airport',city.id,3,city.gridCells,{
  sourceVersion:'1.5',placementStatus:'city-only',role:record.body,
 }));
 airport.name=record.name;alias(airport,id);
 if(id==='AIR-001')airport.gridCells=[...city.gridCells];
 airport.properties={...airport.properties,role:record.body,sourceVersion:'1.5'};
 if(id!=='AIR-001')airport.relations=[{kind:'serves',targetId:city.id}];
}

// Additional nationally important utilities keep their source geography and
// project status. Their exact footprints remain unresolved.
const utilitySpecs=[
 ['Emerald Hydro Cascade','hydro_works','REG-003',['C5']],
 ['Ember Geothermal Field','geothermal_field','REG-007',['L6']],
 ['Kaen Wind Park','site_area','CITY-005',['N7']],
 ['Saltwell Solar Field','site_area','RC-019',get('RC-019').gridCells],
 ['Aurelia Water System','hydro_works','CITY-001',['I10','J10']],
 ['Island Water System','hydro_works','REG-012',['N11','O11','P11']],
];
for(const [i,[name,type,parentId,cells]] of utilitySpecs.entries()){
 const existing=named(name).find(o=>!o.id.startsWith('CELL-'));
 const o=existing??add(make(`V15-UTILITY-${String(i+1).padStart(2,'0')}`,name,type,parentId,3,cells,{
  sourceVersion:'1.5',placementStatus:'region-or-city-only',
 }));
 o.properties={...o.properties,utilityRole:name,sourceVersion:'1.5'};
}

const demographicBelts=[
 ['Primary demographic belt','ROAD-N01'],['Western coastal belt','ROAD-N02'],
 ['Eastern belt','ROAD-N03'],['Volcanic belt','ROAD-N04'],
 ['Island belt','FERRY-N01'],['Fjord settlements','ROAD-N06'],
];
for(const [i,[name,routeId]] of demographicBelts.entries()){
 const route=get(routeId),maritime=i>=4;
 const densityByCell=Object.fromEntries(route.gridCells.map(cell=>{
  const code=get(`GRID-${cell}`).properties.environmentCode;
  return [cell,maritime||['O','M','D','R','F'].includes(code)?'sparse':'settled'];
 }));
 add(make(`V15-POP-${String(i+1).padStart(2,'0')}`,name,'settlement_corridor','WORLD-001',2,
  maritime?[]:route.gridCells,{
   sourceVersion:'1.5',densityByCell,routeId,continuity:maritime?'settlement-collection':'population-pattern',
  },{geometry:maritime?null:structuredClone(route.geometry),relations:[{kind:'follows',targetId:route.id}]}));
}

const structureSpecs=[
 ['St. Oran Bridge','ROAD-N01','Aurelia'],['Crown Island Bridge','ROAD-N01','Valedor'],
 ['Willowford Bridge','ROAD-N01','Willowford'],['Fern Bridge','ROAD-N02','Fernhaven'],
 ['Rainwall Viaduct','ROAD-N02','Mistbay'],['Canyon Bridge','ROAD-N07','Mesa Crossing'],
 ['Lake Bridge','ROAD-N01','Rivermere'],['Greybridge','ROAD-N01','Aurelia'],
 ['Three Bridges','ROAD-N01','Aurelia'],['Cloudgate Tunnel','ROAD-N02','Aurel Gate'],
 ['Deepwater Tunnel','ROAD-N06','Deepwater'],['Crown Pass tunnels','ROAD-N02','Aurel Gate'],
];
for(const [i,[name,routeId,near]] of structureSpecs.entries()){
 const route=get(routeId),nearPoint=cellPoint(waypointCell(near));
 const routePoints=route.geometry.type==='MultiLineString'?route.geometry.coordinates.flat():route.geometry.coordinates;
 const coordinate=routePoints.reduce((best,p)=>
  Math.hypot(p[0]-nearPoint[0],p[1]-nearPoint[1])<Math.hypot(best[0]-nearPoint[0],best[1]-nearPoint[1])?p:best,routePoints[0]);
 const matched=named(name).find(o=>!o.id.startsWith('CELL-'));
 const o=matched??add(make(`V15-STRUCT-${String(i+1).padStart(2,'0')}`,name,/Tunnel|tunnels/.test(name)?'tunnel':'fixed_connection',route.id,3,route.gridCells,{
  sourceVersion:'1.5',geometryStatus:'prototype',
 }));
 o.geometry=point(...coordinate);o.gridCells=lineCells(line([coordinate,[coordinate[0]+.01,coordinate[1]]]));
 o.properties={...o.properties,carriedByRouteId:route.id,sourceVersion:'1.5',geometryStatus:'prototype',placementStatus:'route-prototype'};
 if(!o.relations.some(r=>r.targetId===route.id))o.relations.push({kind:'carried_by',targetId:route.id});
}

// Re-index every cell after revised prototype locations and new infrastructure.
for(const cell of all().filter(o=>o.type==='grid_cell')){
 const id=cell.name;
 const previous=cell.properties.localDetail;
 if(!previous)continue;
 const retained=previous.objectIds.filter(objectId=>get(objectId)?.gridCells.includes(id));
 const local=all().filter(o=>o.gridCells.includes(id)&&o.minZoom>=3&&(
  o.type==='airport'||o.type==='ferry_terminal'||o.type==='district'||o.type==='landmark'||o.type==='local_area'
 )).map(o=>o.id);
 const objectIds=[...new Set([...retained,...local])];
 const settlement=all().filter(o=>o.type==='settlement'&&o.gridCells.includes(id));
 const category=cell.properties.regionId===null?'ocean':settlement.some(o=>o.id.startsWith('CITY-'))?'major-city':settlement.some(o=>o.id.startsWith('RC-'))?'regional-city':settlement.length?'town-or-rural':previous.category;
 cell.properties.localDetail={...previous,version:'1.5',category,objectIds,sourceOnly:objectIds.length===0};
}

export const worldV1_5={...worldV1_4,datasetVersion:'1.5',title:'Pelotonia World 1.5',
 issues:[...worldV1_4.issues,
  {id:'SOURCE-012',description:'V1.5 moves several provisional V1.3 regional-city cells so the named pass and three principal island settlements can form distinct continuous network nodes; exact sites remain unresolved.',objectIds:revisions.map(([id])=>id)},
  {id:'SOURCE-013',description:'National network lines, segment geometry, bridge attachments and ferry terminals are continuous local-km prototypes, not surveyed alignments. Fjord Road remains a multimodal road/ferry corridor.',objectIds:['ROAD-N06','FERRY-N02','HYD-R01']},
 ],objects:all()};
export const worldV1_5Reconciliation={...worldV1_4Reconciliation,placementRevisions:revisions};
