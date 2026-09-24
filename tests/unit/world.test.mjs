import test from 'node:test';
import assert from 'node:assert/strict';
import { world, validateWorld, assertWorld, getWorldObject, getWorldChildren, getWorldObjectsInCell, getVisibleWorldObjects, isGridId } from '../../lib/world/index.mjs';
const copy = () => structuredClone(world);

test('world 1.0 preserves the complete supplied 16 by 12 classification, including undefined P', () => {
  const rows = [
    'O O O S S H H H H H O O O O O O',
    'O O S S H H H H H H H P P O O O',
    'O S S H H H M M M H P P P P O O',
    'O W W H H M M M M P P P P P O O',
    'O W W W M M M M C C C V V E O O',
    'O W W W M M M C C C V V E E E O',
    'O W W R M M C C C C V E E E E O',
    'O W R R M C C C C V V E E D D O',
    'O F F R M C C C C V E E D D D I',
    'O F F F M M C C C E E D D D I I',
    'O F F F F M M L L L L D D I I I',
    'O O F F O O L L L L L I I I O O',
  ];
  rows.forEach((row,y) => row.split(' ').forEach((code,x) => assert.equal(getWorldObject(`GRID-${'ABCDEFGHIJKLMNOP'[x]}${y+1}`).properties.environmentCode,code)));
  assert.equal(world.objects.filter(o => o.type === 'grid_cell').length,192);
  assert.equal(world.objects.filter(o => o.properties.classificationStatus === 'unresolved').length,11);
  assert.deepEqual(validateWorld(world),[]);
  assert.equal(world.title,'Pelotonia World 1.0');
});

test('grid indexing is local km, north to south, and is not a land-area calculation', () => {
  assert.deepEqual(getWorldObject('GRID-A1').geometry.coordinates,[[[0,0],[30,0],[30,30],[0,30],[0,0]]]);
  assert.deepEqual(getWorldObject('GRID-P12').geometry.coordinates,[[[450,330],[480,330],[480,360],[450,360],[450,330]]]);
  assert.equal(world.coordinateSystem.earthAnchor,null);
  assert.equal(getWorldObject('WORLD-001').properties.mainIslandArea.value,115000);
  for(const id of ['A1','P12','I10']) assert.equal(isGridId(id),true);
  for(const id of ['A0','Q1','P13','A01','a1',null,12]) assert.equal(isGridId(id),false);
});

test('all requested seeds are present without invented places or positions', () => {
  const count = type => world.objects.filter(o => o.type === type).length;
  assert.equal(world.objects.length,265);
  assert.equal(count('region'),12); assert.equal(count('settlement'),9);
  assert.equal(count('district'),14); assert.equal(count('landmark'),12);
  assert.equal(count('river_system'),4);
  assert.equal(getWorldObject('PHY-001').properties.elevation.value,4372);
  assert.equal(getWorldObject('AUR-LMK-001').properties.capacity.minExclusive,15000);
  assert.equal(getWorldObject('AUR-LMK-012').name,null);
  assert.equal(getWorldObject('AUR-LMK-012').properties.reserved,true);
  assert.ok(world.objects.filter(o => o.type !== 'grid_cell').every(o => o.geometry === null));
  assert.ok(world.objects.filter(o => o.id.startsWith('INF-')).every(o => o.status === 'concept'));
  assert.equal(world.objects.filter(o => o.type === 'region').reduce((sum,o)=>sum+o.properties.population.value,0),12100000);
});

test('renaming a city leaves containment and stable references intact', () => {
  const modified = copy(); modified.objects.find(o => o.id === 'CITY-001').name='New working capital name';
  assert.deepEqual(validateWorld(modified),[]);
  assert.equal(getWorldChildren('CITY-001').length,27);
  assert.ok(getWorldObjectsInCell('I10').some(o => o.id === 'CITY-001'));
  assert.ok(getWorldObjectsInCell('J10').some(o => o.id === 'CITY-001'));
  assert.equal(getWorldObject('unknown'),null);
  assert.ok(Object.isFrozen(world.objects[0].properties));
});

