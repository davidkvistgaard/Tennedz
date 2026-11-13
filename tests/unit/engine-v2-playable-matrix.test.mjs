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

const routes=[
  {distanceKm:40,terrain:'flat',fatigue:0},
  {distanceKm:40,terrain:'exposed',fatigue:15},
  {distanceKm:120,terrain:'rolling',fatigue:15},
  {distanceKm:120,terrain:'custom',fatigue:15,
    profileHeightsM:[100,350,150,500,180,100]},
  {distanceKm:260,terrain:'mountain',fatigue:30}];
const tactics=[
  {name:'attack',attack:'repeated',chase:'ignore'},
  {name:'chase',attack:'none',chase:'all'}];
const close=(actual,expected)=>
  assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);

for(const route of routes)for(const gender of ['M','F'])
  for(const tactic of tactics){
    const teamCount=gender==='M'?4:20;
    test(`${route.distanceKm} km ${route.terrain} ${gender} ${teamCount} teams ${tactic.name}: paid road, line, replay and points`,()=>{
      const output=runV91IntegratedTestDrive({settings:{...route,gender,
        teamCount,seed:'test-drive-acceptance-1',
        defaultRivalPlan:tactic.name,attack:tactic.attack,
        chase:tactic.chase},individualGroupLine:true,
      pointContext:{tier:3,divisionIndex:1,divisionCount:1}},
      {full:true});
      const {summary,recording}=output;
      const riderIds=recording.recording.committedInputs.teams.flatMap(
        team=>team.riders.map(rider=>rider.id));
      const expected=new Set(riderIds);
      assert.equal(recording.recording.route.distanceKm,route.distanceKm);
      assert.equal(summary.input.terrain,route.terrain);
      assert.equal(recording.recording.route.kilometres.length,
        route.distanceKm);
      if(route.terrain==='custom'){
        assert.deepEqual(summary.input.profileHeightsM,
          route.profileHeightsM);
        assert.ok(recording.recording.route.kilometres.some(km=>
          Math.abs(km.gradientPct)>0.01));
      }
      if(route.terrain==='exposed')
        assert.ok(recording.recording.route.kilometres.some(km=>
          km.exposed));
      assert.equal(recording.recording.committedInputs.teams.length,
        teamCount);
      assert.equal(expected.size,teamCount*8);
      assert.equal(summary.pointsStatus,'withheld');
      assert.equal(summary.canCommitAwards,false);
      assert.ok(['paid_conditional_line','conditional_multiband_line',
        'conditional_depleted_line'].includes(summary.roadStatus));
      const crossings=summary.finale.lineTimes;
      assert.equal(crossings.length,expected.size);
      assert.deepEqual(new Set(crossings.map(row=>row.riderId)),expected);
      assert.ok(crossings.every(row=>
        Number.isFinite(row.elapsedSecondsFromLastKmStart)&&
        Number.isFinite(row.energyAtLine)&&row.energyAtLine>=0));

      const source=summary.lastKmSource;
      const onRoad=[...source.roadGroups.flatMap(group=>group.riderIds),
        ...source.droppedRiderIds];
      // The peloton is the complement of named front groups and drops.
      assert.equal(new Set(onRoad).size,onRoad.length);
      assert.ok(onRoad.every(id=>expected.has(id)));
      const replay=summary.roadStatus==='paid_conditional_line'?
        summarizeV91PaidFinaleReplay(recording):
        summarizeV91PaidMultibandReplay(output);
      assert.ok(replay,'Every accepted individual line needs paid replay.');
      assert.equal(replay.lineDistanceM,route.distanceKm*1000);
      const replayRiders=replay.bands?
        replay.bands.flatMap(band=>band.frames.at(-1).riders):
        replay.frames.at(-1).riders;
      assert.equal(replayRiders.length,expected.size);
      assert.deepEqual(new Set(replayRiders.map(row=>row.riderId)),expected);
      const replayById=new Map(replayRiders.map(row=>[row.riderId,row]));
      for(const row of crossings){
        const final=replayById.get(row.riderId);
        close(final.positionM,route.distanceKm*1000);
        close(final.energyAfter,row.energyAtLine);
        close(final.elapsedToLineSeconds,
          row.elapsedSecondsFromLastKmStart);
      }
      const preview=summary.provisionalPointPreview;
      assert.equal(preview.canCommitAwards,false);
      assert.deepEqual(preview.awardRows,[]);
      assert.equal(preview.riders.length,expected.size);
      for(const [index,row] of preview.riders.entries()){
        assert.equal(row.provisionalPlace,index+1);
        const crossing=crossings.find(entry=>entry.riderId===row.riderId);
        assert.ok(crossing);
        close(row.elapsedSecondsFromLastKmStart,
          crossing.elapsedSecondsFromLastKmStart);
        close(row.energyAtLine,crossing.energyAtLine);
        assert.equal(row.previewPoints,pointsForDivisionResult({tier:3,
          resultType:'ONE_DAY',placing:index+1,
          multiplier:preview.multiplier}));
      }
    });
  }

