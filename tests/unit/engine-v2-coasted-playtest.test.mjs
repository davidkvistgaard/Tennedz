import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93CoastedPlaytest,createV93PlayableTest,
  V93_SEPARATED_PLAYTEST_VERSION,validateV93CoastedPlaytest,
  summarizeV93CoastedPlaytest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {pointsForDivisionResult} from '../../lib/calendar/points.mjs';
import {summarizeRecordedStageTrace} from
  '../../lib/engine/v2/playtest-stage-trace.mjs';

const profileHeightsM=[100,350,150,500,180,100];
const context={tier:3,divisionIndex:1,divisionCount:1};
const settings=(terrain,gender)=>({distanceKm:260,terrain,gender,
  teamCount:4,fatigue:30,seed:'cross-route-1',
  defaultRivalPlan:'mixed',attack:'selective',chase:'selective',
  ...(terrain==='custom'?{profileHeightsM}:{})});
const crossing=(race,id)=>race.individualLine.conditionalCrossings.find(
  row=>row.riderId===id);

test('ten exhausted routes yield replayable individual lines and policy points',()=>{
  for(const terrain of ['flat','rolling','mountain','exposed','custom'])
    for(const gender of ['M','F']){
      const input=settings(terrain,gender);
      const base=createV93CoastedPlaytest(input,{pointContext:context});
      const plans=base.recording.committedInputs.teams.map(team=>({
        teamId:team.id,
        finisherId:team.id==='you'?'you-4':team.orders.captainId,
        leadOutRiderId:team.id==='you'?'you-6':
          team.id==='rival-2'?'rival-2-5':null}));
      const race=createV93CoastedPlaytest(input,{plans,
        pointContext:context});
      const summary=summarizeV93CoastedPlaytest(race);
      assert.equal(validateV93CoastedPlaytest(input,{plans,
        pointContext:context},race),true);
      assert.deepEqual(race.recording,base.recording);
      assert.deepEqual(race.clock,base.clock);
      assert.equal(race.individualLine.conditionalCrossings.length,32);
      assert.equal(summary.kilometreFrames.length,259);
      const stageTrace=summarizeRecordedStageTrace(race.recording);
      assert.equal(stageTrace.version,'v93-stage-trace-1');
      assert.equal(stageTrace.kilometres.length,260);
      for(const [index,segment] of stageTrace.kilometres.entries()){
        const recorded=race.recording.route.kilometres[index];
        assert.equal(segment.km,index+1);
        assert.equal(segment.terrain,recorded.terrain);
        assert.equal(segment.gradientPct,recorded.gradientPct);
        assert.equal(segment.surface,recorded.surface);
        assert.equal(segment.exposed,recorded.exposed);
        assert.deepEqual(segment.weather,recorded.weather);
      }
      for(const [index,frame] of summary.kilometreFrames.entries()){
        const recorded=race.recording.frames[index];
        assert.deepEqual(frame.attackAttempts,recorded.attackers);
        assert.deepEqual(frame.joinedRiderIds,
          recorded.joinedBreakawayRiderIds);
        assert.deepEqual(frame.caughtRiderIds,
          recorded.caughtBreakawayRiderIds);
        assert.deepEqual(frame.frontAttacks,recorded.splitAttacks.map(row=>({
          riderId:row.riderId,status:row.status})));
        assert.deepEqual(frame.engagedChaseTeamIds,
          recorded.engagedChaseTeamIds);
      }
      assert.equal(summary.lastKmRoad.at(-1).distanceM,260000);
      assert.equal(summary.lineTimes.length,32);
      assert.ok(summary.bandReplays.some(band=>band.id==='peloton'));
      assert.ok(summary.leadOutWork.some(row=>row.riderId==='you-6'));
      assert.ok(summary.leadOutWork.some(row=>
        row.riderId==='rival-2-5'));
      assert.equal(race.individualLine.provisionalLineOrder.length,32);
      assert.equal(base.pointPreview.riders.length,32);
      assert.equal(race.pointsStatus,'withheld');
      assert.equal(race.canCommitAwards,false);
      if(race.pointPreview.status==='unavailable'){
        assert.equal(race.pointPreview.pointsStatus,'withheld');
        assert.ok(race.individualLine.provisionalLineOrder.some(row=>
          row.firstPossiblePlace!==row.lastPossiblePlace));
      }else assert.deepEqual(race.pointPreview.awardRows,[]);
      assert.ok(crossing(race,'you-4')
        .elapsedSecondsFromLastKmStart<
        crossing(base,'you-4').elapsedSecondsFromLastKmStart);
      assert.ok(crossing(race,'rival-2-7')
        .elapsedSecondsFromLastKmStart<
        crossing(base,'rival-2-7').elapsedSecondsFromLastKmStart);
      for(const [helperId,bandId] of [['you-6','peloton'],
        ['rival-2-5',race.clock.trace.frames.at(-1).roadGroups[0].id]]){
        const band=race.individualLine.bandRunners.find(row=>
          row.roadBandId===bandId);
        assert.ok(band.runner.frames.flatMap(frame=>frame.riders)
          .some(row=>row.riderId===helperId&&
            row.role==='lead_out'&&row.energySpent>0));
      }
      const lineEnergy=new Map(base.individualLine.conditionalCrossings
        .map(row=>[row.riderId,row.energyAtLine]));
      for(const [index,row] of base.pointPreview.riders.entries()){
        assert.equal(row.provisionalPlace,index+1);
        assert.equal(row.energyAtLine,lineEnergy.get(row.riderId));
        assert.equal(row.previewPoints,pointsForDivisionResult({
          tier:3,resultType:'ONE_DAY',placing:index+1,multiplier:1}));
      }
    }
});

