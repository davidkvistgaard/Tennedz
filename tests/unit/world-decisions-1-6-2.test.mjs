import test from 'node:test';
import assert from 'node:assert/strict';
import {world,validateWorld} from '../../lib/world/index.mjs';
import {worldV1} from '../../lib/world/data-v1.mjs';
import {atlasWorld} from '../../lib/world/atlas-data.mjs';
import {SAME_PLACE_ALIASES} from '../../lib/world/baseline-decisions.mjs';
import {visualStyle} from '../../lib/world/visual-style.mjs';

const get = id => world.objects.find(object => object.id === id);

test('Great Caldera contains one lake and reconciles repeated source places', () => {
  assert.equal(get('DISC-012').type,'caldera');
  assert.equal(get('PHY-011').parentId,'DISC-012');
  assert.equal(get('V12-NAT-GREAT-CALDERA-VOLCANIC-BASIN-05').parentId,'PHY-011');
  assert.equal(get('V12-NAT-GREAT-CALDERA-VOLCANIC-BASIN-01').parentId,'DISC-012');
  for (const [olderId,canonicalId] of SAME_PLACE_ALIASES) {
    assert.equal(get(olderId).properties.canonicalFeatureId,canonicalId,olderId);
    assert.equal(get(olderId).relations.find(relation => relation.kind === 'alias_of')?.targetId,canonicalId,olderId);
  }
  assert.equal(get('AUR-SITE-003').parentId,'AUR-LMK-001');
});

test('regional population is reallocated without changing the national estimate or World 1.0 history', () => {
  assert.equal(worldV1.objects.find(object=>object.id==='REG-NORTHERN-PLATEAU').properties.population,null);
  assert.equal(get('REG-NORTHERN-PLATEAU').properties.population.value,300_000);
  assert.equal(get('REG-002').properties.population.value,1_100_000);
  assert.equal(get('REG-006').properties.population.value,3_500_000);
  assert.equal(world.objects.filter(object=>object.type==='region').reduce((total,region)=>total+region.properties.population.value,0),12_100_000);
  assert.equal(world.objects.find(object=>object.id==='WORLD-001').properties.population.value,12_100_000);
});

test('Kaen–Red keeps a connected channel with a visually seasonal lower reach', () => {
  assert.equal(get('RIV-004').properties.terminalKind,'seasonal-ocean-mouth');
  assert.equal(get('HYD-R04-SEG-03').properties.flowRegime,'wet-year-only');
  const lower=atlasWorld.objects.find(object=>object.id==='RIV-004').representations.find(representation=>representation.style==='seasonal-river');
  assert.ok(lower);
  assert.ok(visualStyle(get('RIV-004'),lower).dasharray);
  const broken=structuredClone(world);
  broken.objects.find(object=>object.id==='HYD-R04-SEG-03').properties.flowRegime='perennial';
  assert.match(validateWorld(broken).join('\n'),/major river lacks source\/mouth/);
});