for(const gender of ['M','F'])test(`260 km mountain ${gender}: zero reserve cannot create a paid result`,()=>{
  const output=runV91IntegratedTestDrive({settings:{distanceKm:260,
    terrain:'mountain',fatigue:30,teamCount:4,gender,
    seed:'test-drive-acceptance-1',defaultRivalPlan:'mixed',
    attack:'selective',chase:'selective'},
  finalePlans:[{teamId:'you',finisherId:'you-7',leadOutRiderId:null}],
  individualGroupLine:true,
  pointContext:{tier:3,divisionIndex:1,divisionCount:1}},{full:true});
  assert.equal(output.summary.status,'unsupported');
  assert.equal(output.summary.roadStatus,'recorded_depleted_bands');
  assert.equal(output.summary.finale.reserveStatus,
    'energy_demand_saturated_at_zero');
  assert.equal(output.summary.lastKmSource.droppedRiderIds.length,6);
  assert.ok(output.summary.finale.totalUnmetEnergyDemand>0);
  assert.equal(output.summary.finale.lineTimes,undefined);
  assert.equal(summarizeV91PaidMultibandReplay(output),null);
  assert.equal(output.summary.provisionalPointPreview.status,'unavailable');
  assert.equal(output.summary.pointsStatus,'withheld');
  assert.equal(output.summary.canCommitAwards,false);
});

for(const terrain of ['flat','exposed','rolling','mountain','custom'])
  for(const gender of ['M','F'])for(const teamCount of
    (terrain==='flat'?[4,15,20]:[4])){
    test(`120 km ${terrain} ${gender} ${teamCount} teams: a lead-out changes a replayable race result`,()=>{
      const settings={distanceKm:120,terrain,gender,teamCount,
        fatigue:15,seed:'conditional-coverage-1',
        defaultRivalPlan:'attack',attack:'repeated',chase:'ignore',
        managerTactics:[{effort:'steady',attack:'none',chase:'selective'}]};
      if(terrain==='custom')settings.profileHeightsM=
        [100,350,150,500,180,100];
      const common={settings,individualGroupLine:true,
        pointContext:{tier:3,divisionIndex:1,divisionCount:1}};
      const base=runV91IntegratedTestDrive(common,{full:true});
      const led=runV91IntegratedTestDrive({...common,finalePlans:[{
        teamId:'you',finisherId:'you-7',leadOutRiderId:'you-6'}]},
      {full:true});
      assert.deepEqual(led.recording.recording,base.recording.recording,
        'A finale order must not rewrite the locked race.');
      assert.ok(['paid_conditional_line','conditional_multiband_line',
        'conditional_depleted_line'].includes(led.summary.roadStatus));
      assert.equal(led.summary.finale.lineTimes.length,teamCount*8);
      assert.ok(led.summary.finale.leadOutWork.some(row=>
        row.riderId==='you-6'&&row.energySpent>0));
      const baseFinisher=base.summary.finale.lineTimes.find(row=>
        row.riderId==='you-7');
      const ledFinisher=led.summary.finale.lineTimes.find(row=>
        row.riderId==='you-7');
      assert.ok(ledFinisher.elapsedSecondsFromLastKmStart<
        baseFinisher.elapsedSecondsFromLastKmStart,
      'The paid lead-out must affect the nominated finisher on this road.');
      const replay=summarizeV91PaidMultibandReplay(led);
      const replayRiders=replay.bands.flatMap(band=>
        band.frames.at(-1).riders);
      assert.equal(replayRiders.length,teamCount*8);
      const crossingById=new Map(led.summary.finale.lineTimes.map(row=>
        [row.riderId,row]));
      for(const row of replayRiders){
        const crossing=crossingById.get(row.riderId);
        assert.ok(crossing);
        close(row.positionM,120000);
        close(row.elapsedToLineSeconds,
          crossing.elapsedSecondsFromLastKmStart);
        close(row.energyAfter,crossing.energyAtLine);
      }
      const preview=led.summary.provisionalPointPreview;
      assert.equal(preview.riders.length,teamCount*8);
      assert.equal(preview.canCommitAwards,false);
      assert.deepEqual(preview.awardRows,[]);
      for(const [index,row] of preview.riders.entries()){
        assert.equal(row.provisionalPlace,index+1);
        close(row.elapsedSecondsFromLastKmStart,
          crossingById.get(row.riderId).elapsedSecondsFromLastKmStart);
        close(row.energyAtLine,crossingById.get(row.riderId).energyAtLine);
        assert.equal(row.previewPoints,pointsForDivisionResult({tier:3,
          resultType:'ONE_DAY',placing:index+1,
          multiplier:preview.multiplier}));
      }
    });
  }