test('an exhausted nominated singleton keeps its paid line without a sprint',()=>{
  const input={distanceKm:260,teamCount:4,gender:'M',terrain:'flat',
    fatigue:30,seed:'v93-tactic-pair-8',profileHeightsM,
    defaultRivalPlan:'passive',effort:'steady',attack:'repeated',
    chase:'ignore',managerTactics:Array.from({length:3},()=>({
      effort:'steady',attack:'none',chase:'ignore'}))};
  const plans=['you','rival-1','rival-2','rival-3'].map(teamId=>({
    teamId,finisherId:`${teamId}-7`,leadOutRiderId:null}));
  const race=createV93PlayableTest(input,{plans,pointContext:context});
  const runner=race.individualLine.bandRunners.find(band=>
    band.runner.finishers.some(row=>row.riderId==='you-7')).runner;
  assert.equal(runner.frames.length,5);
  assert.ok(runner.frames.every(frame=>
    frame.riders.find(row=>row.riderId==='you-7')?.role==='solo_front'));
  assert.deepEqual(summarizeV93CoastedPlaytest(race).unlaunchedSoloSprints,
    [{riderId:'you-7',roadBandId:race.individualLine.bandRunners.find(
      band=>band.runner===runner).roadBandId,
    reason:'insufficient_energy'}]);
  assert.equal(validateV93CoastedPlaytest(input,{plans,
    pointContext:context},race),true);
});

