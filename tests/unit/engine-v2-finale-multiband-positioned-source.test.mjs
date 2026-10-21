import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91Playtest,prepareV91Playtest} from
  '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleCoastDynamicNoFrontLastKmClock} from
  '../../lib/engine/v2/finale-separated-last-km.mjs';
import {createV93PlayableTest} from
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

test('a mixed 260 km road names unsupported late bunch exits',()=>{
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
  assert.throws(()=>resolveFinaleDynamicNoFrontPositionedSource(
    recording,clock),error=>{
    assert.match(error.message,/leaving the bunch after 500 m/);
    assert.equal(error.cause.firstLateExitDistanceM,259700);
    assert.equal(error.cause.metresToGo,300);
    assert.deepEqual(error.cause.riderIds,
      ['rival-1-5','rival-13-5']);
    return true;
  });
  assert.throws(()=>createV93PlayableTest(settings),error=>{
    const road=error.roadPreview;
    assert.equal(road.version,'v93-unsupported-road-preview-1');
    assert.deepEqual(road.exits,[
      {riderId:'rival-1-5',atDistanceM:259700},
      {riderId:'rival-13-5',atDistanceM:259700}]);
    assert.equal(road.kilometreFrames.length,259);
    assert.equal(road.lastKmRoad.at(-1).distanceM,260000);
    assert.equal(road.lineTimes,null);
    assert.equal(road.pointPreview.status,'unavailable');
    assert.equal(road.canCommitAwards,false);
    for(const frame of road.lastKmRoad)
      for(const row of frame.exitRiderEnergy)
        assert.ok(Number.isFinite(row.energy)&&row.energy>=0);
    return true;
  });
});
