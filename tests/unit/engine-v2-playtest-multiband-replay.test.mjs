import test from 'node:test';
import assert from 'node:assert/strict';
import {runV91IntegratedTestDrive} from
  '../../scripts/engine-v2-test-drive.mjs';
import {summarizeV91PaidMultibandReplay} from
  '../../lib/engine/v2/playtest-multiband-replay.mjs';

for(const route of [{distanceKm:40,terrain:'flat',fatigue:0},
  {distanceKm:120,terrain:'rolling',fatigue:15},
  {distanceKm:260,terrain:'mountain',fatigue:30}])
  for(const gender of ['M','F'])for(const teamCount of [4,15,20]){
    const settings={...route,gender,teamCount};
    test(`${settings.distanceKm} km ${gender}, ${teamCount} teams: paid groups reach every conditional line`,()=>{
  const output=runV91IntegratedTestDrive({settings:{...settings,
    seed:'test-drive-acceptance-1',defaultRivalPlan:'attack',
    attack:'repeated',chase:'ignore'}},{full:true});
  const replay=summarizeV91PaidMultibandReplay(output);
  assert.equal(replay.status,'band_local_paid_trace');
  assert.equal(replay.bands.length,route.distanceKm===260?3:2);
  assert.equal(replay.bands.reduce((sum,band)=>
    sum+band.riderIds.length,0),settings.teamCount*8);
  for(const band of replay.bands){
    assert.equal(band.frames.length,6);
    assert.ok(band.frames.at(-1).riders.every(row=>
      row.positionM===settings.distanceKm*1000&&
      Number.isFinite(row.elapsedToLineSeconds)));
  }

  assert.equal(output.summary.pointsStatus,'withheld');
  const changed=structuredClone(output);
  changed.individualLine.bandRunners[0].runner.frames[0]
    .riders[0].energyAfter+=1;
  assert.throws(()=>summarizeV91PaidMultibandReplay(changed),
    /rider travel or energy/);
  const changedLine=structuredClone(output);
  changedLine.summary.finale.lineTimes[0].energyAtLine+=1;
  assert.throws(()=>summarizeV91PaidMultibandReplay(changedLine),
    /individual line/);
    });
  }

for(const gender of ['M','F']){
  test(`260 km ${gender}: the dropped rider keeps an independent paid line`,()=>{
    const output=runV91IntegratedTestDrive({settings:{distanceKm:260,
      terrain:'mountain',fatigue:30,gender,teamCount:4,
      seed:'test-drive-acceptance-1',defaultRivalPlan:'chase',
      attack:'none',chase:'all'}},{full:true});
    const replay=summarizeV91PaidMultibandReplay(output);
    assert.equal(replay.status,'band_local_paid_trace');
    assert.deepEqual(replay.bands.map(band=>
      [band.id,band.riderIds.length,band.frames.length]),
    [['peloton',31,6],['isolated:rival-2-0',1,5]]);
    assert.equal(replay.bands[1].frames.at(-1).riders[0].positionM,260000);
    assert.equal(output.summary.finale.lineTimes.length,32);
    assert.equal(output.summary.pointsStatus,'withheld');
    const changed=structuredClone(output);
    changed.individualLine.bandRunners[1].runner.frames[0]
      .riders[0].energyAfter+=1;
    assert.throws(()=>summarizeV91PaidMultibandReplay(changed),
      /rider travel or energy/);
  });
}