for(const gender of ['M','F'])for(const teamCount of [4,15,20]){
  test(`120 km ${gender} ${teamCount} teams: two managers pay lead-outs on separate roads`,()=>{
    const settings={distanceKm:120,terrain:'flat',fatigue:15,gender,
      teamCount,seed:'conditional-coverage-1',defaultRivalPlan:'attack',
      attack:'repeated',chase:'ignore',managerTactics:[{
        effort:'steady',attack:'none',chase:'selective'}]};
    const pointContext={tier:3,divisionIndex:1,divisionCount:1};
    const base=runV91IntegratedTestDrive({settings,pointContext},
      {full:true});
    const led=runV91IntegratedTestDrive({settings,pointContext,
      finalePlans:[
        {teamId:'you',finisherId:'you-7',leadOutRiderId:'you-6'},
        {teamId:'rival-1',finisherId:'rival-1-7',
          leadOutRiderId:'rival-1-5'}]}, {full:true});
    assert.deepEqual(led.recording.recording,base.recording.recording);
    assert.equal(led.summary.roadStatus,'conditional_multiband_line');
    assert.equal(led.summary.finale.lineTimes.length,teamCount*8);
    assert.equal(led.individualLine.overlapAudit.status,
      'separated_through_conditional_lines');
    for(const [finisherId,helperId] of [
      ['you-7','you-6'],['rival-1-7','rival-1-5']]){
      assert.ok(led.summary.finale.leadOutWork.some(row=>
        row.riderId===helperId&&row.energySpent>0));
      const crossing=output=>output.summary.finale.lineTimes.find(row=>
        row.riderId===finisherId);
      assert.ok(crossing(led).elapsedSecondsFromLastKmStart<
        crossing(base).elapsedSecondsFromLastKmStart);
    }
    const replay=summarizeV91PaidMultibandReplay(led);
    assert.equal(replay.bands.length,2);
    const replayRiders=replay.bands.flatMap(band=>
      band.frames.at(-1).riders);
    assert.equal(replayRiders.length,teamCount*8);
    const crossingById=new Map(led.summary.finale.lineTimes.map(row=>
      [row.riderId,row]));
    for(const row of replayRiders){
      const crossing=crossingById.get(row.riderId);
      assert.ok(crossing);
      close(row.positionM,120000);
      close(row.elapsedToLineSeconds,
        crossing.elapsedSecondsFromLastKmStart);
      close(row.energyAfter,crossing.energyAtLine);
    }
    const preview=led.summary.provisionalPointPreview;
    assert.equal(preview.riders.length,teamCount*8);
    assert.equal(preview.canCommitAwards,false);
    assert.deepEqual(preview.awardRows,[]);
    for(const [index,row] of preview.riders.entries()){
      const crossing=crossingById.get(row.riderId);
      assert.equal(row.provisionalPlace,index+1);
      close(row.elapsedSecondsFromLastKmStart,
        crossing.elapsedSecondsFromLastKmStart);
      close(row.energyAtLine,crossing.energyAtLine);
      assert.equal(row.previewPoints,pointsForDivisionResult({tier:3,
        resultType:'ONE_DAY',placing:index+1,
        multiplier:preview.multiplier}));
    }
  });
}

