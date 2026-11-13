import test from 'node:test';
import assert from 'node:assert/strict';
import {world,getWorldObject,validateWorld} from '../../lib/world/index.mjs';
import {worldV1_4} from '../../lib/world/data-v1-4.mjs';
import {systemsSources as source} from '../../lib/world/systems-sources.mjs';
import {atlasWorld} from '../../lib/world/atlas-data.mjs';
import {lineCells,traceLineCells,contiguousCellSequence} from '../../lib/world/network.mjs';

test('all 31 named network/airport source IDs resolve to one preserved identity',()=>{
 assert.equal(world.datasetVersion,'1.5');
 assert.deepEqual(validateWorld(world),[]);
 assert.deepEqual(validateWorld(atlasWorld),[]);
 for(const prior of worldV1_4.objects)assert.ok(getWorldObject(prior.id),prior.id);
 assert.equal(source.network.length,31);
 for(const entry of source.network){
  const object=getWorldObject(entry.id);
  assert.ok(object,entry.id);
  assert.equal(object.name,entry.name,entry.id);
 }
 assert.equal(getWorldObject('ROAD-N01'),getWorldObject('V12-ROAD-CROWN'));
 assert.equal(getWorldObject('RAIL-N01'),getWorldObject('V12-RAIL-CROWN'));
 assert.equal(getWorldObject('FERRY-N01'),getWorldObject('V13-FERRY-RING'));
 assert.equal(getWorldObject('HYD-R02'),getWorldObject('RIV-001'));
 assert.equal(getWorldObject('AIR-001'),getWorldObject('INF-004'));
});

test('national roads, rails and ferry routes have traversable segments and connected endpoints',()=>{
 for(const prefix of ['ROAD-N','RAIL-N','FERRY-N']){
  const count=prefix==='ROAD-N'?8:prefix==='RAIL-N'?6:4;
  for(let i=1;i<=count;i++){
   const id=`${prefix}${String(i).padStart(2,'0')}`,parent=getWorldObject(id);
   assert.ok(parent,id);
   if(parent.properties.continuity==='collection')continue;
   assert.ok(parent.properties.segmentIds.length,id);
   for(const childId of parent.properties.segmentIds){
    const child=getWorldObject(childId);
    assert.equal(child.parentId,parent.id);
    assert.ok(contiguousCellSequence(traceLineCells(child.geometry)),childId);
    assert.deepEqual(child.gridCells,lineCells(child.geometry));
   }
   if(prefix==='FERRY-N')assert.equal(parent.properties.terminalIds.length,parent.properties.waypointIds.length);
  }
 }
 assert.deepEqual(getWorldObject('ROAD-N06').properties.transferRouteIds,['FERRY-N02']);
 assert.ok(getWorldObject('ROAD-N01').relations.some(r=>r.targetId==='CITY-001'));
});

test('watersheds, lakes, dam, bridges, airports and all-grid detail pass continuity checks',()=>{
 for(let i=1;i<=5;i++)assert.ok(getWorldObject(`HYD-R0${i}`));
 for(let i=1;i<=4;i++){
  const river=getWorldObject(`HYD-R0${i}`);
  assert.ok(river.properties.segmentIds.length);
  assert.ok(river.properties.tributaryIds.length);
 }
 assert.equal(getWorldObject('PHY-008').properties.outflowId,'HYD-R01');
 assert.equal(getWorldObject('INF-003').properties.reservoirId,'HYD-RES-CROWN');
 assert.equal(world.objects.filter(o=>o.type==='airport'&&o.properties.sourceVersion==='1.5').length,8);
 assert.equal(world.objects.filter(o=>o.type==='grid_cell'&&o.properties.localDetail?.version==='1.5').length,192);
 assert.ok(world.objects.some(o=>o.properties.carriedByRouteId));
});

test('validator rejects severed networks and geographically impossible infrastructure',()=>{
 const invalid=mutate=>{const copy=structuredClone(world);mutate(new Map(copy.objects.map(o=>[o.id,o])));return validateWorld(copy);};
 assert.ok(invalid(ids=>{ids.get('V12-ROAD-CROWN').properties.segmentIds.pop();}).some(e=>e.includes('route has missing segment')));
 assert.ok(invalid(ids=>{ids.get('FERRY-N02-SEG-01').properties.terminalToId='FERRY-N02-TERM-05';}).some(e=>e.includes('ferry segment does not meet both terminals')));
 assert.ok(invalid(ids=>{ids.get('PHY-008').properties.basinStatus='closed';}).some(e=>e.includes('closed lake has an outlet')));
 assert.ok(invalid(ids=>{ids.get('INF-003').geometry.coordinates=[50,50];}).some(e=>e.includes('dam does not intersect')));
 assert.ok(invalid(ids=>{ids.get('AIR-002').gridCells=['A1'];}).some(e=>e.includes('airport lacks a plausible land')));
 assert.ok(invalid(ids=>{ids.get('V15-POP-01').properties.densityByCell.F10='settled';}).some(e=>e.includes('population contradicts')));
});
