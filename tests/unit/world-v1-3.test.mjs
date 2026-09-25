import test from 'node:test';
import assert from 'node:assert/strict';
import { world, getWorldObject, getWorldChildren, getVisibleWorldObjects, validateWorld } from '../../lib/world/index.mjs';
import { worldV1_1 } from '../../lib/world/data-v1-1.mjs';
import { expansionSources } from '../../lib/world/expansion-sources.mjs';
import { atlasWorld } from '../../lib/world/atlas-data.mjs';
import { lineCells } from '../../lib/world/network.mjs';

test('V1.2 and V1.3 retain every earlier ID and all source inventories',()=>{
  assert.equal(world.datasetVersion,'1.3');
  assert.deepEqual(validateWorld(world),[]);
  assert.deepEqual(validateWorld(atlasWorld),[]);
  assert.equal(expansionSources.cells.length,192);
  assert.equal(expansionSources.cities.length,24);
  assert.equal(expansionSources.discoveries.length,119);
  for(const old of worldV1_1.objects)assert.ok(getWorldObject(old.id),old.id);
  for(const item of expansionSources.cities)assert.equal(getWorldObject(item.id)?.name,item.name);
  for(const item of expansionSources.discoveries){
    const object=getWorldObject(item.id);
    assert.ok(object,item.id);
    assert.ok(object.name===item.name||object.properties.sourceNameVariants?.includes(item.name),item.id);
  }
});

test('K3 and O3 source conflicts remain explicit; V1.1 climate and stable cells survive',()=>{
  assert.deepEqual(world.issues.find(i=>i.id==='SOURCE-008')?.objectIds,['GRID-K3','GRID-O3']);
  assert.equal(getWorldObject('GRID-K3').properties.regionId,'REG-NORTHERN-PLATEAU');
  assert.equal(getWorldObject('GRID-O3').properties.regionId,null);
  for(const source of expansionSources.cells){
    const cell=getWorldObject(`GRID-${source.id}`);
    if(['K3','O3'].includes(source.id))assert.ok(cell.properties.deepSourceConflict);
    else {
      assert.equal(cell.properties.deepLandscape,source.landscape);
      assert.deepEqual(cell.properties.deepNamedPlaces,source.names);
    }
  }
});

test('all regional cities have terrain-compatible cell placement and usable L3/L4 children',()=>{
  for(const item of expansionSources.cities){
    const city=getWorldObject(item.id),region=getWorldObject(city.parentId);
    assert.equal(region.name,item.region);
    assert.equal(city.gridCells.length,1);
    assert.ok(region.gridCells.includes(city.gridCells[0]));
    assert.equal(city.geometry,null);
    assert.ok(city.properties.geographicReason);
    const children=getWorldChildren(city.id);
    assert.equal(children.filter(c=>c.type==='district').length,3);
    assert.equal(children.filter(c=>c.type==='landmark').length,3);
    assert.ok(children.every(c=>c.gridCells[0]===city.gridCells[0]));
  }
  assert.ok(getVisibleWorldObjects(2).some(o=>o.id==='RC-001'));
  assert.ok(!getVisibleWorldObjects(2,{includeConcepts:true}).some(o=>o.id==='RC-001-DIST-01'));
  assert.ok(getVisibleWorldObjects(3,{includeConcepts:true}).some(o=>o.id==='RC-001-DIST-01'));
  assert.ok(getVisibleWorldObjects(4,{includeConcepts:true}).some(o=>o.id==='RC-001-SITE-01'));
});

test('major city, Aurelia, cathedral and discovery identities reconcile without duplicates',()=>{
  for(const [name,details] of Object.entries(expansionSources.major)){
    const city=world.objects.find(o=>o.name===name&&o.id.startsWith('CITY-'));
    const children=getWorldChildren(city.id);
    for(const district of details.districts)assert.ok(children.some(o=>o.type==='district'&&o.name===district),`${name}: ${district}`);
    for(const landmark of details.landmarks)assert.ok(children.some(o=>o.name===landmark),`${name}: ${landmark}`);
  }
  for(const [id,details] of Object.entries(expansionSources.aurelia)){
    assert.equal(getWorldObject(id)?.name,details.name);
    for(const name of details.places)assert.ok(world.objects.some(o=>o.name===name&&(
      o.parentId===id||o.id.startsWith('AUR-SITE-')
    )),`${id}: ${name}`);
  }
  for(const name of expansionSources.cathedral)assert.ok(world.objects.some(o=>o.name===name&&(
    o.parentId==='AUR-LMK-001'||o.parentId==='AUR-SITE-001'
  )),name);
  assert.equal(getWorldObject('DISC-005'),getWorldObject('PHY-015'));
  assert.equal(getWorldObject('DISC-010'),getWorldObject('INF-003'));
  assert.equal(getWorldObject('DISC-024'),getWorldObject('INF-001'));
  assert.equal(getWorldObject('DISC-029'),getWorldObject('DISC-001'));
  assert.equal(new Set(world.objects.map(o=>o.id)).size,world.objects.length);
});

test('named national routes and the island ferry ring remain continuous; bad placements fail',()=>{
  for(const family of ['CROWN','EMERALD','EASTERN','CALDERA'])for(const kind of ['ROAD','RAIL']){
    const object=getWorldObject(`V12-${kind}-${family}`);
    assert.equal(object.properties.continuity,'national');
    assert.deepEqual(object.gridCells,lineCells(object.geometry));
    assert.equal(object.properties.geometryStatus,'prototype');
  }
  const ferry=getWorldObject('V13-FERRY-RING');
  assert.equal(ferry.type,'ferry_route');
  assert.deepEqual(ferry.gridCells,lineCells(ferry.geometry));
  const bad=structuredClone(world);
  bad.objects.find(o=>o.id==='RC-001').gridCells=['O3'];
  assert.ok(validateWorld(bad).some(e=>e.includes('RC-001: placed outside parent region')));
  const newObjects=world.objects.filter(o=>!worldV1_1.objects.some(old=>old.id===o.id));
  assert.ok(!newObjects.some(o=>/\b(cycling|race|rider|stage)\b/i.test(`${o.name} ${o.description}`)));
});
