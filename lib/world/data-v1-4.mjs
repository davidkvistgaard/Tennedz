import {worldV1_3} from './data-v1-3.mjs';
import {systemsSources as source} from './systems-sources.mjs';
import {macroDossiers} from './macro-dossiers.mjs';

const older=new Map(worldV1_3.objects.map(o=>[o.id,structuredClone(o)]));
const added=[];
const all=()=>[...older.values(),...added];
const get=id=>older.get(id)??added.find(o=>o.id===id)??all().find(o=>o.properties.sourceAliases?.includes(id));
const add=o=>{if(get(o.id))throw new Error(`Duplicate ID ${o.id}`);added.push(o);return o;};
const make=(id,name,type,parentId,minZoom,gridCells=[],properties={},status='canonical_editable')=>({
 id,name,type,parentId,minZoom,maxZoom:null,gridCells,geometry:null,status,description:'',relations:[],properties,
});
const regions=new Map(all().filter(o=>o.type==='region').map(o=>[o.name,o]));
const cellsFor=(name,region)=>macroDossiers.filter(c=>c.region===region&&c.features.some(f=>f.name===name)).map(c=>c.id);
const fallbackCell=region=>regions.get(region)?.gridCells?.[0]??null;
const stableAlias=(o,id)=>{if(o.id!==id&&!o.properties.sourceAliases?.includes(id))o.properties.sourceAliases=[...(o.properties.sourceAliases??[]),id];};

for(const item of source.regional){
 const city=get(item.id);
 if(!city||city.name!==item.name||get(city.parentId)?.name!==item.region)throw new Error(`Regional city mismatch ${item.id}`);
 for(const [kind,list,prefix,type,zoom] of [['districts',item.districts,'DIST','district',3],['anchors',item.anchors,'SITE','landmark',4]]){
  const oldChildren=all().filter(o=>o.parentId===city.id&&o.id.startsWith(`${city.id}-${prefix}-`)).sort((a,b)=>a.id.localeCompare(b.id));
  list.forEach((name,i)=>{
   const id=`${city.id}-${prefix}-${String(i+1).padStart(2,'0')}`;
   const child=oldChildren[i]??add(make(id,name,type,city.id,zoom,city.gridCells,{sourceVersion:'1.4',placementStatus:'city-only'}));
   child.name=name;child.status='canonical_editable';child.minZoom=zoom;
   child.properties={...child.properties,sourceVersion:'1.4',placementStatus:'city-only'};
  });
  // All previous IDs survive if a supplied city has fewer named areas than V1.3's concepts.
  for(const old of oldChildren.slice(list.length))old.status='concept';
 }
 city.properties.localDetailStatus='named districts and anchors; boundaries unresolved';
}

const townConflicts=[];
for(const item of source.towns){
 const region=regions.get(item.region);
 if(!region)throw new Error(`Town region missing ${item.id}`);
 let town=all().find(o=>o.name===item.name&&!o.id.startsWith('CELL-')&&(
  o.parentId===region.id||o.gridCells.some(c=>region.gridCells.includes(c))
));
 if(!town){
  const cell=cellsFor(item.name,item.region)[0]??fallbackCell(item.region);
  town=add(make(item.id,item.name,'settlement',region.id,2,cell?[cell]:[],{
   sourceVersion:'1.4',placementStatus:'cell-only',geographicReason:'Named in the regional physical dossier; exact footprint unresolved',
  }));
 } else {
  stableAlias(town,item.id);
  town.minZoom=Math.min(town.minZoom,2);
  town.type='settlement';town.parentId=region.id;
  townConflicts.push({sourceId:item.id,canonicalId:town.id});
 }
 for(const duplicate of all().filter(o=>o!==town&&o.name===item.name&&o.id.startsWith('V12-NAT-'))){
  duplicate.status='concept';duplicate.properties.canonicalFeatureId=town.id;
 }
 const localCell=town.gridCells[0]??fallbackCell(item.region);
 const contextName=item.places.find(n=>/View|Park|Pier|Ferry|Station|Harbour|Garden|Roadhouse|Point/i.test(n))??item.places.at(-1);
 item.places.forEach((name,i)=>add(make(`${item.id}-AREA-${String(i+1).padStart(2,'0')}`,name,'local_area',town.id,3,localCell?[localCell]:[],{
  sourceVersion:'1.4',placementStatus:'town-only',
 })));
 add(make(`${item.id}-SITE-01`,`${item.name} ${contextName}`,'landmark',town.id,4,localCell?[localCell]:[],{
  sourceVersion:'1.4',placementStatus:'town-only',detailStatus:'concept; exact site and name unresolved',
 },'concept'));
}

