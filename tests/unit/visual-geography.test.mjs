import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from '../../lib/world/index.mjs';
import {atlasWorld} from '../../lib/world/atlas-data.mjs';
import {validateWorld} from '../../lib/world/validate.mjs';
import {validateVisualGeography} from '../../lib/world/visual-validate.mjs';
import {REGION_VISUALS,labelPriority,visualStyle} from '../../lib/world/visual-style.mjs';
import {objectCamera,visibleRepresentations,labelsFor,fitBounds} from '../../lib/world/atlas-view.mjs';

const find=(data,id)=>data.objects.find(o=>o.id===id);
test('V1.6 is a visual layer over every preserved V1.5 identity',()=>{
 assert.deepEqual(validateWorld(atlasWorld),[]);
 assert.deepEqual(validateVisualGeography(atlasWorld),[]);
 for(const object of world.objects)assert.ok(find(atlasWorld,object.id),object.id);
 assert.equal(Object.keys(REGION_VISUALS).length,13);
 assert.equal(atlasWorld.datasetVersion,'1.5');
 assert.equal(find(atlasWorld,'INF-001').properties.sourceAliases.includes('DISC-024'),true);
});

test('zoom reveals national networks, then regional and site detail without a permanent grid',()=>{
 const country=objectCamera(find(atlasWorld,'WORLD-001'));
 const whole=visibleRepresentations(atlasWorld.objects,country);
 assert.ok(whole.some(r=>r.object.type==='road'&&r.object.properties.networkKind==='road'));
 assert.ok(whole.some(r=>r.object.type==='rail'&&r.object.properties.networkKind==='rail'));
 assert.ok(whole.some(r=>r.object.id==='PHY-007'));
 assert.ok(!whole.some(r=>r.object.type==='grid_cell'||r.object.id==='AUR-SITE-001'));
 const local=visibleRepresentations(atlasWorld.objects,objectCamera(find(atlasWorld,'CITY-001')));
 assert.ok(local.some(r=>r.object.id==='AUR-01'));
 const site=visibleRepresentations(atlasWorld.objects,objectCamera(find(atlasWorld,'AUR-LMK-001')));
 assert.ok(site.some(r=>r.object.id==='AUR-SITE-001'));
 assert.ok(labelPriority(find(atlasWorld,'CITY-001'))>labelPriority(find(atlasWorld,'RC-001')));
 assert.ok(labelsFor(whole,country).some(r=>r.object.id==='CITY-001'));
 for(const [id,bounds] of [['PHY-015',[93,165,102,174]],['PHY-013',[389,254,399,264]],['PHY-011',[304,191,313,200]],['PHY-007',[162,145,173,155]]]){
  const view=visibleRepresentations(atlasWorld.objects,fitBounds(bounds));
  assert.ok(view.some(r=>r.object.id===id),`${id} disappears at local zoom`);
 }
});

test('wet, alpine, volcanic and arid regions receive distinct colours and water keeps its basin character',()=>{
 const visual=id=>{const o=find(atlasWorld,id);return visualStyle(o,o.representations[0]);};
 assert.notEqual(visual('REG-003').fill,visual('REG-009').fill);
 assert.notEqual(visual('REG-005').fill,visual('REG-007').fill);
 assert.equal(visual('PHY-011').fill,'#295d70');
 assert.equal(visual('PHY-008').fill,'#6da9ae');
});

test('visual checks reject broken basins, transport endpoints, glacier placement and exposed grid',()=>{
 for(const mutate of [
  data=>{find(data,'PHY-011').geometry.coordinates[0][0]=[370,195];},
  data=>{find(data,'INF-001').geometry.coordinates[0]=[400,180];},
  data=>{find(data,'PHY-007').geometry.coordinates[0][0]=[470,5];},
  data=>{find(data,'GRID-A1').representations=[{geometry:find(data,'GRID-A1').geometry,style:'debug',minZoom:1,maxZoom:4}];},
 ]){
  const data=structuredClone(atlasWorld);mutate(data);
  assert.ok(validateVisualGeography(data).length);
 }
});
