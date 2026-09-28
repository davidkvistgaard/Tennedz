import { worldV1 } from './data-v1.mjs';
import { macroDossiers } from './macro-dossiers.mjs';
import { lineCells } from './network.mjs';

const editable = (id,name,type,parentId,minZoom,gridCells=[],properties={},extra={}) => ({
  id,name,type,parentId,minZoom,maxZoom:null,gridCells,geometry:null,status:'canonical_editable',
  description:'',relations:[],properties,...extra,
});
const byId = new Map(worldV1.objects.map(o=>[o.id,structuredClone(o)]));
const nameToCityId = new Map(worldV1.objects.filter(o=>o.type==='settlement').map(o=>[o.name,o.id]));
const regionByName = new Map(worldV1.objects.filter(o=>o.type==='region').map(o=>[o.name,o]));
const kinds = {
  'major city':'settlement',town:'settlement',village:'settlement',peak:'mountain',
  'alpine lake':'lake','upland lake':'lake','dry lake':'lake','seasonal river':'river_system',
  river:'river_system','regional road':'road','rail corridor':'rail','ferry landing':'ferry_terminal',
  'marine feature':'marine_feature','coastal hills':'hill','natural arch':'arch',
  'hydro works':'hydro_works','geothermal plant':'geothermal_plant',
};
const typeOf = kind => kinds[kind] ?? kind.replaceAll(' ','_');
const extras = [];
const add = o => { if(byId.has(o.id)||extras.some(e=>e.id===o.id)) throw new Error(`Duplicate v1.1 ID: ${o.id}`); extras.push(o); return o; };
const sourceCells = new Map();
for (const dossier of macroDossiers) {
  const cell=byId.get(`GRID-${dossier.id}`);
  const region=regionByName.get(dossier.region);
  if (!cell || (dossier.region!=='Ocean'&&!region)) throw new Error(`Invalid dossier region ${dossier.id}`);
  cell.properties.environmentCode = region?.properties.environmentCode ?? 'O';
  cell.properties.regionId = region?.id ?? null;
  cell.properties.physicalCharacter = dossier.physical;
  const elevation=dossier.physical.match(/elevation ([0-9,]+)–([0-9,]+) m/);
  cell.properties.elevation=elevation?{min:Number(elevation[1].replaceAll(',','')),max:Number(elevation[2].replaceAll(',','')),unit:'m',approximate:true}:null;
  if(dossier.region!=='Ocean'&&!elevation) throw new Error(`Missing land elevation in ${dossier.id}`);
  cell.properties.localIdentity = dossier.region==='Ocean' ? null : {
    name:dossier.features.find(f=>['major city','town','village'].includes(f.kind))?.name ?? dossier.features[0].name,
    status:'canonical_editable',
  };
  let ordinal=0;
  for(const feature of dossier.features) {
    ordinal++;
    if(feature.kind==='major city') {
      const id=nameToCityId.get(feature.name);
      if(!id) throw new Error(`Unknown established city ${feature.name}`);
      const city=byId.get(id);
      city.gridCells=[...new Set([...city.gridCells,dossier.id])];
      city.properties.sourceCell=dossier.id;
      continue;
    }
    const id=`CELL-${dossier.id}-${String(ordinal).padStart(2,'0')}`;
    add(editable(id,feature.name,typeOf(feature.kind),cell.id,2,[dossier.id],{
      sourceCell:dossier.id,sourceKind:feature.kind,placementStatus:'cell-only',
    }));
  }
  sourceCells.set(dossier.id,dossier);
}
for(const region of regionByName.values()) {
  byId.get(region.id).gridCells=macroDossiers.filter(c=>byId.get(`GRID-${c.id}`).properties.regionId===region.id).map(c=>c.id);
}
const aliases={
  'PHY-001':['NAT-MTN-001'],'PHY-002':['NAT-MTN-002'],'PHY-003':['NAT-MTN-003'],
  'PHY-004':['NAT-MTN-004'],'PHY-005':['NAT-MTN-005'],'PHY-006':['NAT-VOL-001'],
  'PHY-007':['NAT-ICE-001'],'PHY-008':['NAT-LAK-001'],'PHY-009':['NAT-LAK-002'],
  'PHY-010':['NAT-LAK-003'],'PHY-011':['NAT-LAK-004'],'PHY-012':['NAT-GEO-001'],
  'PHY-013':['NAT-GEO-002'],'PHY-015':['NAT-WAT-001'],
  'INF-001':['INF-01'],'INF-002':['INF-02'],'INF-003':['INF-03'],
  'INF-004':['INF-04'],'INF-005':['INF-05'],
};
for(const [id,sourceAliases] of Object.entries(aliases)) byId.get(id).properties.sourceAliases=sourceAliases;
Object.assign(byId.get('PHY-003'),{description:'Multi-summit ice ridge.'});
Object.assign(byId.get('PHY-004'),{description:'Volcanic massif.'});
Object.assign(byId.get('PHY-005'),{description:'Southern fjord landmark.'});
Object.assign(byId.get('PHY-006'),{type:'volcano',description:'Active volcano.'});
Object.assign(byId.get('PHY-015'),{name:'Crownfall',status:'canonical_editable',
  properties:{...byId.get('PHY-015').properties,namePending:false,height:{value:800,unit:'m',approximate:true},sourceAliases:['NAT-WAT-001']}});