for(const terrain of ['flat','rolling','mountain','exposed','custom'])
  for(const gender of ['M','F'])for(const teamCount of [15,20]){
    test(`260 km ${terrain} ${gender} ${teamCount} teams: two eligible peloton helpers pay the long-race finale`,()=>{
      const settings={distanceKm:260,terrain,gender,teamCount,
        fatigue:30,seed:'cross-route-1',defaultRivalPlan:'attack',
        attack:'repeated',chase:'ignore',managerTactics:[{
          effort:'steady',attack:'none',chase:'selective'}],
        ...(terrain==='custom'?{profileHeightsM:
          [100,350,150,500,180,100]}:{})};
      const pointContext={tier:3,divisionIndex:1,divisionCount:1};
      const common={settings,individualGroupLine:true,pointContext};
      const base=runV91IntegratedTestDrive(common,{full:true});
      const led=runV91IntegratedTestDrive({...common,finalePlans:[
        {teamId:'you',finisherId:'you-4',leadOutRiderId:'you-5'},
        {teamId:'rival-2',finisherId:'rival-2-4',
          leadOutRiderId:'rival-2-6'}]},{full:true});
      assert.deepEqual(led.recording.recording,base.recording.recording);
      assert.equal(led.summary.roadStatus,'conditional_depleted_line');
      assert.equal(led.summary.finale.lineTimes.length,teamCount*8);
      assert.equal(led.summary.unavailableLeadOuts,undefined);
      assert.ok(led.summary.lastKmSource.roadGroups.length>=2);
      assert.ok(led.summary.lastKmSource.droppedRiderIds.length>0);
      const crossingById=new Map(led.summary.finale.lineTimes.map(row=>
        [row.riderId,row]));
      for(const [finisherId,helperId] of [
        ['you-4','you-5'],['rival-2-4','rival-2-6']]){
        const work=led.summary.finale.leadOutWork.filter(row=>
          row.riderId===helperId);
        assert.ok(work.length>0&&work.every(row=>
          row.roadBandId==='peloton'&&row.energySpent>0));
        assert.ok(crossingById.get(finisherId)
          .elapsedSecondsFromLastKmStart<
          base.summary.finale.lineTimes.find(row=>
            row.riderId===finisherId).elapsedSecondsFromLastKmStart);
      }
      const replay=summarizeV91PaidMultibandReplay(led);
      assert.ok(replay.bands.length>=3);
      const replayRiders=replay.bands.flatMap(band=>
        band.frames.at(-1).riders);
      assert.equal(replayRiders.length,teamCount*8);
      for(const row of replayRiders){
        const crossing=crossingById.get(row.riderId);
        assert.ok(crossing);
        close(row.positionM,260000);
        close(row.elapsedToLineSeconds,
          crossing.elapsedSecondsFromLastKmStart);
        close(row.energyAfter,crossing.energyAtLine);
      }
      const peloton=led.individualLine.bandRunners.find(band=>
        band.roadBandId==='peloton');
      assert.ok(peloton);
      for(const frame of peloton.runner.frames)for(const row of frame.riders.filter(
        rider=>rider.role==='lead_out')){
        close(row.energySpent,(row.activeDistanceM*
          row.activeWorkCostPerKm+row.shelteredDistanceM*
          row.shelteredWorkCostPerKm)/1000);
      }
      const preview=led.summary.provisionalPointPreview;
      assert.equal(preview.riders.length,teamCount*8);
      assert.equal(preview.canCommitAwards,false);
      assert.deepEqual(preview.awardRows,[]);
      for(const [index,row] of preview.riders.entries()){
        const crossing=crossingById.get(row.riderId);
        assert.equal(row.provisionalPlace,index+1);
        close(row.elapsedSecondsFromLastKmStart,
          crossing.elapsedSecondsFromLastKmStart);
        close(row.energyAtLine,crossing.energyAtLine);
        assert.equal(row.previewPoints,pointsForDivisionResult({tier:3,
          resultType:'ONE_DAY',placing:index+1,
          multiplier:preview.multiplier}));
      }
    });
  }
