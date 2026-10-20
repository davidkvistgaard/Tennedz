import test from 'node:test';
import assert from 'node:assert/strict';
import {runV91IntegratedTestDrive} from
  '../../scripts/engine-v2-test-drive.mjs';
import {summarizeV91PaidFinaleReplay} from
  '../../lib/engine/v2/playtest-finale-replay.mjs';
import {summarizeV91PaidMultibandReplay} from
  '../../lib/engine/v2/playtest-multiband-replay.mjs';
import {pointsForDivisionResult} from
  '../../lib/calendar/points.mjs';

const terrains=['flat','rolling','mountain','exposed','custom'];
const lengths=[40,120,260];
const profileHeightsM=[100,350,150,500,180,100];
const close=(actual,expected)=>
  assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);

function race({distanceKm,terrain,gender,teamCount,plan}){
  return runV91IntegratedTestDrive({settings:{distanceKm,terrain,gender,
    teamCount,fatigue:distanceKm===260?30:15,seed:'cross-route-1',
    ...(terrain==='custom'?{profileHeightsM}:{}),
    defaultRivalPlan:plan,attack:plan==='attack'?'repeated':
      plan==='chase'?'none':'selective',
    chase:plan==='attack'?'ignore':plan==='chase'?'all':'selective'},
  individualGroupLine:true,
  pointContext:{tier:3,divisionIndex:1,divisionCount:1}},{full:true});
}

function assertPaid(output,{distanceKm,terrain,teamCount}){
  const {summary,recording}=output;
  assert.equal(summary.sourceEnergyAudit,undefined);
  // V91 has no rule for paying travel after a rider reaches zero reserve.
  // Two consecutive zero-energy kilometre frames would mean that an accepted
  // individual line inherited such an unexplained full-kilometre movement.
  for(let index=1;index<recording.recording.frames.length-1;index++){
    const zeroBefore=new Set(recording.recording.frames[index-1]
      .riderGroups.filter(row=>row.energy===0).map(row=>row.id));
    assert.ok(!recording.recording.frames[index].riderGroups.some(row=>
      row.energy===0&&zeroBefore.has(row.id)),
    'An accepted v91 line inherited sustained zero-reserve travel.');
  }
  const riders=recording.recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>rider.id));
  const ids=new Set(riders);
  assert.equal(ids.size,teamCount*8);
  assert.equal(recording.recording.route.distanceKm,distanceKm);
  assert.equal(recording.recording.route.kilometres.length,distanceKm);
  assert.equal(summary.input.terrain,terrain);
  if(terrain==='custom'){
    assert.deepEqual(summary.input.profileHeightsM,profileHeightsM);
    assert.ok(recording.recording.route.kilometres.some(km=>
      Math.abs(km.gradientPct)>0.01));
  }
  if(terrain==='exposed')assert.ok(recording.recording.route.kilometres.some(
    km=>km.exposed));
  assert.equal(summary.pointsStatus,'withheld');
  assert.equal(summary.canCommitAwards,false);
  const namedRoad=[...summary.lastKmSource.roadGroups.flatMap(
    group=>group.riderIds),...summary.lastKmSource.droppedRiderIds];
  assert.equal(new Set(namedRoad).size,namedRoad.length);
  assert.ok(namedRoad.every(id=>ids.has(id)));
  assert.ok(['paid_conditional_line','conditional_multiband_line',
    'conditional_depleted_line'].includes(summary.roadStatus));
  const crossings=summary.finale.lineTimes;
  assert.equal(crossings.length,ids.size);
  assert.deepEqual(new Set(crossings.map(row=>row.riderId)),ids);
  const replay=summary.roadStatus==='paid_conditional_line'?
    summarizeV91PaidFinaleReplay(recording):
    summarizeV91PaidMultibandReplay(output);
  assert.ok(replay);
  const finalRows=replay.bands?
    replay.bands.flatMap(band=>band.frames.at(-1).riders):
    replay.frames.at(-1).riders;
  assert.deepEqual(new Set(finalRows.map(row=>row.riderId)),ids);
  const replayById=new Map(finalRows.map(row=>[row.riderId,row]));
  for(const row of crossings){
    const final=replayById.get(row.riderId);
    close(final.positionM,distanceKm*1000);
    close(final.energyAfter,row.energyAtLine);
    close(final.elapsedToLineSeconds,row.elapsedSecondsFromLastKmStart);
  }
  const preview=summary.provisionalPointPreview;
  assert.equal(preview.canCommitAwards,false);
  assert.deepEqual(preview.awardRows,[]);
  assert.equal(preview.riders.length,ids.size);
  const crossingsById=new Map(crossings.map(row=>[row.riderId,row]));
  for(const [index,row] of preview.riders.entries()){
    assert.equal(row.provisionalPlace,index+1);
    close(row.elapsedSecondsFromLastKmStart,
      crossingsById.get(row.riderId).elapsedSecondsFromLastKmStart);
    close(row.energyAtLine,crossingsById.get(row.riderId).energyAtLine);
    assert.equal(row.previewPoints,pointsForDivisionResult({tier:3,
      resultType:'ONE_DAY',placing:index+1,
      multiplier:preview.multiplier}));
  }
}

