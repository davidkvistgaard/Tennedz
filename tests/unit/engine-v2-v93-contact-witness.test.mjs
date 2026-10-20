import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

const settings={distanceKm:260,teamCount:4,gender:'M',terrain:'flat',
  fatigue:15,seed:'v93-diversity-1',defaultRivalPlan:'mixed',
  attack:'selective',chase:'all',effort:'steady',
  profileHeightsM:[100,350,150,500,180,100]};
const input={pointContext:{tier:1,divisionIndex:1,divisionCount:1}};

test('unresolved contact names the paid crossing and both replay riders',()=>{
  for(const options of [input,{}]){
    const race=createV93PlayableTest(settings,options);
    const summary=summarizeV93CoastedPlaytest(race);
    const contact=summary.potentialRoadContact;
    assert.equal(summary.pointPreview?.status,
      options===input?'unavailable':undefined);
    assert.equal(summary.provisionalLineOrder,null);
    assert.equal(contact.sourcePhase,'paid_first_500m');
    assert.deepEqual(contact.riderIds,['rival-1-3','rival-1-4']);
    assert.deepEqual(contact.roadBandIds,
      ['isolated:rival-1-3','isolated:rival-1-4']);
    assert.ok(contact.distanceM>259000&&contact.distanceM<259250);
    assert.equal(contact.contactResolved,false);
    for(let index=0;index<2;index++){
      const crossing=summary.lineTimes.find(row=>
        row.riderId===contact.riderIds[index]);
      const replay=summary.bandReplays.find(row=>
        row.id===contact.roadBandIds[index]);
      assert.equal(crossing.roadBandId,replay.id);
      assert.ok(replay.frames.at(-1).riders.some(row=>
        row.riderId===crossing.riderId));
    }
    assert.equal(validateV93CoastedPlaytest(settings,options,race),true);
  }
});
