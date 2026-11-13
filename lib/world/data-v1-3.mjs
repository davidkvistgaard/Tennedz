import { worldV1_1 } from './data-v1-1.mjs';
import { expansionSources as source } from './expansion-sources.mjs';
import { lineCells } from './network.mjs';
import { GRID } from './grid.mjs';

const existing=new Map(worldV1_1.objects.map(o=>[o.id,structuredClone(o)]));
const added=[];
const all=()=>[...existing.values(),...added];
const byId=id=>existing.get(id)??added.find(o=>o.id===id);
const add=o=>{if(byId(o.id))throw new Error(`Duplicate world ID ${o.id}`);added.push(o);return o;};
const make=(id,name,type,parentId,minZoom,gridCells=[],properties={},extra={})=>({
  id,name,type,parentId,minZoom,maxZoom:null,gridCells,geometry:null,status:'canonical_editable',
  description:'',relations:[],properties,...extra,
});
const slug=name=>name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'');
const regions=new Map(all().filter(o=>o.type==='region').map(o=>[o.name,o]));
const names=(name,excludeCell=true)=>all().filter(o=>o.name===name&&(!excludeCell||!o.id.startsWith('CELL-')));
const attachAlias=(o,alias)=>{
  const current=o.properties.sourceAliases??[];
  if(o.id!==alias&&!current.includes(alias))o.properties.sourceAliases=[...current,alias];
};
const compatible=c=>(regions.get(c.region)?.id??null)===(byId(`GRID-${c.id}`)?.properties.regionId??null);
const candidateCells=(name,region)=>source.cells.filter(c=>c.region===region&&compatible(c)&&c.names.includes(name)).map(c=>c.id);
const cellSort=(a,b)=>Number(a.slice(1))-Number(b.slice(1))||a.charCodeAt(0)-b.charCodeAt(0);
const cellCentre=cell=>[(GRID.columns.indexOf(cell[0])+.5)*30,(Number(cell.slice(1))-.5)*30];
const approximateCell=(name,region)=>{
  const named=candidateCells(name,region);
  if(named.length)return named.sort(cellSort)[Math.floor(named.length/2)];
  const options=source.cells.filter(c=>c.region===region&&compatible(c)).map(c=>c.id).sort(cellSort);
  return options[Math.floor(options.length/2)]??null;
};
const placement=(o,reason)=>{o.properties.placementStatus='cell-only';o.properties.placementReason=reason;return o;};

// The 192 supplements must agree with the authoritative V1.1 classifications.
const sourceConflicts=[];
for(const dossier of source.cells){
  const cell=byId(`GRID-${dossier.id}`),region=regions.get(dossier.region);
  if(!cell)throw new Error(`Missing grid ${dossier.id}`);
  if(!compatible(dossier)){
    sourceConflicts.push(dossier.id);
    cell.properties.deepSourceConflict={claimedRegion:dossier.region,retainedRegionId:cell.properties.regionId};
    continue;
  }
  cell.properties.deepLandscape=dossier.landscape;
  cell.properties.deepNamedPlaces=dossier.names;
}

// National transport corridors use one continuous prototype geometry per route.
// Cell-centre waypoints represent only the named route sequence, not surveyed alignments.
const routes=[
  ['CROWN','Crownway','Crown Main Line',['G2','H3','H6','I10','J11']],
  ['EMERALD','Emerald Highway','Emerald Line',['C5','C9','I10']],
  ['EASTERN','Eastern Way','Eastern Main',['H6','N7','N10','O10']],
  ['CALDERA','Caldera Road','Ember Line',['H6','L6','N7']],
];
for(const [key,roadName,railName,cells] of routes)for(const [kind,name] of [['ROAD',roadName],['RAIL',railName]]){
  const geometry={coordinateSystem:'pelotonia-local-km',type:'LineString',coordinates:cells.map(cellCentre)};
  add(make(`V12-${kind}-${key}`,name,kind==='ROAD'?'road':'rail','WORLD-001',2,lineCells(geometry),{
    continuity:'national',geometryStatus:'prototype',namedWaypoints:cells,routeFamily:key,
  },{geometry,representations:[{geometry,style:'road',minZoom:2,maxZoom:3,label:false}]}));
}
const ferryGeometry={coordinateSystem:'pelotonia-local-km',type:'LineString',coordinates:[[435,322],[450,300],[450,342],[420,342],[435,322]]};
add(make('V13-FERRY-RING','Southeastern islands ferry ring','ferry_route','WORLD-001',2,lineCells(ferryGeometry),{
  continuity:'national',geometryStatus:'prototype',sourceVersion:'1.3',
}, {geometry:ferryGeometry,representations:[{geometry:ferryGeometry,style:'river',minZoom:2,maxZoom:3,label:false}]}));