test('route and length cross: chase and attack retain a paid individual replay',()=>{
  for(const distanceKm of lengths)for(const terrain of terrains)
    for(const gender of ['M','F'])for(const plan of ['chase','attack']){
      const teamCount=gender==='M'?4:15;
      assertPaid(race({distanceKm,terrain,gender,teamCount,plan}),
        {distanceKm,terrain,teamCount});
    }
});

test('unavailable selective chase retains a paid replay across long routes and genders',()=>{
  for(const terrain of terrains)for(const gender of ['M','F']){
    const settings={distanceKm:260,terrain,gender,teamCount:4,
      fatigue:30,seed:'cross-route-1',
      ...(terrain==='custom'?{profileHeightsM}:{}),
      defaultRivalPlan:'mixed',attack:'selective',chase:'selective',
      managerTacticOverrides:[{teamId:'rival-1',effort:'conserve',
        attack:'none',chase:'ignore'}]};
    const output=runV91IntegratedTestDrive({settings,
      pointContext:{tier:3,divisionIndex:1,divisionCount:1}},{full:true});
    assert.equal(output.recording.version,
      'v91-conditional-race-final-13');
    assert.deepEqual(output.recording.chaseAvailability
      .unavailableSelectiveTeamIds,['rival-3']);
    assertPaid(output,{distanceKm:260,terrain,teamCount:4});
  }
});

test('recorded selective chase pays its helper across short routes and genders',()=>{
  for(const terrain of terrains)for(const gender of ['M','F']){
    const settings={distanceKm:40,terrain,gender,teamCount:4,
      seed:'conditional-coverage-1',
      ...(terrain==='custom'?{profileHeightsM}:{}),
      defaultRivalPlan:'attack',attack:'repeated',chase:'ignore',
      managerTactics:[{effort:'steady',attack:'none',chase:'selective'}]};
    const output=runV91IntegratedTestDrive({settings,
      pointContext:{tier:3,divisionIndex:1,divisionCount:1}},{full:true});
    assert.equal(output.recording.version,
      'v91-conditional-race-final-14');
    assert.ok(output.recording.selectiveChaseDecision.decisions.every(row=>
      row.decision==='engaged'));
    assertPaid(output,{distanceKm:40,terrain,teamCount:4});
  }
});

test('new selective chase pays 120 km front-group roads across routes and genders',()=>{
  for(const terrain of terrains)for(const gender of ['M','F']){
    const settings={distanceKm:120,terrain,gender,teamCount:4,
      seed:'conditional-coverage-1',
      ...(terrain==='custom'?{profileHeightsM}:{}),
      defaultRivalPlan:'attack',attack:'repeated',chase:'ignore',
      managerTactics:[{effort:'steady',attack:'none',chase:'selective'}]};
    const output=runV91IntegratedTestDrive({settings,
      pointContext:{tier:3,divisionIndex:1,divisionCount:1}},{full:true});
    assert.equal(output.recording.version,
      'v91-conditional-race-final-15');
    assert.equal(output.recording.selectiveChaseDecision.sourceEngaged,false);
    assert.ok(output.recording.selectiveChaseDecision.decisions.every(row=>
      row.decision==='engaged'));
    assertPaid(output,{distanceKm:120,terrain,teamCount:4});
  }
});

