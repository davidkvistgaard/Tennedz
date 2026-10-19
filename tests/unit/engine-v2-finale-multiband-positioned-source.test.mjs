import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {finaleSnapshotFromTour} from
  '../../lib/engine/v2/finale-snapshot.mjs';
import {resolveFinaleMultibandPositionedSource,
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
