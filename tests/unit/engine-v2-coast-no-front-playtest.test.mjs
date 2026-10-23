import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  V93_COAST_NO_FRONT_PLAYTEST_VERSION,
  V93_DYNAMIC_NO_FRONT_PLAYTEST_VERSION,
  validateV93CoastedPlaytest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {pointsForDivisionResult} from '../../lib/calendar/points.mjs';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {recordFinaleCoastNoFrontDroppedLastKmClock} from
  '../../lib/engine/v2/finale-separated-last-km.mjs';

const context={tier:3,divisionIndex:1,divisionCount:1};
const settings=(gender,terrain)=>({
  distanceKm:260,terrain,teamCount:4,gender,fatigue:30,
  attack:'none',chase:'all',defaultRivalPlan:'chase',
  seed:'test-drive-acceptance-1',
  ...(terrain==='custom'?{profileHeightsM:[100,350,150,500,180,100]}:{})});

test('coasted no-front roads replay paid bunch and isolated crossings',()=>{
  for(const gender of ['M','F'])
    for(const terrain of ['flat','rolling','mountain','exposed','custom']){
      const input=settings(gender,terrain);
      const race=createV93PlayableTest(input,{pointContext:context});
      const dropped=race.recording.frames.at(-2).riderGroups.filter(
        row=>row.group==='dropped');
      assert.equal(race.version,V93_COAST_NO_FRONT_PLAYTEST_VERSION);
      assert.equal(dropped.length,1);
      assert.equal(race.clock.trace.outcome,'bunch_with_coasted_dropped');
      assert.deepEqual(race.clock.line.bands.map(row=>row.id),
        ['peloton','dropped']);
      assert.equal(race.clock.passageFrames.length,7);
      assert.equal(race.clock.passageFrames.at(-1).droppedPassages.length,1);
      assert.equal(race.individualLine.conditionalCrossings.length,32);
      assert.equal(race.individualLine.bandRunners.length,2);
      assert.equal(race.individualLine.pre500Audit.firstPotentialOverlap,
        null);
      assert.equal(race.individualLine.overlapAudit.firstPotentialOverlap,
        null);
      assert.equal(race.pointPreview.riders.length,32);
      assert.deepEqual(race.pointPreview.awardRows,[]);
      for(const [index,row] of race.pointPreview.riders.entries())
        assert.equal(row.previewPoints,pointsForDivisionResult({
          tier:3,resultType:'ONE_DAY',placing:index+1,multiplier:1}));
      assert.equal(race.canCommitAwards,false);
      assert.equal(validateV93CoastedPlaytest(input,
        {pointContext:context},race),true);
    }
});

test('a nominated bunch helper pays work without moving the isolated rider',()=>{
  const input=settings('M','mountain');
  const base=createV93PlayableTest(input);
  const plans=base.recording.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:team.id==='you'?'you-5':null}));
  const assisted=createV93PlayableTest(input,{plans});
  const line=(race,id)=>race.individualLine.conditionalCrossings.find(
    row=>row.riderId===id);
  assert.deepEqual(assisted.recording,base.recording);
  assert.deepEqual(assisted.clock,base.clock);
  assert.ok(assisted.individualLine.bandRunners[0].runner.frames.some(
    frame=>frame.riders.some(row=>row.riderId==='you-5'&&
      row.role==='lead_out'&&row.energySpent>0)));
  assert.ok(line(assisted,'you-7').elapsedSecondsFromLastKmStart<
    line(base,'you-7').elapsedSecondsFromLastKmStart);
  assert.deepEqual(line(assisted,'rival-2-0'),
    line(base,'rival-2-0'));
  assert.equal(validateV93CoastedPlaytest(input,{plans},assisted),true);
  const changed=structuredClone(assisted);
  changed.clock.passageFrames[0].droppedPassages[0]
    .passageSecondsFromBunchMarker+=1;
  assert.throws(()=>validateV93CoastedPlaytest(input,{plans},changed),
    /does not replay/);
});

test('a late catch with several dropped riders keeps crossings but withholds contact points',()=>{
  const input={...settings('M','flat'),seed:'multi-manager-audit-1',
    defaultRivalPlan:'neutral',effort:'steady',attack:'repeated',
    chase:'ignore',managerTactics:[
      {effort:'hard',attack:'repeated',chase:'ignore'},
      {effort:'conserve',attack:'none',chase:'all'}]};
  const race=createV93PlayableTest(input,{pointContext:context},
    {resolveIsolatedPasses:false});
  const source=race.recording.frames.at(-2);
  assert.equal(source.roadGroups.length,0);
  assert.ok(source.chasers.length>0);
  assert.equal(source.engagedChaseTeamIds.length,0);
  assert.equal(source.riderGroups.filter(row=>row.group==='dropped').length,3);
  assert.equal(race.version,V93_COAST_NO_FRONT_PLAYTEST_VERSION);
  assert.equal(race.clock.passageFrames.at(-1).droppedPassages.length,3);
  assert.equal(race.individualLine.conditionalCrossings.length,32);
  assert.equal(race.individualLine.bandRunners.length,4);
  assert.equal(race.individualLine.pre500Audit.status,
    'potential_longitudinal_overlap');
  assert.deepEqual(race.pointPreview,{
    status:'unavailable',
    reason:'Potential road-band contact leaves no defensible point order.',
    pointsStatus:'withheld',canCommitAwards:false});
  assert.equal(validateV93CoastedPlaytest(input,
    {pointContext:context},race),true);
});

