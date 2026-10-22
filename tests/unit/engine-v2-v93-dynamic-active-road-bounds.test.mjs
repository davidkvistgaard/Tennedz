import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,V93_DYNAMIC_ACTIVE_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {projectFinaleDynamicActiveRoadBounds,
  validateFinaleDynamicActiveRoadBounds} from
  '../../lib/engine/v2/finale-dynamic-active-road-bounds.mjs';

const settings=(teamCount,gender)=>({distanceKm:260,teamCount,
  gender,terrain:'custom',fatigue:15,
  seed:teamCount===15?'v93-diversity-1':'v93-diversity-3',
  defaultRivalPlan:'chase',attack:'repeated',
  chase:teamCount===15?'all':'ignore',effort:'steady',
  profileHeightsM:[100,350,150,500,180,100]});

test('paid front has a bounded conditional place while new bunch drops remain unresolved',()=>{
  for(const [teamCount,gender] of [[15,'F'],[20,'M']]){
    const input=settings(teamCount,gender);
    const options={pointContext:{tier:3,divisionIndex:1,divisionCount:1}};
    const race=createV93PlayableTest(input,options);
    const summary=summarizeV93CoastedPlaytest(race);
    const bounds=summary.roadPlaceBounds;
    assert.equal(race.version,V93_DYNAMIC_ACTIVE_PLAYTEST_VERSION);
    assert.deepEqual(bounds.bands.map(row=>[
      row.firstPossiblePlace,row.lastPossiblePlace]),[
      [1,2],[3,teamCount*8]]);
    assert.equal(bounds.riders.length,teamCount*8);
    assert.equal(bounds.pointsStatus,'withheld');
    assert.equal(bounds.canCommitAwards,false);
    assert.equal(race.pointPreview.status,'unavailable');
    assert.deepEqual(summary.unresolvedBunchExits.map(wave=>({
      atDistanceM:wave.atDistanceM,
      riderCount:wave.riderIds.length,
      distinctLineTimes:wave.distinctLineTimes})),[
      {atDistanceM:259000,riderCount:teamCount===15?6:9,
        distinctLineTimes:1},
      {atDistanceM:259250,riderCount:teamCount===15?4:5,
        distinctLineTimes:1}]);
    for(const wave of summary.unresolvedBunchExits)
      for(const riderId of wave.riderIds)
        assert.equal(summary.lineTimes.find(row=>row.riderId===riderId)
          .roadBandId,`isolated:${riderId}`);
    assert.equal(validateFinaleDynamicActiveRoadBounds(race.recording,
      race.clock,race.individualLine,bounds),true);
    assert.equal(validateV93CoastedPlaytest(input,options,race),true);
  }
});

test('a changed crossing cannot forge a separated front range',()=>{
  const race=createV93PlayableTest(settings(15,'F'));
  const frontId=race.clock.line.bands[0].riderIds[0];
  const crossings=race.individualLine.conditionalCrossings.map(row=>
    row.riderId===frontId?{...row,elapsedSecondsFromLastKmStart:999}:row);
  assert.throws(()=>projectFinaleDynamicActiveRoadBounds(race.recording,
    race.clock,{...race.individualLine,conditionalCrossings:crossings}),
  /contradict the separated front/);
});