test('a five-kilometre effort choice pays energy, line and preview points',()=>{
  const base={distanceKm:120,terrain:'rolling',teamCount:15,gender:'F',
    fatigue:15,seed:'late-phase-6',effort:'steady',attack:'none',
    chase:'selective',defaultRivalPlan:'mixed'};
  const run=effort=>{
    const input={...base,managerFinaleOrders:[{teamId:'you',atKm:115,
      effort}]};
    const race=createV93PlayableTest(input,{pointContext:{tier:2,
      divisionIndex:1,divisionCount:2}});
    assert.equal(validateV93CoastedPlaytest(input,{pointContext:{tier:2,
      divisionIndex:1,divisionCount:2}},race),true);
    return summarizeV93CoastedPlaytest(race);
  };
  const conserve=run('conserve'),hard=run('hard');
  for(const [summary,effort] of [[conserve,'conserve'],[hard,'hard']]){
    assert.deepEqual(summary.managerOrders.find(row=>row.teamId==='you')
      .phaseOrders,[{atKm:115,effort}]);
    assert.equal(summary.lineTimes.length,120);
    assert.equal(summary.lastKmRoad.at(-1).distanceM,120000);
    assert.equal(summary.pointPreview.awardRows.length,0);
    assert.equal(summary.pointsStatus,'withheld');
  }
  const own=summary=>summary.pointPreview.riders.find(row=>
    row.riderId==='you-7');
  assert.equal(own(conserve).provisionalPlace,12);
  assert.equal(own(hard).provisionalPlace,13);
  assert.equal(own(conserve).previewPoints,18);
  assert.equal(own(hard).previewPoints,15);
  assert.ok(own(conserve).energyAtLine>own(hard).energyAtLine);
  assert.notEqual(own(conserve).elapsedSecondsFromLastKmStart,
    own(hard).elapsedSecondsFromLastKmStart);
  for(const row of [{teamId:'you',atKm:114,effort:'hard'},
    {teamId:'you',atKm:115}])
    assert.throws(()=>createV93PlayableTest({...base,
      managerFinaleOrders:[row]}),/Choose valid playtest settings/);
  const multi=summarizeV93CoastedPlaytest(createV93PlayableTest({
    ...base,distanceKm:40,teamCount:4,managerFinaleOrders:[
      {teamId:'you',atKm:35,effort:'hard'},
      {teamId:'rival-1',atKm:35,effort:'conserve'}]}));
  assert.deepEqual(multi.managerOrders.find(row=>row.teamId==='you')
    .phaseOrders,[{atKm:35,effort:'hard'}]);
  assert.deepEqual(multi.managerOrders.find(row=>row.teamId==='rival-1')
    .phaseOrders,[{atKm:35,effort:'conserve'}]);
  assert.equal(multi.lineTimes.length,32);
});

test('coasted playtest rejects a cross-road helper and changed replay',()=>{
  const input=settings('flat','M');
  const base=createV93CoastedPlaytest(input);
  const plans=base.recording.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:team.id==='you'?'you-6':null}));
  assert.throws(()=>createV93CoastedPlaytest(input,{plans}),
    /cannot work beside the finisher/);
  const altered=structuredClone(base);
  altered.individualLine.conditionalCrossings[0].energyAtLine+=1;
  assert.throws(()=>validateV93CoastedPlaytest(input,{},altered),
    /does not replay/);
});

test('v93 validates locked finale rider IDs before simulating a road',()=>{
  const input=settings('flat','M');
  const plans=['you','rival-1','rival-2','rival-3'].map(teamId=>({
    teamId,finisherId:`${teamId}-7`,leadOutRiderId:null}));
  for(const invalid of [
    plans.map(row=>row.teamId==='you'?{...row,finisherId:'unknown-7'}:row),
    plans.map(row=>row.teamId==='you'?{
      ...row,leadOutRiderId:'rival-1-5'}:row),
    plans.map(row=>row.teamId==='you'?{
      ...row,finisherId:'you-4',leadOutRiderId:'you-7'}:row),
    [...plans.slice(0,-1),plans[0]],plans.slice(0,-1)])
    assert.throws(()=>createV93CoastedPlaytest(input,{plans:invalid}),
      /Choose one valid finale plan per manager/);
});

