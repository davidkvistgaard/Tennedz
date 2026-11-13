import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeAtlasCloseView} from '../../public/pelotonia-atlas/atlas-close-view.js';
import {withCyclingGuide} from '../../public/pelotonia-atlas/cycling-guide.mjs';

const asset = name => new URL('../../public/pelotonia-atlas/'+name,import.meta.url);
const read = name => JSON.parse(readFileSync(asset(name),'utf8'));

test('close zoom reuses drone geometry and keeps the geographic focus across field changes', () => {
  const atlas = read('atlas.json');
  const guide = read('cycling-guide.json');
  const geography = read('field-geography.json');
  const bytes = readFileSync(asset('elevation.bin'));
  const heights = new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
  const [collection,manifest] = withCyclingGuide(read('lokallag.geojson'),read('lokallag-manifest.json'),guide,atlas.grid);
  const features = new Map(collection.features.map(feature => [feature.id,feature]));
  const cells = new Map(manifest.cells.map(cell => [cell.cell,{...cell,features:cell.featureIds.map(id => features.get(id))}]));
  const view = makeAtlasCloseView({atlas,geography,heights,cells});
  let ground, scene, draws=0;
  const renderer = {
    shadowMap:{},
    render(value) {
      scene=value;
      ground=scene.getObjectByName('Field terrain');
      draws++;
    },
  };
  const state = {x:267.804,z:282.696,zoom:160,
    ortho:{left:-250,right:250,top:150,bottom:-150},
    offset:{x:0,y:620,z:0},grid:true};
  assert.equal(view.render(renderer,state,16),'loading');
  assert.equal(view.render(renderer,state,160),'rendered');
  assert.ok(ground);
  assert.ok(scene.getObjectByName('Cycling landmarks'));
  const [x,y] = view.project(state,1000,600);
  assert.ok(Math.abs(x-500)<1 && Math.abs(y-300)<1);
  assert.equal(view.render(renderer,state,320),'retained');
  assert.equal(draws,1);
  const next = {...state,x:279.044,z:197.674};
  assert.equal(view.render(renderer,next,480),'loading');
  assert.equal(view.render(renderer,next,640),'rendered');
  assert.ok(scene.getObjectByName('Cycling landmarks'));
  assert.equal(view.render(renderer,{...next,x:-10},800),'unavailable');
});
