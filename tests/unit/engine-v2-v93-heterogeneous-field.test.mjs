import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

test('unequal-strength whole race refuses unresolved two-front exits',()=>{
  const teamCount=4;
  const settings={distanceKm:260,teamCount,gender:'M',terrain:'flat',
    fatigue:30,seed:'v93-heterogeneous-4-M-flat-30',
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
    managerTactics:Array.from({length:teamCount-1},(_,index)=>({
      effort:['hard','steady','conserve'][index%3],
      attack:index%3===0?'repeated':'selective',
      chase:index%3===1?'all':'selective'})),
    teamOverrides:[{teamId:'you',level:45},
      ...Array.from({length:teamCount-1},(_,index)=>({
        teamId:`rival-${index+1}`,level:index%2===0?25:65}))],
    managerFinaleOrders:[
      {teamId:'you',atKm:255,effort:'steady',chase:'all'},
      {teamId:'rival-1',atKm:255,effort:'hard'}]};
  let refusal;
  try{createV93PlayableTest(settings);}catch(error){refusal=error;}
  assert.match(refusal?.message??'',
    /The depleted line bands crossed without contact/);
  assert.equal(refusal.roadPreview.unsupportedReason,
    'unresolved_band_contact');
  assert.deepEqual(refusal.roadPreview.kilometreFrames.at(-1)
    .roadGroups.map(row=>[row.id,row.riderIds.length]),
  [['road-2',4],['road-4',4]]);
  assert.equal(refusal.roadPreview.lastKmRoad.length,0);
  assert.equal(refusal.roadPreview.lineTimes,null);
  assert.equal(refusal.roadPreview.pointsStatus,'withheld');
  assert.equal(refusal.roadPreview.canCommitAwards,false);
});