Object.assign(byId.get('INF-003'),{name:'Crown Dam',description:'Major hydroelectric dam and reservoir; alignment and site are still conceptual.'});
for(const id of ['INF-004','INF-005']) byId.get(id).status='canonical_editable';
for(const id of ['INF-001','INF-002','INF-003']) byId.get(id).status='concept';
byId.get('INF-001').minZoom=1;
byId.get('INF-003').properties.reservoir='concept';

// Reuse authored atlas-prototype river courses and make cell coverage derive from each continuous line.
const line = coordinates => ({coordinateSystem:'pelotonia-local-km',type:'LineString',coordinates});
const network = (id,name,type,coordinates,style,relations=[]) => {
  const geometry=line(coordinates),gridCells=lineCells(geometry);
  return add(editable(id,name,type,'WORLD-001',2,gridCells,{
    continuity:'national',geometryStatus:'prototype',source:'world-1.1-network-pass',
  },{geometry,relations,representations:style?[{geometry,style,minZoom:2,maxZoom:3,label:false}]:[]}));
};
const riverPaths=[
  [[170,111],[190,126],[216,138],[239,174],[261,222],[269,264],[271,282],[275,290],[277,300]],
  [[173,161],[142,164],[129,183],[105,189],[81,171],[54,166]],
  [[181,241],[161,260],[147,285],[124,305]],
  [[267,93],[295,109],[322,127],[353,165],[370,200],[396,222],[423,226]],
];
riverPaths.forEach((points,i)=>{
  const river=byId.get(`RIV-00${i+1}`),geometry=line(points);
  river.geometry=geometry;river.gridCells=lineCells(geometry);
  river.properties={...river.properties,continuity:'national',geometryStatus:'prototype',courseStatus:'prototype'};
});
network('NET-RANGE-001','Great Range backbone','mountain_system',[[150,81],[170,119],[184,170],[188,189],[210,231],[208,264],[200,292]],'ridge',
  [{kind:'part_of',targetId:'REG-005'}]);
const roads=[
  ['NET-ROAD-001','Western and southern settlement corridor',[[75,135],[195,45],[225,75],[225,165],[270,286],[285,315]],['CITY-003','CITY-007','CITY-004','CITY-002','CITY-001','CITY-008']],
  ['NET-ROAD-002','Eastern settlement corridor',[[225,165],[345,165],[405,195]],['CITY-002','CITY-009','CITY-005']],
];
for(const [id,name,points,cities] of roads) network(id,name,'road',points,'road',cities.map(targetId=>({kind:'connects',targetId})));
network('NET-RAIL-001','Western–southern rail corridor','rail',[[75,135],[225,165],[270,286],[285,315]],'road',['CITY-003','CITY-002','CITY-001','CITY-008'].map(targetId=>({kind:'connects',targetId})));
network('NET-RAIL-002','Eastern rail corridor','rail',[[225,165],[345,165],[405,195]],'road',['CITY-002','CITY-009','CITY-005'].map(targetId=>({kind:'connects',targetId})));
network('NET-FERRY-001','Southern islands ferry corridor','ferry_terminal',[[285,315],[350,330],[405,345],[435,322]],'river',
  [{kind:'connects',targetId:'CITY-008'},{kind:'connects_to',targetId:'REG-012'}]);
for(const [i,road] of roads.entries()) network(`NET-SETTLEMENT-00${i+1}`,road[1],'settlement_corridor',road[2],null,
  [{kind:'follows',targetId:road[0]}]);
