import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91Playtest,prepareV91Playtest} from
  '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleCoastDynamicNoFrontLastKmClock} from
  '../../lib/engine/v2/finale-separated-last-km.mjs';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,V93_LATE_BUNCH_EXIT_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {finaleSnapshotFromTour} from
  '../../lib/engine/v2/finale-snapshot.mjs';
import {resolveFinaleMultibandPositionedSource,
  resolveFinaleDynamicNoFrontPositionedSource,
  validateFinaleMultibandPositionedSource} from
  '../../lib/engine/v2/finale-multiband-positioned-source.mjs';

function tour({distanceKm=40,gender='M',teamCount=4,
  attack='repeated',chase='ignore'}={}){
  return createV91Playtest({distanceKm,
    terrain:distanceKm===40?'flat':distanceKm===120?'rolling':'mountain',
    fatigue:distanceKm===40?0:distanceKm===120?15:30,
    gender,teamCount,seed:'test-drive-acceptance-1',
    defaultRivalPlan:attack==='repeated'?'attack':'chase',
    attack,chase}).recording;
}

test('all road bands get distinct provisional wheels behind their own edge',()=>{
  for(const settings of [
    {distanceKm:40,gender:'M',teamCount:4},
    {distanceKm:40,gender:'F',teamCount:20},
    {distanceKm:120,gender:'M',teamCount:15},
    {distanceKm:120,gender:'F',teamCount:4},
    {distanceKm:260,gender:'M',teamCount:4},
    {distanceKm:260,gender:'F',teamCount:20}]){
    const recording=tour(settings);
    const snapshot=finaleSnapshotFromTour(recording,{
      remainingKm:1,includeAttackLoad:true});
    const source=resolveFinaleMultibandPositionedSource(recording);
    const expectedGroups=[...snapshot.roadGroups.map(group=>group.id),
      'peloton'];
    assert.deepEqual(source.roadBands.map(band=>band.id),expectedGroups);
    assert.equal(source.roadBands.at(-1)
      .passageSecondsFromBunchMarker,0);
    const state=new Map(snapshot.riders.map(row=>[row.riderId,row]));
    const slots=source.roadBands.flatMap(band=>{
      assert.equal(band.edgeDistanceM,source.startDistanceM);
      assert.ok(band.passageSecondsFromBunchMarker<=0);
      return band.slots.map(slot=>{
        assert.equal(state.get(slot.riderId).roadGroupId,band.id);
        assert.equal(slot.energy,state.get(slot.riderId).energy);
        assert.ok(slot.positionM<=band.edgeDistanceM);
        assert.ok(slot.positionM>=band.edgeDistanceM-100);
        return slot;
      });
    });
    assert.equal(slots.length,settings.teamCount*8);
    assert.equal(new Set(slots.map(slot=>slot.riderId)).size,
      slots.length);
    assert.equal(source.classifiedResults,null);
    assert.equal(source.pointsStatus,'withheld');
    assert.equal(source.canCommitAwards,false);
    assert.equal(validateFinaleMultibandPositionedSource(
      recording,source),true);
    const altered=structuredClone(source);
    altered.roadBands[0].slots[0].positionM+=1;
    assert.throws(()=>validateFinaleMultibandPositionedSource(
      recording,altered),/does not replay/);
  }
});

test('a complete bunch cannot masquerade as a multiband source',()=>{
  const recording=tour({attack:'none',chase:'all'});
  assert.throws(()=>resolveFinaleMultibandPositionedSource(recording),
    /needs road groups/);
});

test('a mixed 260 km road carries late bunch exits through the line',()=>{
  const settings={distanceKm:260,teamCount:20,
    gender:'F',terrain:'rolling',fatigue:15,seed:'v93-tactic-pair-11',
    effort:'steady',attack:'repeated',chase:'selective',
    defaultRivalPlan:'passive',managerTactics:Array.from({length:19},
      (_row,index)=>[
        {effort:'hard',attack:'none',chase:'all'},
        {effort:'steady',attack:'selective',chase:'ignore'},
        {effort:'conserve',attack:'none',chase:'selective'}]
        [index%3])};
  const prepared=prepareV91Playtest(settings);
  const recording=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:prepared.teams,seed:prepared.seed,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  const clock=recordFinaleCoastDynamicNoFrontLastKmClock(recording);
  const positioned=resolveFinaleDynamicNoFrontPositionedSource(
    recording,clock);
  assert.equal(positioned.version,
    'v2-finale-coast-late-bunch-exit-positioned-source-lab-9');
  assert.deepEqual(positioned.lateBunchExits,[
      {riderId:'rival-1-5',atDistanceM:259700},
      {riderId:'rival-13-5',atDistanceM:259700}]);
  const pointContext={tier:2,divisionCount:2,divisionIndex:1};
  const race=createV93PlayableTest(settings,{pointContext});
  assert.equal(race.version,V93_LATE_BUNCH_EXIT_PLAYTEST_VERSION);
  assert.equal(validateV93CoastedPlaytest(settings,{pointContext},race),true);
  const summary=summarizeV93CoastedPlaytest(race);
  assert.equal(summary.lineTimes.length,160);
  assert.equal(summary.bandReplays.length,17);
  assert.ok(summary.bandReplays.every(band=>
    Number.isFinite(band.passageAt500Seconds)));
  assert.equal(summary.pointPreview.status,'unavailable');
  assert.equal(summary.pointsStatus,'withheld');
  assert.equal(summary.canCommitAwards,false);
  const line=new Map(summary.lineTimes.map(row=>[row.riderId,row]));
  const replayed=new Set();
  for(const band of summary.bandReplays)
    for(const row of band.frames.at(-1).riders){
      assert.equal(replayed.has(row.riderId),false);
      replayed.add(row.riderId);
      assert.equal(row.elapsedToLineSeconds,
        line.get(row.riderId).elapsedSecondsFromLastKmStart);
      assert.equal(row.energyAfter,line.get(row.riderId).energyAtLine);
    }
  assert.equal(replayed.size,160);
  for(const id of ['rival-1-5','rival-13-5']){
    const replay=summary.bandReplays.find(row=>
      row.id===`isolated:${id}`);
    assert.deepEqual(replay.frames.map(frame=>
      frame.riders[0].role),
    ['sheltered','sheltered','dropped','dropped','dropped']);
    assert.ok(replay.frames.slice(0,2).every(frame=>
      frame.riders[0].shelteredSeconds===frame.durationSeconds&&
      frame.riders[0].shelteredDistanceM===100&&
      frame.riders[0].activeSeconds===0));
    for(const frame of replay.frames){
      const trace=clock.trace.frames.find(row=>
        row.endDistanceM===frame.endDistanceM);
      const state=trace.riders.find(row=>row.riderId===id);
      const passage=clock.passageFrames.find(row=>
        row.distanceM===frame.endDistanceM);
      const paidTime=trace.pelotonRiderIds.includes(id)?
        passage.bunchPassageSecondsFromBunchMarker:
        passage.droppedPassages.find(row=>row.riderId===id)
          .passageSecondsFromBunchMarker;
      assert.equal(frame.elapsedSecondsAtStart+frame.durationSeconds,
        paidTime);
      assert.equal(frame.riders[0].energyAfter,state.energy);
      assert.equal(frame.riders[0].energySpent,state.energySpent);
    }
    assert.equal(line.get(id).energyAtLine,0);
    assert.equal(line.get(id).elapsedSecondsFromLastKmStart,
      clock.passageFrames.at(-1).droppedPassages.find(row=>
        row.riderId===id).passageSecondsFromBunchMarker);
  }
});