test('a 20-team coasted road with overlapping isolated riders withholds points',()=>{
  const input={distanceKm:260,teamCount:20,gender:'M',terrain:'flat',
    fatigue:15,seed:'v93-seed-audit-0',defaultRivalPlan:'neutral',
    effort:'hard',attack:'repeated',chase:'ignore'};
  const race=createV93PlayableTest(input,{pointContext:context});
  assert.equal(race.version,V93_COAST_NO_FRONT_PLAYTEST_VERSION);
  assert.equal(race.recording.frames.at(-2).roadGroups.length,0);
  assert.equal(race.recording.frames.at(-2).riderGroups.filter(row=>
    row.group==='dropped').length,6);
  assert.equal(race.individualLine.bandRunners.length,7);
  assert.equal(race.individualLine.conditionalCrossings.length,160);
  assert.equal(race.individualLine.pre500Audit.status,
    'potential_longitudinal_overlap');
  assert.equal(race.individualLine.overlapAudit.status,
    'potential_longitudinal_overlap');
  assert.equal(race.pointPreview.status,'unavailable');
  assert.equal(race.pointsStatus,'withheld');
  assert.equal(race.canCommitAwards,false);
  assert.equal(validateV93CoastedPlaytest(input,
    {pointContext:context},race),true);
});

test('the v93 no-front coast clock rejects an older recording',()=>{
  const older=simulateTacticalTour(prepareV91Playtest(
    settings('M','mountain')));
  assert.throws(()=>recordFinaleCoastNoFrontDroppedLastKmClock(older),
    /needs a v93 source/);
});

test('a new boundary drop keeps its solo travel, crossing and replay',()=>{
  for(const gender of ['M','F'])
    for(const terrain of ['flat','exposed']){
      const input={distanceKm:260,teamCount:4,gender,terrain,
        fatigue:30,seed:'multi-manager-audit-1',
        defaultRivalPlan:'neutral',effort:'conserve',attack:'none',
        chase:'ignore',managerTactics:[
          {effort:'hard',attack:'repeated',chase:'ignore'},
          {effort:'conserve',attack:'none',chase:'all'}]};
      const race=createV93PlayableTest(input,{pointContext:context});
      assert.throws(()=>recordFinaleCoastNoFrontDroppedLastKmClock(
        race.recording),/Newly exhausted finale riders/);
      const source=race.recording.frames.at(-2);
      const sourceDrops=source.riderGroups.filter(row=>
        row.group==='dropped');
      const newDrops=race.clock.trace.exhaustionDrops;
      assert.equal(race.version,V93_DYNAMIC_NO_FRONT_PLAYTEST_VERSION);
      assert.equal(source.roadGroups.length,0);
      assert.equal(sourceDrops.length,3);
      assert.equal(newDrops.length,1);
      assert.equal(newDrops[0].atDistanceM,259000);
      assert.equal(race.clock.trace.finalDroppedRiderIds.length,4);
      assert.equal(race.clock.passageFrames.length,7);
      assert.equal(race.clock.passageFrames.at(-1)
        .droppedPassages.length,4);
      assert.equal(race.individualLine.conditionalCrossings.length,32);
      assert.equal(race.individualLine.bandRunners.length,5);
      assert.equal(race.individualLine.pre500Audit.status,
        'unresolved_new_drops');
      assert.equal(race.individualLine.provisionalLineOrder,null);
      assert.equal(race.pointPreview.status,'unavailable');
      const droppedId=newDrops[0].riderId;
      const summary=summarizeV93CoastedPlaytest(race);
      assert.deepEqual(summary.unresolvedBunchExits,[{
        atDistanceM:259000,riderIds:[droppedId],
        distinctLineTimes:1}]);
      const solo=race.individualLine.bandRunners.find(band=>
        band.roadBandId===`isolated:${droppedId}`);
      assert.equal(solo.runner.frames.length,5);
      assert.equal(solo.runner.finishers[0].energyAtLine,0);
      assert.ok(solo.runner.frames.every(frame=>
        frame.riders[0].energySpent===0&&
        frame.riders[0].activeDistanceM===100));
      assert.equal(validateV93CoastedPlaytest(input,
        {pointContext:context},race),true);
    }
});