test('attacking v93 roads keep separated front groups through the playable line',()=>{
  for(const teamCount of [4,15,20])
    for(const terrain of ['flat','rolling','mountain','exposed','custom'])
      for(const gender of ['M','F']){
        const input={distanceKm:260,terrain,gender,teamCount,
          fatigue:30,seed:'coast-matrix',defaultRivalPlan:'attack',
          attack:'repeated',chase:'ignore',
          ...(terrain==='custom'?{profileHeightsM}:{})};
        const race=createV93PlayableTest(input,{pointContext:context});
        const summary=summarizeV93CoastedPlaytest(race);
        const riderCount=teamCount*8;
        assert.equal(race.version,V93_SEPARATED_PLAYTEST_VERSION);
        assert.ok(race.recording.frames.at(-2).roadGroups.length>=2);
        assert.equal(race.recording.frames.at(-2).riderGroups
          .filter(row=>row.group==='dropped').length,0);
        assert.equal(summary.lineTimes.length,riderCount);
        assert.equal(summary.provisionalLineOrder.length,riderCount);
        assert.equal(summary.lastKmRoad.at(-1).distanceM,260000);
        assert.equal(summary.lastKmRoad.at(-1).droppedPassages.length,0);
        assert.equal(summary.kilometreFrames.length,259);
      const stageTrace=summarizeRecordedStageTrace(race.recording);
      assert.equal(stageTrace.version,'v93-stage-trace-1');
      assert.equal(stageTrace.kilometres.length,260);
      for(const [index,segment] of stageTrace.kilometres.entries()){
        const recorded=race.recording.route.kilometres[index];
        assert.equal(segment.km,index+1);
        assert.equal(segment.terrain,recorded.terrain);
        assert.equal(segment.gradientPct,recorded.gradientPct);
        assert.equal(segment.surface,recorded.surface);
        assert.equal(segment.exposed,recorded.exposed);
        assert.deepEqual(segment.weather,recorded.weather);
      }
        assert.equal(race.pointsStatus,'withheld');
        assert.equal(race.canCommitAwards,false);
        if(race.pointPreview.status==='unavailable')
          assert.equal(race.pointPreview.pointsStatus,'withheld');
        else{
          assert.equal(race.pointPreview.riders.length,riderCount);
          assert.deepEqual(race.pointPreview.awardRows,[]);
          for(const [index,row] of race.pointPreview.riders.entries())
            assert.equal(row.previewPoints,pointsForDivisionResult({
              tier:3,resultType:'ONE_DAY',placing:index+1,multiplier:1}));
        }
        assert.equal(validateV93CoastedPlaytest(input,
          {pointContext:context},race),true);
      }
});

test('separated v93 road pays nominated front and peloton helpers',()=>{
  const input={distanceKm:260,terrain:'flat',gender:'M',teamCount:4,
    fatigue:30,seed:'coast-matrix',defaultRivalPlan:'attack',
    attack:'repeated',chase:'ignore'};
  const base=createV93PlayableTest(input);
  const plans=base.recording.committedInputs.teams.map(team=>({
    teamId:team.id,
    finisherId:team.id==='rival-1'?'rival-1-4':
      team.orders.captainId,
    leadOutRiderId:team.id==='you'?'you-6':
      team.id==='rival-1'?'rival-1-5':null}));
  const race=createV93PlayableTest(input,{plans});
  const summary=summarizeV93CoastedPlaytest(race);
  assert.equal(race.version,V93_SEPARATED_PLAYTEST_VERSION);
  assert.ok(summary.leadOutWork.some(row=>row.riderId==='you-6'));
  assert.ok(summary.leadOutWork.some(row=>row.riderId==='rival-1-5'));
  assert.ok(crossing(race,'you-7').elapsedSecondsFromLastKmStart<
    crossing(base,'you-7').elapsedSecondsFromLastKmStart);
  assert.ok(crossing(race,'rival-1-4').elapsedSecondsFromLastKmStart<
    crossing(base,'rival-1-4').elapsedSecondsFromLastKmStart);
  assert.equal(validateV93CoastedPlaytest(input,{plans},race),true);
});
