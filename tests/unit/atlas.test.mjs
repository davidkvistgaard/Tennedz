import test from 'node:test';
import assert from 'node:assert/strict';
import { atlasWorld } from '../../lib/world/atlas-data.mjs';
import { validateWorld } from '../../lib/world/validate.mjs';
import { geometryBounds, detailLevel, objectCamera, visibleRepresentations, zoomCamera, labelsFor } from '../../lib/world/atlas-view.mjs';
const get=id=>atlasWorld.objects.find(o=>o.id===id);
test('atlas extends canonical identities and preserves the reserved landmark and grid',()=>{
 assert.deepEqual(validateWorld(atlasWorld),[]);
 assert.equal(atlasWorld.objects.filter(o=>o.type==='grid_cell').length,192);
 assert.equal(get('AUR-LMK-012').geometry,null);
 assert.equal(get('AUR-LMK-012').name,null);
 assert.equal(get('AUR-LMK-001').parentId,'AUR-01');
 assert.equal(get('CITY-001').properties.population.value,2450000);
 assert.equal(atlasWorld.coordinateSystem.earthAnchor,null);
 assert.equal(get('REG-NORTHERN-PLATEAU').gridCells.length,11);
});
test('camera exposes real new detail across country, macro, city and site',()=>{
 for(const [id,level] of [['WORLD-001',1],['GRID-I10',2],['CITY-001',3],['AUR-LMK-001',4]])assert.equal(detailLevel(objectCamera(get(id)).width),level);
 const country=visibleRepresentations(atlasWorld.objects,objectCamera(get('WORLD-001')));
 assert.ok(country.some(r=>r.object.id==='CITY-001'));
 assert.ok(!country.some(r=>r.object.id==='AUR-SITE-001'));
 const site=visibleRepresentations(atlasWorld.objects,objectCamera(get('AUR-LMK-001')));
 assert.ok(site.some(r=>r.object.id==='AUR-SITE-001'));
 assert.ok(site.some(r=>r.object.properties.extensionExample));
 const b=geometryBounds(get('AUR-SITE-001').geometry);
 assert.ok(Math.abs(b[2]-b[0]-.188)<1e-9);assert.ok(Math.abs(b[3]-b[1]-.092)<1e-9);
 const p=geometryBounds(get('AUR-LMK-001').geometry);assert.ok(Math.abs((p[2]-p[0])*(p[3]-p[1])-.35)<1e-9);
});
test('prototype validator rejects broken representations, containment and camera bounds',()=>{
 for(const mutate of [w=>w.objects.find(o=>o.id==='AUR-01').parentId='WORLD-001',w=>w.objects.find(o=>o.id==='AUR-LMK-001').parentId='WORLD-001',w=>w.objects.find(o=>o.id==='CITY-001').representations[0].maxZoom=-1,w=>w.objects.find(o=>o.id==='CITY-001').representations[0].geometry.coordinates=[NaN,2],w=>w.objects.find(o=>o.id==='CITY-001').focusBounds=[4,4,1,1]]){const w=structuredClone(atlasWorld);mutate(w);assert.ok(validateWorld(w).length);}
});
test('renaming changes labels without changing traversal or visibility; zoom stays bounded',()=>{
 const camera=objectCamera(get('CITY-001')),data=structuredClone(atlasWorld.objects);data.find(o=>o.id==='AUR-01').name='Renamed district';
 assert.ok(labelsFor(visibleRepresentations(data,camera),camera).some(r=>r.object.name==='Renamed district'));
 assert.equal(zoomCamera(camera,.00001).width,.08);
 assert.equal(zoomCamera(camera,1000).width,650);
});