// V1.2 repeats many labels across adjacent grid dossiers. One region-level feature
// carries those cells; original V1.1 CELL-* source records remain as source entries.
const byRegionalName=new Map();
for(const dossier of source.cells.filter(compatible))for(const name of dossier.names){
  const key=`${dossier.region}|${name}`;
  if(!byRegionalName.has(key))byRegionalName.set(key,{name,region:dossier.region,cells:[]});
  byRegionalName.get(key).cells.push(dossier.id);
}
const regionalOrdinal=new Map();
for(const {name,region,cells} of byRegionalName.values()){
  const ordinal=(regionalOrdinal.get(region)??0)+1;
  regionalOrdinal.set(region,ordinal);
  const base=names(name).find(o=>o.type!=='region'&&(o.gridCells.some(c=>cells.includes(c))||o.parentId===regions.get(region)?.id));
  if(base){base.properties.deepSourceCells=[...new Set([...(base.properties.deepSourceCells??[]),...cells])];continue;}
  const parent=regions.get(region)?.id??'WORLD-001';
  const candidates=all().filter(o=>o.name===name&&o.id.startsWith('CELL-')&&o.gridCells.some(c=>cells.includes(c)));
  const inferred=candidates.find(o=>o.type==='settlement')?.type??candidates[0]?.type??(region==='Ocean'?'marine_feature':'site_area');
  const id=`V12-${regions.get(region)?.id.replace(/^REG-/,'')??'OCEAN'}-${String(ordinal).padStart(3,'0')}`;
  const o=placement(make(id,name,inferred,parent,region==='Ocean'?4:3,[...new Set(cells)].sort(cellSort),{
    sourceVersion:'1.2',sourceEntryIds:candidates.map(x=>x.id),regionName:region,
  },{status:region==='Ocean'?'concept':'canonical_editable'}),`Named in ${cells.join(', ')}; exact location absent from source.`);
  add(o);
  for(const candidate of candidates)candidate.properties.canonicalFeatureId=id;
}

// Regional cities are canonical V1.3 objects. Their positions are constrained to
// one compatible V1.2 cell; no arbitrary point or boundary is asserted.
const settingByRegion={
  Stormlands:['exposed coast','Harbour','Moor'],
  'Northern Highlands':['upland lake valley','Lakefront','Pine Edge'],
  'Northern Plateau':['upland valley','Ridge','Heath'],
  'Emerald Coast':['wet coastal valley','Harbour','Rainwall'],
  'Rainforest Belt':['river clearing','Riverbank','Forest Edge'],
  'Great Range':['mountain pass','Pass Gate','Valley'],
  'Central Plains':['river crossing and fertile plain','Riverbank','Meadow'],
  'Volcanic Basin':['caldera-side buildable ground','Basin Edge','Steam Fields'],
  'Eastern Steppe':['water source and route junction','Crossroads','Grassland'],
  Redlands:['scarce water and canyon route','Watercourse','Mesa'],
  'Southern Fjords':['sheltered fjord harbour','Harbour','Fjord Slope'],
  'Southern Coast':['sheltered estuary or coast','Waterfront','Garden'],
  'Southeastern Islands':['sheltered island harbour','Harbour','Island Ridge'],
};
for(const city of source.cities){
  const region=regions.get(city.region),cell=approximateCell(city.name,city.region);
  if(!region||!cell)throw new Error(`No region/cell for ${city.id}`);
  const [reason,side,landscape]=settingByRegion[city.region];
  const formerCore={"RC-010":1100,"RC-018":21000,"RC-019":8000};
  const o=placement(make(city.id,city.name,'settlement',region.id,2,[cell],{
    population:{value:city.population,unit:'people',approximate:true},regionId:region.id,
    ...(formerCore[city.id]?{populationScope:'wider settlement / municipality',coreSettlementPopulation:{value:formerCore[city.id],unit:'people',approximate:true,subsetOfCurrentPopulation:true}}:{}),
    sourceVersion:'1.3',geographicReason:reason,
  }),`V1.2 ${city.region} landscape supports a ${reason}; no exact site or footprint supplied.`);
  add(o);
  for(const matched of names(city.name).filter(x=>x.id!==city.id&&x.id.startsWith('V12-'))){
    attachAlias(o,matched.id);
    o.properties.deepSourceCells=matched.gridCells;
    for(const sourceId of matched.properties.sourceEntryIds??[])byId(sourceId).properties.canonicalFeatureId=city.id;
    added.splice(added.indexOf(matched),1);
  }
  const districtNames=[`${city.name} Centre`,`${side} Quarter`,`${landscape} Quarter`];
  const anchorNames=[`${city.name} Transport Node`,`${city.name} Public Square`,`${city.name} Landscape`];
  districtNames.forEach((name,i)=>add(placement(make(`${city.id}-DIST-${String(i+1).padStart(2,'0')}`,name,'district',city.id,3,[cell],{
    sourceVersion:'1.3',detailStatus:'concept; district boundaries and names are provisional',
  },{status:'concept'}),`Regional-city template; within ${cell}, exact extent unresolved.`)));
  anchorNames.forEach((name,i)=>add(placement(make(`${city.id}-SITE-${String(i+1).padStart(2,'0')}`,name,'landmark',city.id,4,[cell],{
    sourceVersion:'1.3',detailStatus:'concept; site location and name are provisional',
  },{status:'concept'}),`Regional-city template; within ${cell}, exact site unresolved.`)));
}