// V1.4 reuses DISC numbers for different places. Resolve by supplied place name;
// never point a conflicting source number at a different established object.
const discoveryCollisions=[];
const resolvedSignatures=[];
for(const item of source.signature){
 const numbered=get(item.sourceId);
 const parent=numbered?.name===item.name?numbered:all().find(o=>o.name===item.name&&!o.id.startsWith('CELL-'));
 if(!parent)throw new Error(`Signature parent missing: ${item.sourceId} ${item.name}`);
 if(numbered?.id!==parent.id)discoveryCollisions.push({sourceId:item.sourceId,sourceName:item.name,earlierId:numbered?.id,earlierName:numbered?.name,canonicalId:parent.id});
 resolvedSignatures.push({sourceId:item.sourceId,canonicalId:parent.id});
 item.children.forEach((name,i)=>{
  const existing=all().find(o=>o.name===name&&o.parentId===parent.id);
  if(existing){existing.minZoom=4;existing.properties.sourceVersion='1.4';return;}
  add(make(`V14-SITE-${item.sourceId}-${String(i+1).padStart(2,'0')}`,name,'site_area',parent.id,4,parent.gridCells,{
   sourceVersion:'1.4',placementStatus:parent.gridCells.length?'parent-cells-only':'parent-region-only',
  }));
 });
}

for(const item of source.engineering){
 const parent=get(item.sourceId);
 if(!parent||parent.name!==item.name)throw new Error(`Infrastructure ID/name conflict ${item.sourceId}`);
 item.children.forEach((name,i)=>{
  const existing=all().find(o=>o.name===name&&o.parentId===parent.id);
  if(existing)return;
  add(make(`${parent.id}-V14-${String(i+1).padStart(2,'0')}`,name,'site_area',parent.id,i<2?3:4,parent.gridCells,{
   sourceVersion:'1.4',placementStatus:'parent-only',
  },parent.status==='concept'?'concept':'canonical_editable'));
 });
}

// Complete every cell from existing named source entries rather than cloning
// generic parks/viewpoints. These are L3 selections of already-stable CELL IDs.
const coverage={};
for(const dossier of macroDossiers){
 const cell=get(`GRID-${dossier.id}`);
 const entries=all().filter(o=>o.parentId===cell.id&&o.id.startsWith('CELL-'));
 const other=all().filter(o=>o.gridCells.includes(dossier.id)&&!o.id.startsWith('CELL-')&&o.type==='settlement');
 const major=other.some(o=>o.id.startsWith('CITY-'));
 const regional=other.some(o=>o.id.startsWith('RC-'));
 const town=other.some(o=>o.properties.sourceAliases?.some(a=>a.startsWith('TOWN-'))||o.id.startsWith('TOWN-'));
 const rural=entries.some(o=>o.type==='settlement');
 const category=dossier.region==='Ocean'?'ocean':major?'major-city':regional?'regional-city':town?'town':rural?'populated-rural':'wilderness';
 const limit={ocean:0,'major-city':8,'regional-city':6,town:5,'populated-rural':4,wilderness:3}[category];
 const selected=(category==='wilderness'?entries.filter(o=>o.type!=='settlement'):entries).slice(0,limit);
 selected.forEach(o=>{o.minZoom=3;o.properties.localDetailRole='named local geography';});
 const namedChildren=all().filter(o=>o.gridCells.includes(dossier.id)&&o.minZoom>=3&&!o.id.startsWith('CELL-'));
 const ids=[...new Set([...selected.map(o=>o.id),...namedChildren.map(o=>o.id)])];
 cell.properties.localDetail={version:'1.4',category,objectIds:ids,sourceOnly:ids.length===0};
 coverage[dossier.id]={category,count:ids.length};
}

export const worldV1_4={...worldV1_3,datasetVersion:'1.4',title:'Pelotonia World 1.4',
 issues:[...worldV1_3.issues,
  {id:'SOURCE-010',description:'V1.4 reuses 18 DISC identifiers for names that differ from V1.3. The established IDs retain their earlier meanings; V1.4 L4 details attach by the supplied names instead.',objectIds:[...new Set(discoveryCollisions.map(x=>x.canonicalId))]},
  {id:'SOURCE-011',description:'TOWN identifiers for previously named settlements resolve as source aliases to their existing stable IDs.',objectIds:[...new Set(townConflicts.map(x=>x.canonicalId))]},
 ],objects:all()};
export const worldV1_4Reconciliation={discoveryCollisions,townConflicts,resolvedSignatures,coverage};