test('new 120 km selective chase retains paid large fields after starting fatigue',()=>{
  for(const teamCount of [15,20])for(const gender of ['M','F']){
    const settings={distanceKm:120,terrain:'flat',gender,teamCount,
      fatigue:15,seed:'conditional-coverage-1',
      defaultRivalPlan:'attack',attack:'repeated',chase:'ignore',
      managerTactics:[{effort:'steady',attack:'none',chase:'selective'}]};
    const output=runV91IntegratedTestDrive({settings,
      pointContext:{tier:3,divisionIndex:1,divisionCount:1}},{full:true});
    assert.equal(output.recording.version,
      'v91-conditional-race-final-15');
    assertPaid(output,{distanceKm:120,terrain:'flat',teamCount});
  }
});

test('separated singleton keeps a paid individual replay across short routes and genders',()=>{
  for(const terrain of terrains)for(const gender of ['M','F']){
    const settings={distanceKm:40,terrain,gender,teamCount:4,
      seed:'conditional-coverage-1',
      ...(terrain==='custom'?{profileHeightsM}:{}),
      defaultRivalPlan:'attack',attack:'repeated',chase:'ignore',
      managerTactics:[{effort:'steady',attack:'none',chase:'ignore'}]};
    const output=runV91IntegratedTestDrive({settings,
      pointContext:{tier:3,divisionIndex:1,divisionCount:1}},{full:true});
    assert.equal(output.individualLine.version,
      'v2-finale-separated-individual-line-lab-3');
    assert.equal(output.individualLine.bandRunners[0].runner.finishers.length,
      1);
    assertPaid(output,{distanceKm:40,terrain,teamCount:4});
  }
});

test('long mixed road: depleted four-team fields refuse a fictional finish',()=>{
  for(const terrain of terrains)for(const gender of ['M','F'])
    for(const teamCount of [4,15,20]){
      const output=race({distanceKm:260,terrain,gender,
        teamCount,plan:'mixed'});
      if(teamCount!==4){
        assertPaid(output,{distanceKm:260,terrain,teamCount});
        continue;
      }
      const {summary}=output;
      assert.equal(summary.roadStatus,'recorded_depleted_bands');
      assert.equal(summary.sourceEnergyAudit.status,
        'sustained_zero_reserve');
      assert.equal(summary.sourceEnergyAudit.riders.length,6);
      assert.ok(summary.sourceEnergyAudit.totalUnmetEnergyDemand>0);
      assert.ok(summary.sourceEnergyAudit.unpaidRiderKilometres>0);
      assert.ok(summary.sourceEnergyAudit.firstUnpaidKm<259);
      assert.ok(summary.sourceEnergyAudit.riders.every(row=>
        row.firstZeroKm>=231&&row.repeatedZeroKm===row.firstZeroKm+1));
      assert.equal(summary.finale.reserveStatus,
        'energy_demand_saturated_at_zero');
      const frames=output.recording.recording.frames;
      for(const riderId of summary.lastKmSource.droppedRiderIds){
        const firstZero=frames.findIndex(frame=>frame.riderGroups.some(
          rider=>rider.id===riderId&&rider.energy===0));
        assert.ok(firstZero>=0&&firstZero<258,
          `${riderId} must have exhausted reserve before the last km`);
        assert.ok(frames[firstZero+1].riderGroups.some(
          rider=>rider.id===riderId&&rider.energy===0),
        `${riderId} must still be depleted after another kilometre`);
      }
      assert.ok(summary.finale.totalUnmetEnergyDemand>0);
      assert.equal(summary.finale.lineTimes,undefined);
      assert.equal(summarizeV91PaidMultibandReplay(output),null);
      assert.equal(summary.provisionalPointPreview.status,'unavailable');
      assert.equal(summary.pointsStatus,'withheld');
      assert.equal(summary.canCommitAwards,false);
    }
});
