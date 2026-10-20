import test from 'node:test';
import assert from 'node:assert/strict';
import {runV91IntegratedTestDrive} from
  '../../scripts/engine-v2-test-drive.mjs';
import {summarizeV91PaidMultibandReplay} from
  '../../lib/engine/v2/playtest-multiband-replay.mjs';

test('a paid front-group lead-out can finish before its zero-length replay tail',()=>{
  const settings={distanceKm:120,terrain:'flat',teamCount:4,gender:'M',
    seed:'conditional-coverage-1',attack:'repeated',chase:'ignore',
    defaultRivalPlan:'attack',managerTactics:[{effort:'steady',
      attack:'none',chase:'selective'}]};
  const without=runV91IntegratedTestDrive({settings},{full:true});
  const withLead=runV91IntegratedTestDrive({settings,finalePlans:[{
    teamId:'you',finisherId:'you-7',leadOutRiderId:'you-6'}]},
  {full:true});
  assert.deepEqual(withLead.recording.recording,without.recording.recording);
  assert.ok(withLead.summary.finale.leadOutWork.some(row=>
    row.riderId==='you-6'&&row.energySpent>0));
  const crossings=new Map(withLead.summary.finale.lineTimes.map(row=>
    [row.riderId,row]));
  assert.ok(crossings.get('you-7').elapsedSecondsFromLastKmStart<
    without.summary.finale.lineTimes.find(row=>
      row.riderId==='you-7').elapsedSecondsFromLastKmStart);
  const replay=summarizeV91PaidMultibandReplay(withLead);
  assert.equal(replay.bands.length,2);
  assert.equal(replay.bands.reduce((count,band)=>
    count+band.riderIds.length,0),32);
  const front=withLead.individualLine.bandRunners[0].runner.frames;
  assert.equal(front.at(-1).phase,'positioned_bunch_tail');
  assert.equal(front.at(-1).durationSeconds,0);
  for(const band of replay.bands)for(const row of band.frames.at(-1).riders){
    assert.equal(row.positionM,120000);
    assert.ok(Math.abs(row.energyAfter-
      crossings.get(row.riderId).energyAtLine)<1e-6);
    assert.ok(Math.abs(row.elapsedToLineSeconds-
      crossings.get(row.riderId).elapsedSecondsFromLastKmStart)<1e-6);
  }
  const altered=structuredClone(withLead);
  altered.individualLine.bandRunners[0].runner.frames.at(-1)
    .riders[0].energySpent=1;
  assert.throws(()=>summarizeV91PaidMultibandReplay(altered),
    /band clock/);
});

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

for(const gender of ['M','F'])for(const mode of ['attack','chase']){
  test(`260 km ${gender} ${mode}: an unavailable helper leaves the paid individual road intact`,()=>{
    const settings={distanceKm:260,terrain:'mountain',fatigue:30,
      gender,teamCount:4,seed:'test-drive-acceptance-1',
      defaultRivalPlan:mode,attack:mode==='attack'?'repeated':'none',
      chase:mode==='attack'?'ignore':'all'};
    const teamId=mode==='attack'?'you':'rival-2';
    const finisherId=mode==='attack'?'you-7':'rival-2-7';
    const helperId=mode==='attack'?'you-6':'rival-2-0';
    const base=runV91IntegratedTestDrive({settings,finalePlans:[{
      teamId,finisherId,leadOutRiderId:null}]},{full:true});
    const unavailable=runV91IntegratedTestDrive({settings,finalePlans:[{
      teamId,finisherId,leadOutRiderId:helperId}]},{full:true});
    assert.deepEqual(unavailable.recording.recording,
      base.recording.recording);
    assert.deepEqual(unavailable.summary.finale.lineTimes,
      base.summary.finale.lineTimes);
    assert.deepEqual(unavailable.summary.finale.leadOutWork,[]);
    assert.deepEqual(unavailable.summary.unavailableLeadOuts,[{
      teamId,helperId,finisherId,status:'unavailable_at_500m',
      reason:mode==='attack'?'exhausted':'different_road_group',
      helperEnergySpent:0}]);
    assert.equal(unavailable.summary.appliedRequest.plans.find(row=>
      row.teamId===teamId).leadOutRiderId,null);
    assert.equal(unavailable.summary.pointsStatus,'withheld');
    assert.equal(summarizeV91PaidMultibandReplay(unavailable).bands.length,
      mode==='attack'?3:2);
  });
}