test('progressive visibility respects levels, inclusive bounds and concept exclusion', () => {
  assert.deepEqual(getVisibleWorldObjects(0).map(o=>o.id),['EARTH-001']);
  assert.ok(!getVisibleWorldObjects(2).some(o=>o.type === 'district'));
  assert.ok(getVisibleWorldObjects(3).some(o=>o.type === 'district'));
  assert.ok(!getVisibleWorldObjects(3).some(o=>o.type === 'landmark'));
  assert.ok(getVisibleWorldObjects(4).some(o=>o.id === 'AUR-LMK-001'));
  assert.ok(!getVisibleWorldObjects(4).some(o=>o.id === 'INF-001'));
  assert.ok(getVisibleWorldObjects(4,{includeConcepts:true}).some(o=>o.id === 'INF-001'));
  assert.throws(()=>getVisibleWorldObjects(5),RangeError);
});

test('validator rejects duplicate IDs, bad grid IDs, zooms, dangling references and cycles', () => {
  const cases = [
    [w=>w.objects.push(structuredClone(w.objects[0])),/duplicate stable ID/],
    [w=>w.objects.find(o=>o.id==='CITY-001').gridCells=['Q13'],/invalid.*grid IDs/],
    [w=>w.objects[0].minZoom=1.5,/invalid zoom/],
    [w=>w.objects[0].maxZoom=-1,/invalid zoom/],
    [w=>w.objects.find(o=>o.id==='CITY-001').maxZoom=1,/invalid zoom/],
    [w=>w.objects[1].parentId='MISSING-001',/broken parent/],
    [w=>w.objects[0].parentId='WORLD-001',/containment cycle/],
    [w=>w.objects[1].relations=[{kind:'test',targetId:'MISSING-002'}],/broken relation/],
    [w=>w.objects.find(o=>o.id==='GRID-L2').properties.regionId='REG-006',/P must remain unresolved/],
    [w=>w.objects.find(o=>o.id==='GRID-A1').properties.environmentCode='X',/unknown environmental/],
    [w=>w.objects=w.objects.filter(o=>o.id!=='GRID-P12'),/192 macro cells/],
    [w=>w.objects.find(o=>o.id==='GRID-D1').properties.regionId='REG-012',/broken region/],
    [w=>w.objects[1].status='approved',/invalid status/],
    [w=>w.objects[1].geometry={type:'Point',coordinates:[1,2],coordinateSystem:'WGS84'},/invalid local geometry/],
  ];
  for(const [mutate,match] of cases){const w=copy();mutate(w);assert.match(validateWorld(w).join('\n'),match);assert.throws(()=>assertWorld(w));}
});

test('future features can cross cells with local geometries; invalid polygons and missing schema fields fail', () => {
  const w=copy(); const river=w.objects.find(o=>o.id==='RIV-001');
  river.gridCells=['G3','H3','H4'];
  river.geometry={coordinateSystem:'pelotonia-local-km',type:'LineString',coordinates:[[195,75],[225,75],[225,105]]};
  assert.deepEqual(validateWorld(w),[]);
  for (const geometry of [
    {coordinateSystem:'pelotonia-local-km',type:'LineString',coordinates:[[1,2]]},
    {coordinateSystem:'pelotonia-local-km',type:'Point',coordinates:[NaN,2]},
    {coordinateSystem:'pelotonia-local-km',type:'Polygon',coordinates:[[[0,0],[2,0],[2,2],[1,1]]]},
  ]) {river.geometry=geometry;assert.match(validateWorld(w).join('\n'),/invalid local geometry/);}
  for (const field of ['id','name','status','type','parentId','gridCells','geometry','minZoom','maxZoom','description','relations','properties']) {
    const broken=copy();delete broken.objects[1][field]; assert.ok(validateWorld(broken).length>0,field);
  }
  assert.ok(validateWorld(null).length>0);
});
