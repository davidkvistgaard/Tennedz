import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateFeed,createSampler} from '@pelotonia/race-viewer/data';
import {scenicPresentationV1,SCENIC_PRESENTATION_VERSION} from
  '../../lib/viewer/scenic-presentation-v1.mjs';

for(const category of ['men','women'])
  test(`synthetic scene keeps ${category} motor race authoritative`,()=>{
    const original=JSON.parse(readFileSync(new URL(
      `../../data/viewer/physical-40km-${category}-v1.json`,
      import.meta.url))).feed;
    const source=structuredClone(original);
    const scene=scenicPresentationV1(original);
    assert.equal(SCENIC_PRESENTATION_VERSION,'motor-lab-scenic-study-2');
    assert.deepEqual(validateFeed(scene),scene);
    assert.deepEqual(original,source);
    for(const key of ['raceId','riderCategory','duration','riders','teams',
      'frames','events','orders','actions','results'])
      assert.deepEqual(scene[key],original[key],key);
    assert.deepEqual(scene.route.distanceStations,
      original.route.distanceStations);
    assert.deepEqual(scene.route.points,original.route.points);
    const sample=createSampler(scene);
    for(const time of [0,scene.frames[20].time,scene.duration])
      assert.deepEqual(sample(time).positions,
        createSampler(original)(time).positions);
    assert.equal(scene.terrain.heights.length,
      scene.terrain.columns*scene.terrain.rows);
    assert.ok(scene.landmarks.length>800);
    assert.equal(scene.crowd.enabled,false);
    assert.equal(scene.spectators.length,240);
    assert.equal(scene.results,undefined);
  });