// Replace the eight cities' provisional V1.1 district labels with supplied V1.2
// names while retaining their existing district IDs.
for(const [cityName,details] of Object.entries(source.major)){
  const city=names(cityName).find(o=>o.id.startsWith('CITY-'));
  if(!city)throw new Error(`Unknown major city ${cityName}`);
  const older=all().filter(o=>o.parentId===city.id&&o.type==='district').sort((a,b)=>a.id.localeCompare(b.id));
  details.districts.forEach((name,i)=>{
    const o=older[i]??add(make(`${city.id}-V12-DIST-${String(i+1).padStart(2,'0')}`,name,'district',city.id,3,city.gridCells,{sourceVersion:'1.2'}));
    o.name=name;o.status='canonical_editable';o.properties.sourceVersion='1.2';
    o.properties.placementStatus='city-only';
  });
  details.landmarks.forEach((name,i)=>{
    const match=all().find(o=>o.name===name&&o.parentId===city.id&&!o.id.startsWith('CELL-'));
    if(match)return;
    add(make(`${city.id}-V12-LMK-${String(i+1).padStart(2,'0')}`,name,'landmark',city.id,4,city.gridCells,{
      sourceVersion:'1.2',placementStatus:'city-only',
    }));
  });
}

for(const [districtId,details] of Object.entries(source.aurelia)){
  const district=byId(districtId);
  if(!district||district.name!==details.name)throw new Error(`Aurelia district conflict ${districtId}`);
  details.places.forEach((name,i)=>{
    const match=names(name).find(o=>o.parentId===districtId||o.id.startsWith('AUR-PLACE-')||o.id.startsWith('AUR-SITE-'));
    if(match){match.parentId=districtId;match.minZoom=4;return;}
    add(make(`${districtId}-V12-PLACE-${String(i+1).padStart(2,'0')}`,name,'local_area',districtId,4,district.gridCells,{
      sourceVersion:'1.2',placementStatus:'district-only',
    }));
  });
}
for(const [i,name] of source.cathedral.entries()){
  const match=names(name).find(o=>o.parentId==='AUR-LMK-001'||o.parentId==='AUR-SITE-001');
  if(match)continue;
  add(make(`AUR-V12-CATH-${String(i+1).padStart(2,'0')}`,name,'landmark','AUR-LMK-001',4,['I10','J10'],{
    sourceVersion:'1.2',placementStatus:'cathedral-precinct-only',
  }));
}

