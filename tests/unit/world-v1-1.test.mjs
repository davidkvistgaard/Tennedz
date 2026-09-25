import test from 'node:test';
import assert from 'node:assert/strict';
import { world, validateWorld, getWorldObject } from '../../lib/world/index.mjs';
import { worldV1 } from '../../lib/world/data-v1.mjs';
import { macroDossiers } from '../../lib/world/macro-dossiers.mjs';
import { atlasWorld } from '../../lib/world/atlas-data.mjs';
import { lineCells } from '../../lib/world/network.mjs';

test('authoritative dossier covers every cell and preserves each listed source entry',()=>{
  assert.equal(macroDossiers.length,192);
  assert.equal(macroDossiers.reduce((n,c)=>n+c.features.length,0),1561);
  assert.equal(macroDossiers.filter(c=>c.region==='Ocean').length,37);
  assert.deepEqual(validateWorld(world),[]);
  for(const dossier of macroDossiers){
    const cell=getWorldObject(`GRID-${dossier.id}`);
    assert.ok(cell,dossier.id);
    assert.equal(cell.properties.physicalCharacter,dossier.physical);
    if(dossier.region!=='Ocean') {
      assert.equal(cell.properties.localIdentity.status,'canonical_editable');
      assert.ok(cell.properties.localIdentity.name);
    }
    for(const [i,entry] of dossier.features.entries()){
      const id=`CELL-${dossier.id}-${String(i+1).padStart(2,'0')}`;
      if(entry.kind==='major city'){
        const city=world.objects.find(o=>o.type==='settlement'&&o.name===entry.name&&o.properties.isCapital!==undefined);
        assert.ok(city?.gridCells.includes(dossier.id),`City ${entry.name} in ${dossier.id}`);
        assert.equal(getWorldObject(id),null,`No duplicate ${entry.name}`);
      } else {
        const object=getWorldObject(id);
        assert.equal(object?.name,entry.name,id);
        assert.equal(object?.parentId,cell.id,id);
        assert.equal(object?.properties.sourceKind,entry.kind,id);
        assert.deepEqual(object?.gridCells,[dossier.id],id);
      }
    }
  }
});

test('World 1.0 IDs are all retained and the four authoritative grid revisions are explicit',()=>{
  for(const old of worldV1.objects) assert.ok(getWorldObject(old.id),old.id);
  for(const [cell,region] of [['J10','Central Plains'],['L10','Eastern Steppe'],['O10','Redlands'],['O12','Southeastern Islands']]){
    assert.equal(getWorldObject(getWorldObject(`GRID-${cell}`).properties.regionId).name,region);
  }
  for(const id of ['PHY-001','PHY-006','PHY-015','INF-001','INF-003','INF-004','INF-005']){
    assert.equal(world.objects.filter(o=>o.id===id).length,1);
    assert.ok(getWorldObject(id).properties.sourceAliases?.length);
  }
  assert.equal(getWorldObject('PHY-015').name,'Crownfall');
  assert.equal(getWorldObject('NAT-WAT-001'),getWorldObject('PHY-015'));
  assert.equal(getWorldObject('NAT-MTN-001'),getWorldObject('PHY-001'));
  assert.equal(getWorldObject('INF-01'),getWorldObject('INF-001'));
  assert.equal(getWorldObject('INF-003').name,'Crown Dam');
  assert.equal(getWorldObject('INF-004').status,'canonical_editable');
  assert.equal(getWorldObject('INF-001').status,'concept');
  assert.equal(getWorldObject('AUR-LMK-012').name,null);
  assert.equal(world.objects.filter(o=>o.type==='grid_cell').length,192);
});

test('national networks traverse every recorded cell without gaps',()=>{
  const networks=world.objects.filter(o=>o.properties.continuity==='national');
  assert.ok(networks.length>=10);
  for(const n of networks) assert.deepEqual(n.gridCells,lineCells(n.geometry),n.id);
  for(const local of world.objects.filter(o=>['regional road','rail corridor','ferry landing'].includes(o.properties.sourceKind))){
    for(const relation of local.relations) {
      const route=getWorldObject(relation.targetId);
      assert.ok(route?.gridCells.includes(local.properties.sourceCell),local.id);
    }
  }
  const damaged=structuredClone(world),route=damaged.objects.find(o=>o.id==='NET-ROAD-001');
  route.gridCells.splice(Math.floor(route.gridCells.length/2),1);
  assert.match(validateWorld(damaged).join('\n'),/discontinuous national network references/);
});

test('city placement follows the revised cells while Aurelia and its existing vertical slice survive',()=>{
  for(const city of world.objects.filter(o=>o.type==='settlement'&&o.id.startsWith('CITY-'))){
    const atlas=atlasWorld.objects.find(o=>o.id===city.id);
    const [x,y]=atlas.representations[0].geometry.coordinates;
    const matching=city.gridCells.some(c=>Math.floor(x/30)==='ABCDEFGHIJKLMNOP'.indexOf(c[0])&&Math.floor(y/30)+1===Number(c.slice(1)));
    assert.ok(matching,`${city.name} prototype position is outside specified cells`);
  }
  for(const id of ['AUR-01','AUR-14','AUR-LMK-001','AUR-SITE-001','AUR-SITE-002','AUR-SITE-003']){
    assert.equal(atlasWorld.objects.filter(o=>o.id===id).length,1,id);
  }
  assert.equal(getWorldObject('AUR-SITE-002').name,'Grand Cathedral Plaza');
  assert.equal(getWorldObject('AUR-SITE-014').name,'Cathedral Library');
  assert.equal(world.objects.filter(o=>o.parentId==='AUR-01'&&o.id.startsWith('AUR-PLACE-')).length,8);
  assert.equal(getWorldObject('AUR-LMK-001').properties.centralSpireHeight.value,171);
});

test('editable names cannot change stable references; invalid zooms and orphaned deep detail fail',()=>{
  const renamed=structuredClone(world);
  renamed.objects.find(o=>o.id==='CELL-D1-01').name='Edited label';
  renamed.objects.find(o=>o.id==='GRID-D1').properties.localIdentity.name='Edited area';
  assert.deepEqual(validateWorld(renamed),[]);
  const orphan=structuredClone(world);
  orphan.objects=orphan.objects.filter(o=>o.id!=='AUR-SITE-001');
  assert.match(validateWorld(orphan).join('\n'),/broken parent reference/);
  const broken=structuredClone(world);
  broken.objects.find(o=>o.id==='AUR-SITE-014').minZoom=5;
  assert.match(validateWorld(broken).join('\n'),/invalid zoom range/);
  const badCell=structuredClone(world);
  badCell.objects.find(o=>o.id==='GRID-D1').properties.localIdentity=null;
  assert.match(validateWorld(badCell).join('\n'),/land cell requires editable local identity/);
  const cliff=structuredClone(world);
  cliff.objects.find(o=>o.id==='GRID-D1').properties.elevation={min:5000,max:6000,unit:'m',approximate:true};
  assert.match(validateWorld(cliff).join('\n'),/adjacent elevations lack transitional overlap/);
  assert.ok(!world.objects.some(o=>/cycling|racing|race route/i.test(o.name??'')));
});