// A named local road or rail line only claims a national connection if its cell
// is actually traversed by that authored national corridor.
const national=extras.filter(o=>['road','rail','ferry_terminal'].includes(o.type)&&o.properties.continuity==='national');
for(const feature of extras.filter(o=>o.properties.sourceCell)) {
  const kind=feature.properties.sourceKind;
  const group=kind==='regional road'?'road':kind==='rail corridor'?'rail':kind==='ferry landing'?'ferry_terminal':null;
  if(group) {
    const match=national.find(o=>o.type===group&&o.gridCells.includes(feature.properties.sourceCell));
    if(match) feature.relations=[{kind:'part_of',targetId:match.id}];
  }
}

const cityDistrictConcepts={
  'CITY-002':['Riverfront','Market Centre','Valley Side'],
  'CITY-003':['Deepwater Harbour','Upper Town','Western Waterfront'],
  'CITY-004':['Lakeside','River Quarter','Northern Shore'],
  'CITY-005':['Steppe Gate','Town Centre','Eastern Edge'],
  'CITY-006':['Rainforest Edge','Waterfront','Upland Side'],
  'CITY-007':['Highland Centre','Upper Terrace','Northern Approach'],
  'CITY-008':['Maritime Centre','Harbourfront','Coastal Edge'],
  'CITY-009':['Basin Centre','Geothermal Quarter','Caldera Approach'],
};
for(const [cityId,names] of Object.entries(cityDistrictConcepts)) for(const [i,name] of names.entries())
  add(editable(`${cityId}-DIST-${String(i+1).padStart(2,'0')}`,name,'district',cityId,3,byId.get(cityId).gridCells,
    {detailStatus:'proposed; local boundaries and place names are not in the source'},{status:'concept'}));
const oldAurelia=['Cathedral Hill','Founders Square','Mercer Lane','Old Market','Citadel Hill','Verdan Quays','Museum Row','St. Oran Bridge'];
for(const [i,name] of oldAurelia.entries())
  add(editable(`AUR-PLACE-${String(i+1).padStart(3,'0')}`,name,name==='St. Oran Bridge'?'fixed_connection':'local_area',
    'AUR-01',3,['I10','J10'],{source:'world-1.1-aurelia-canon'}));
const site=(id,name,parentId)=>add(editable(id,name,'landmark',parentId,4,['I10','J10'],{source:'world-1.1-aurelia-canon'}));
site('AUR-SITE-001','Cathedral building','AUR-LMK-001');
site('AUR-SITE-002','Grand Cathedral Plaza','AUR-LMK-001');
site('AUR-SITE-003','Cathedral Gardens','AUR-LMK-001');
site('AUR-SITE-009','West Towers','AUR-SITE-001');
site('AUR-SITE-010','Great Nave','AUR-SITE-001');
site('AUR-SITE-011','Central Spire','AUR-SITE-001');
site('AUR-SITE-012','North Cloister','AUR-LMK-001');
site('AUR-SITE-013','Chapter House','AUR-LMK-001');
site('AUR-SITE-014','Cathedral Library','AUR-LMK-001');
const naturalDetails=[
  ['PHY-007','Icefield margin','Glacial terrain'],['PHY-011','Caldera shore','Volcanic rim'],
  ['PHY-012','Upper escarpment','Lower escarpment'],['PHY-013','Canyon rim','Canyon floor'],
  ['PHY-015','Upper falls','Lower falls'],['REG-012','Island shore','Island interior'],
];
for(const [parentId,...names] of naturalDetails) for(const [i,name] of names.entries()) {
  const parent=byId.get(parentId);
  add(editable(`DETAIL-${parentId}-${i+1}`,name,'site_area',parentId,3,parent?.gridCells??[],
    {detailStatus:'concept; exact extent and local name need source review'},{status:'concept'}));
}

export const worldV1_1={
  ...worldV1,datasetVersion:'1.1',title:'Pelotonia World 1.1',
  issues:[...worldV1.issues,{id:'SOURCE-004',description:'The new authoritative macro dossiers revise the classifications of J10, L10, O10 and O12 while retaining their GRID IDs. World 1.0 remains unchanged as historical source.',objectIds:['GRID-J10','GRID-L10','GRID-O10','GRID-O12']},
    {id:'SOURCE-005',description:'National network geometry is a continuous local-km prototype; local dossier objects without geometry are cell-indexed only. Repeated working names denote separate source entries with separate stable IDs.',objectIds:['NET-RANGE-001','NET-ROAD-001','NET-FERRY-001']}],
  objects:[...byId.values(),...extras],
};