// Natural-system children are drawn from named source lists, never generated to fill
// empty cells. Existing PHY/INF/RC records are referenced instead of copied.
const naturalParents={
  'Great Range / Aurelia Massif':'REG-005','Great Caldera / Volcanic Basin':'PHY-011',
  'Red Canyon / Redlands':'PHY-013','Emerald Coast / waterfall country':'PHY-014',
  'Southern Fjords':'REG-011','Southeastern Islands':'REG-012',
};
const islandIds={'Mara Island':'V12-ISLAND-001','Tern Island':'V12-ISLAND-002','Beacon Island':'V12-ISLAND-003'};
for(const [island,id] of Object.entries(islandIds)){
  if(!names(island).length)add(make(id,island,'island','REG-012',2,[],{
    sourceVersion:'1.2',placementStatus:'archipelago-only',
  }));
}
for(const section of source.naturalSections){
  const parentId=naturalParents[section.title];let ordinal=0;
  for(const line of section.lines){
    if(line.startsWith('Pelotonia Link preferred')||line.includes(' remains signature'))continue;
    const label=line.split(':')[0].replaceAll('*','');
    const islandName=line.match(/^\*\*((?:Mara|Tern|Beacon) Island)\*\*/)?.[1];
    const list=(line.includes(':')?line.slice(line.indexOf(':')+1):line).replace('. Protected area:', ';');
    const separator=islandName?',':';';
    const entries=list.split(separator).map(n=>n.trim().replace(/\s*\([^)]*\)/g,'').replace(/\.$/,'')).filter(Boolean);
    const scopedParent=section.title==='Southeastern Islands'&&islandName
      ? islandIds[islandName]
      : section.title==='Great Range / Aurelia Massif'
        ? {'Aurelia Icefield':'PHY-007','Mount Aurelia':'PHY-001',Frostpeak:'PHY-002','White Crown':'PHY-003'}[label]??parentId
        : parentId;
    const type=/^Settlements/.test(label)?'settlement':/glacier/i.test(label)?'glacier':/islands/i.test(label)?'island':/fjords/i.test(label)?'fjord':/cones/i.test(label)?'mountain':'site_area';
    for(const name of entries){
      if(!/^[\p{L}][\p{L}.'\- ]+$/u.test(name))continue;
      ordinal++;
      if(names(name).some(o=>!o.id.startsWith('V12-')&&!o.id.startsWith('CELL-')))continue;
      if(names(name).some(o=>o.id.startsWith('V12-NAT-')))continue;
      const regionName=section.title.startsWith('Great Range')?'Great Range':section.title.startsWith('Great Caldera')?'Volcanic Basin':section.title.startsWith('Red Canyon')?'Redlands':section.title.startsWith('Emerald Coast')?'Emerald Coast':section.title;
      const cells=candidateCells(name,regionName);
      add(make(`V12-NAT-${slug(section.title)}-${String(ordinal).padStart(2,'0')}`,name,name==='Beacon City'?'settlement':type,scopedParent,3,cells,{
        sourceVersion:'1.2',placementStatus:cells.length?'cell-only':'region-only',
        ...(name==='Beacon City'?{population:{value:65000,unit:'people',approximate:true}}:{}),
      }));
    }
  }
}

const localKind=description=>description.match(/local `([^`]+)`/)?.[1]??null;
const discoveryType=description=>{
  if(/bridge|viaduct|link|dam/i.test(description))return 'fixed_connection';
  if(/lake|lagoon|tarn|marsh|wetland/i.test(description))return 'lake';
  if(/falls|cascades/i.test(description))return 'waterfall';
  if(/cliff|canyon|escarpment/i.test(description))return 'site_area';
  return 'site_area';
};
for(const item of source.discoveries){
  const region=regions.get(item.region);
  if(!region)throw new Error(`Unknown discovery region ${item.id}: ${item.region}`);
  const bare=name=>name.replace(/^The /i,'');
  const matched=all().find(o=>bare(o.name??'')===bare(item.name)&&o.id!=='WORLD-001'&&(o.id.startsWith('PHY-')||o.id.startsWith('INF-')||o.id.startsWith('V12-')||o.id.startsWith('DISC-')));
  if(matched){
    attachAlias(matched,item.id);
    matched.properties.discoveryDescription??=item.description;
    if(matched.name!==item.name)matched.properties.sourceNameVariants=[...new Set([...(matched.properties.sourceNameVariants??[]),item.name])];
    continue;
  }
  const cells=candidateCells(item.name,item.region);
  const local=Number(item.id.slice(5))>=29;
  add(make(item.id,item.name,discoveryType(item.description),region.id,local?3:2,cells,{
    sourceVersion:'1.3',discoveryDescription:item.description,localKind:localKind(item.description),
    placementStatus:cells.length?'cell-only':'region-only',
  },{status:'canonical_editable'}));
}

export const worldV1_3={
  ...worldV1_1,datasetVersion:'1.3',title:'Pelotonia World 1.3',
  issues:[...worldV1_1.issues,
    {id:'SOURCE-008',status:'resolved',description:'V1.1 controls K3 (Northern Plateau) and O3 (Ocean). Conflicting V1.2 labels are historical source errors; the stable GRID IDs and classifications remain unchanged.',objectIds:sourceConflicts.map(c=>`GRID-${c}`)},
    {id:'SOURCE-009',status:'resolved',description:'Aurel Gate ~41,000, Redgate ~61,000 and Saltwell ~37,000 are current wider settlement/municipal populations. Earlier ~1,100/~21,000/~8,000 are core-settlement subsets, never additional national population.',objectIds:['RC-010','RC-018','RC-019']},
    {id:'SOURCE-006',description:'V1.2 regional labels are reconciled with retained V1.1 CELL source entries. Exact local coordinates and urban boundaries are not supplied; named L3/L4 geometry remains null.',objectIds:['WORLD-001']},
    {id:'SOURCE-007',description:'V1.3 regional cities use terrain-compatible grid cells as provisional placement. Site-scale discovery placement requires later geographic authoring.',objectIds:source.cities.map(c=>c.id)},
  ],
  objects:[...existing.values(),...added],
};
