import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {finaleSnapshotFromTour} from
  '../../lib/engine/v2/finale-snapshot.mjs';
import {simulateFinaleGroupToLine,validateFinaleGroupToLine} from
  '../../lib/engine/v2/finale-group-run.mjs';
import {FINALE_WORKER_PASSIVE_SLOPE_VERSION} from
  '../../lib/engine/v2/finale-worker.mjs';

test('a recorded single break and whole bunch pay the final kilometre',()=>{
  for(const variation of [
    {distanceKm:40,terrain:'flat',fatigue:0,teamCount:4,gender:'M'},
    {distanceKm:40,terrain:'flat',fatigue:0,teamCount:4,gender:'F'},
    {distanceKm:120,terrain:'rolling',fatigue:15,teamCount:15,gender:'M'},
    {distanceKm:120,terrain:'rolling',fatigue:15,teamCount:15,gender:'F'}]){
    const {recording}=createV91Playtest({...variation,
      seed:'coverage-1',defaultRivalPlan:'attack',
      attack:'repeated',chase:'ignore'});
    const snapshot=finaleSnapshotFromTour(recording,{
      remainingKm:1,includeAttackLoad:true});
    assert.equal(snapshot.roadGroups.length,1);
    assert.deepEqual(snapshot.droppedRiderIds,[]);
    const input={route:recording.route,snapshot,
      teams:recording.committedInputs.teams,
      frontPullRiderId:snapshot.roadGroups[0].riderIds[0],
      chasePullRiderId:null,passiveChase:true,
      paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION};
    const line=simulateFinaleGroupToLine(input);
    assert.equal(line.version,'v2-finale-group-last-km-to-line-11');
    assert.equal(line.outcome,'survived');
    assert.equal(line.approachFrames.length,7);
    assert.equal(line.approachFrames[0].startDistanceM,
      variation.distanceKm*1000-1000);
    assert.equal(line.endDistanceM,variation.distanceKm*1000);
    assert.equal(line.finalRiderEnergy.length,variation.teamCount*8);
    assert.equal(line.resultStatus,'unclassified');
    assert.equal(line.pointsStatus,'withheld');
    assert.ok(Math.abs(line.lineBandTimesFromBunchLastKmStart.bunch-
      line.lineBandTimesFromBunchLastKmStart.front-
      line.finishGapSeconds)<1e-8);
    for(const rider of line.approachFrames[0].riders){
      const source=snapshot.riders.find(row=>
        row.riderId===rider.riderId);
      assert.ok(Math.abs(source.energy-rider.energy-
        rider.energySpent)<1e-8);
    }
    assert.equal(validateFinaleGroupToLine(input,line),true);
    const forged=structuredClone(line);
    forged.approachFrames[0].riders[0].energySpent+=.01;
    assert.throws(()=>validateFinaleGroupToLine(input,forged),
      /differs/);
  }
});

test('a constructed final-kilometre catch pays its merged remainder',()=>{
  const {recording}=createV91Playtest({distanceKm:40,terrain:'flat',
    fatigue:0,teamCount:4,gender:'M',seed:'coverage-1',
    defaultRivalPlan:'attack',attack:'repeated',chase:'ignore'});
  const snapshot=finaleSnapshotFromTour(recording,{
    remainingKm:1,includeAttackLoad:true});
  snapshot.roadGroups[0].gapSeconds=.1;
  const front=new Set(snapshot.roadGroups[0].riderIds);
  const teams=structuredClone(recording.committedInputs.teams);
  for(const team of teams)for(const rider of team.riders)
    for(const skill of ['flat','strength','endurance','timetrial','sprint'])
      rider[skill]=front.has(rider.id)?20:100;
  const input={route:recording.route,snapshot,teams,
    frontPullRiderId:snapshot.roadGroups[0].riderIds[0],
    chasePullRiderId:null,passiveChase:true,
    paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION};
  const line=simulateFinaleGroupToLine(input);
  assert.equal(line.outcome,'caught_merged');
  assert.ok(line.catchDistanceM>39000&&line.catchDistanceM<40000);
  assert.equal(line.mergedFrames[0].startDistanceM,
    line.catchDistanceM);
  assert.equal(line.endDistanceM,40000);
  assert.equal(line.finalRiderEnergy.length,32);
  assert.equal(line.lineBandTimesFromBunchLastKmStart,null);
  assert.equal(line.resultStatus,'unclassified');
  assert.equal(line.pointsStatus,'withheld');
  assert.equal(validateFinaleGroupToLine(input,line),true);
});
