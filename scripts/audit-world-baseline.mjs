import assert from 'node:assert/strict';
import {worldV1} from '../lib/world/data-v1.mjs';
import {worldV1_3} from '../lib/world/data-v1-3.mjs';
import {worldV1_4,worldV1_4Reconciliation} from '../lib/world/data-v1-4.mjs';
import {worldV1_5} from '../lib/world/data-v1-5.mjs';
import {atlasWorld} from '../lib/world/atlas-data.mjs';
import {correctedDiscoverySources} from '../lib/world/source-corrections.mjs';
import {validateWorld} from '../lib/world/validate.mjs';
import {validateVisualGeography} from '../lib/world/visual-validate.mjs';

export function auditWorldBaseline(){
 const versions=[worldV1,worldV1_3,worldV1_4,worldV1_5,atlasWorld];
 for(const version of versions)assert.deepEqual(validateWorld(version),[],`${version.title}: world validation`);
 assert.deepEqual(validateVisualGeography(atlasWorld),[],'visual geography');
 const current=new Map(worldV1_5.objects.map(o=>[o.id,o]));
 const atlas=new Map(atlasWorld.objects.map(o=>[o.id,o]));
 assert.equal(current.size,worldV1_5.objects.length,'duplicate stable IDs');
 assert.equal(atlas.size,atlasWorld.objects.length,'duplicate atlas IDs');
 for(const version of versions.slice(0,-1))for(const object of version.objects){
  assert.equal(current.get(object.id)?.id,object.id,`lost stable ID ${object.id}`);
  assert.equal(atlas.get(object.id)?.id,object.id,`lost atlas ID ${object.id}`);
 }
 const aliases=new Map();
 for(const object of worldV1_5.objects)for(const alias of object.properties.sourceAliases??[]){
  assert.ok(!current.has(alias),`source alias collides with stable ID ${alias}`);
  assert.ok(!aliases.has(alias),`duplicate source alias ${alias}`);
  aliases.set(alias,object);
 }
 assert.equal(worldV1_4Reconciliation.discoveryCollisions.length,0);
 assert.equal(correctedDiscoverySources.length,18);
 for(const [oldId,newId,name] of correctedDiscoverySources){
  const earlier=worldV1_3.objects.find(o=>o.id===oldId||(o.properties.sourceAliases??[]).includes(oldId));
  assert.ok(earlier,`missing V1.3 source ${oldId}`);
  assert.notEqual(earlier.name,name,`unexpected V1.3 identity ${oldId}`);
  assert.equal(aliases.get(newId)?.name,name,`wrong corrected source ${newId}`);
  assert.notEqual(aliases.get(newId)?.id,earlier.id,`source identities conflated ${newId}`);
  assert.ok(worldV1_4.objects.some(o=>o.id.startsWith(`V14-SITE-${oldId}-`)),`lost original V1.4 child identity ${oldId}`);
 }
 for(const [cell,region,code] of [['K3','REG-NORTHERN-PLATEAU','P'],['O3',null,'O']]){
  const object=current.get(`GRID-${cell}`);
  assert.equal(object?.properties.regionId,region,cell);
  assert.equal(object?.properties.environmentCode,code,cell);
 }
 for(const [id,population,core] of [['RC-010',41000,1100],['RC-018',61000,21000],['RC-019',37000,8000]]){
  const p=current.get(id)?.properties;
  assert.equal(p?.population.value,population,id);
  assert.equal(p.populationScope,'wider settlement / municipality',id);
  assert.equal(p.coreSettlementPopulation?.value,core,id);
  assert.equal(p.coreSettlementPopulation?.subsetOfCurrentPopulation,true,id);
 }
 const junction=current.get('V15-JUNC-CROWN');
 assert.equal(junction.properties.canonicalFeatureId,'AUR-14-V12-PLACE-06');
 assert.equal(junction.relations.find(r=>r.kind==='alias_of')?.targetId,'AUR-14-V12-PLACE-06');
 for(const [outlineId,featureId] of [
  ['V12-NAT-GREAT-RANGE-AURELIA-MASSIF-24','V12-005-002'],
  ['INF-003-V14-04','HYD-RES-CROWN'],
 ]){
  const outline=current.get(outlineId);
  assert.equal(outline.properties.canonicalFeatureId,featureId,outlineId);
  assert.equal(outline.relations.find(r=>r.kind==='alias_of')?.targetId,featureId,outlineId);
 }
 return {worldObjects:current.size,atlasObjects:atlas.size,sourceAliases:aliases.size,correctedDiscoverySources:correctedDiscoverySources.length,gridCells:worldV1_5.objects.filter(o=>o.type==='grid_cell').length};
}

if(process.argv[1]&&import.meta.url===new URL(`file:///${process.argv[1].replaceAll('\\','/')}`).href){
 console.log(JSON.stringify(auditWorldBaseline()));
}
