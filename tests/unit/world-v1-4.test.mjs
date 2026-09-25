import test from 'node:test';
import assert from 'node:assert/strict';
import {worldV1_4,worldV1_4Reconciliation as rec} from '../../lib/world/data-v1-4.mjs';
import {worldV1_3} from '../../lib/world/data-v1-3.mjs';
import {systemsSources as source} from '../../lib/world/systems-sources.mjs';
import {validateWorld} from '../../lib/world/validate.mjs';

const ids=new Map(worldV1_4.objects.map(o=>[o.id,o]));
const get=id=>ids.get(id)??worldV1_4.objects.find(o=>o.properties.sourceAliases?.includes(id));

test('all 192 cells have source-derived local detail and earlier IDs survive',()=>{
 assert.equal(worldV1_4.datasetVersion,'1.4');
 assert.deepEqual(validateWorld(worldV1_4),[]);
 for(const prior of worldV1_3.objects)assert.ok(ids.has(prior.id),prior.id);
 const cells=worldV1_4.objects.filter(o=>o.type==='grid_cell');
 assert.equal(cells.length,192);
 for(const cell of cells){
  const detail=cell.properties.localDetail;
  assert.equal(detail.version,'1.4');
  assert.ok(detail.objectIds.every(id=>ids.get(id)?.gridCells.includes(cell.name)),cell.name);
  if(cell.properties.regionId===null)assert.ok(detail.objectIds.length<=4,cell.name);
  else assert.ok(detail.objectIds.length>=2,cell.name);
 }
});

test('24 regional cities and 26 selected towns receive named local structure',()=>{
 assert.equal(source.regional.length,24);
 assert.equal(source.towns.length,26);
 for(const item of source.regional){
  const city=get(item.id),children=worldV1_4.objects.filter(o=>o.parentId===city.id);
  for(const name of item.districts)assert.ok(children.some(o=>o.name===name&&o.type==='district'&&o.minZoom===3),`${item.id}: ${name}`);
  for(const name of item.anchors)assert.ok(children.some(o=>o.name===name&&o.type==='landmark'&&o.minZoom===4),`${item.id}: ${name}`);
 }
 for(const item of source.towns){
  const town=get(item.id),children=worldV1_4.objects.filter(o=>o.parentId===town.id);
  assert.equal(town.type,'settlement');
  assert.ok(children.filter(o=>o.type==='local_area'&&o.minZoom===3).length>=3,item.id);
  assert.ok(children.some(o=>o.type==='landmark'&&o.minZoom===4),item.id);
 }
});

test('24 signature sites and five infrastructure systems get L4 children without DISC identity swaps',()=>{
 assert.equal(source.signature.length,24);
 assert.equal(rec.discoveryCollisions.length,0);
 assert.equal(rec.sourceCorrections.length,18);
 for(const [prior,corrected,name] of rec.sourceCorrections){
  assert.equal(get(corrected).name,name);
  assert.notEqual(get(prior).id,get(corrected).id);
  assert.ok(worldV1_4.objects.some(o=>o.id.startsWith(`V14-SITE-${prior}-`)&&o.parentId===get(corrected).id),prior);
  assert.ok(!worldV1_4.objects.some(o=>o.id.startsWith(`V14-SITE-${corrected}-`)),corrected);
 }
 for(const item of source.signature){
  const parent=ids.get(rec.resolvedSignatures.find(x=>x.sourceId===item.sourceId).canonicalId);
  assert.equal(parent.name,item.name);
  for(const name of item.children)assert.ok(worldV1_4.objects.some(o=>o.parentId===parent.id&&o.name===name&&o.minZoom===4),`${item.sourceId}: ${name}`);
 }
 for(const item of source.engineering){
  const parent=get(item.sourceId);
  assert.equal(parent.name,item.name);
  for(const name of item.children)assert.ok(worldV1_4.objects.some(o=>o.parentId===parent.id&&o.name===name),`${item.sourceId}: ${name}`);
 }
 assert.equal(get('DISC-008').name,'Crown Observatory');
 assert.equal(get('PHY-007').name,'Aurelia Icefield');
});
