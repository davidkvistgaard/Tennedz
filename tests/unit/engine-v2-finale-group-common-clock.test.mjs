import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {finaleSnapshotFromTour} from
  '../../lib/engine/v2/finale-snapshot.mjs';
import {simulateFinaleCooperativeGroupCommonClock,
  validateFinaleCooperativeGroupCommonClock} from
  '../../lib/engine/v2/finale-group-common-clock.mjs';
import {FINALE_WORKER_PASSIVE_SLOPE_VERSION} from
  '../../lib/engine/v2/finale-worker.mjs';

function source({distanceKm=40,gender='M',teamCount=4}={}){
  const {recording}=createV91Playtest({distanceKm,
    terrain:distanceKm===40?'flat':'rolling',
    fatigue:distanceKm===40?0:15,gender,teamCount,
    seed:'coverage-1',defaultRivalPlan:'attack',
    attack:'repeated',chase:'ignore'});
  const snapshot=finaleSnapshotFromTour(recording,{
    remainingKm:1,includeAttackLoad:true});
  return {route:recording.route,snapshot,
    teams:recording.committedInputs.teams,
    frontPullRiderId:null,chasePullRiderId:null,
    passiveChase:true,cooperativeFront:true,
    paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION};
}

test('paid break and bunch passages align on one elapsed clock',()=>{
  for(const settings of [
    {distanceKm:40,gender:'M',teamCount:4},
    {distanceKm:40,gender:'F',teamCount:20},
    {distanceKm:120,gender:'F',teamCount:15}]){
    const input=source(settings);
    const clock=simulateFinaleCooperativeGroupCommonClock(input);
    assert.equal(clock.version,'v2-finale-group-common-clock-1');
    assert.equal(clock.line.outcome,'survived');
    assert.equal(clock.roadFrames.length,8);
    assert.equal(clock.roadFrames[0].elapsedSecondsFromBunchMarker,0);
    assert.equal(clock.roadFrames[0].bunchPositionM,
      settings.distanceKm*1000-1000);
    assert.ok(clock.roadFrames[0].frontPositionM>
      clock.roadFrames[0].bunchPositionM);
    for(const [index,frame] of clock.roadFrames.entries()){
      assert.ok(frame.frontPositionM>=frame.bunchPositionM-1e-7);
      assert.ok(frame.frontPositionM<=settings.distanceKm*1000);
      assert.equal(frame.frontRiderEnergy.length,
        input.snapshot.roadGroups[0].riderIds.length);
      assert.equal(frame.bunchRiderEnergy.length,
        settings.teamCount*8-frame.frontRiderEnergy.length);
      if(index)assert.ok(frame.elapsedSecondsFromBunchMarker>
        clock.roadFrames[index-1].elapsedSecondsFromBunchMarker);
    }
    assert.ok(clock.frontLineTime<clock.bunchLineTime);
    assert.equal(clock.roadFrames.at(-1).frontPositionM,
      settings.distanceKm*1000);
    assert.equal(clock.roadFrames.at(-1).bunchPositionM,
      settings.distanceKm*1000);
    assert.equal(clock.classifiedResults,null);
    assert.equal(clock.pointsStatus,'withheld');
    assert.equal(validateFinaleCooperativeGroupCommonClock(input,clock),true);
    const altered=structuredClone(clock);
    altered.roadFrames[0].frontPositionM+=1;
    assert.throws(()=>validateFinaleCooperativeGroupCommonClock(
      input,altered),/does not replay/);
  }
});

test('a front group may finish before the bunch passes the kilometre marker',()=>{
  const input=source({distanceKm:120,gender:'M',teamCount:4});
  const clock=simulateFinaleCooperativeGroupCommonClock(input);
  assert.ok(clock.frontLineTime<0);
  assert.equal(clock.roadFrames[0].frontPositionM,120000);
  assert.equal(clock.roadFrames[0].frontRiderEnergy.length,
    input.snapshot.roadGroups[0].riderIds.length);
  assert.ok(clock.bunchLineTime>0);
});

test('exact catch meets on the common clock and pays merged travel',()=>{
  const input=source();
  input.snapshot.roadGroups[0].gapSeconds=.1;
  const front=new Set(input.snapshot.roadGroups[0].riderIds);
  input.teams=structuredClone(input.teams);
  for(const team of input.teams)for(const rider of team.riders)
    for(const skill of ['flat','strength','endurance','timetrial','sprint'])
      rider[skill]=front.has(rider.id)?20:100;
  const clock=simulateFinaleCooperativeGroupCommonClock(input);
  assert.equal(clock.line.outcome,'caught_merged');
  const contact=clock.roadFrames.find(frame=>frame.contact);
  assert.ok(contact);
  assert.ok(Math.abs(contact.frontPositionM-
    contact.bunchPositionM)<1e-7);
  assert.equal(contact.bunchPositionM,clock.line.catchDistanceM);
  assert.equal(clock.roadFrames.at(-1).frontPositionM,null);
  assert.equal(clock.roadFrames.at(-1).bunchPositionM,40000);
  assert.equal(clock.roadFrames.at(-1).bunchRiderEnergy.length,32);
  assert.equal(clock.frontLineTime,null);
  assert.equal(clock.pointsStatus,'withheld');
  assert.equal(validateFinaleCooperativeGroupCommonClock(input,clock),true);
});
