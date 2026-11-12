import test from 'node:test';
import assert from 'node:assert/strict';
import {winterPositionPointsPreviewV1} from
  '../../lib/race/winter-position-points-preview-v1.mjs';
import {positionGameViewerFixture} from
  '../support/position-game-viewer-fixture.mjs';

function documentWithCrossings(count=16){
  const riders=Array.from({length:count},(_,i)=>({
    id:`r${i}`,name:`Rider ${i}`,teamId:`t${Math.floor(i/8)}`}));
  const entries=riders.map((row,i)=>({riderId:row.id,
    clockSeconds:i+1}));
  // The fixture tie is at zero-based indexes 2 and 3.
  entries[3].clockSeconds=3;
  return {input:{officialResults:false},
    coverage:{officialResults:false},
    feed:{riders,teams:Array.from({length:count/8},(_,i)=>({
      id:`t${i}`,name:`Team ${i}`}))},
    finishEvidence:{version:
      'physical-first-position-finish-evidence-1',entries,
      unresolvedModelClockTies:[{riderIds:['r2','r3']}]}};
}

test('shares points for recorded clock ties without awarding them',()=>{
  const preview=winterPositionPointsPreviewV1(
    documentWithCrossings());
  assert.equal(preview.official,false);
  assert.equal(preview.awarded,false);
  assert.equal(preview.unresolvedTieRiders,2);
  assert.deepEqual(preview.riders.slice(0,4)
    .map(row=>[row.recordedRank,row.points,row.tied]),
    [[1,16,false],[2,15,false],
      [3,14,true],[3,14,true]]);
  assert.equal(preview.teams.reduce((sum,row)=>
    sum+row.points,0),preview.riders.reduce((sum,row)=>
    sum+row.points,0));
});

test('refuses missing crossings and contradictory tie evidence',()=>{
  const source=documentWithCrossings();
  source.finishEvidence.entries.pop();
  assert.throws(()=>winterPositionPointsPreviewV1(source),
    /cannot support/);
  const changed=documentWithCrossings();
  changed.finishEvidence.unresolvedModelClockTies=[];
  assert.throws(()=>winterPositionPointsPreviewV1(changed),
    /ties changed/);
});

test('reads a complete paid viewer recording',()=>{
  const {document}=positionGameViewerFixture();
  const preview=winterPositionPointsPreviewV1(document);
  assert.equal(preview.riders.length,document.feed.riders.length);
  assert.equal(preview.teams.length,document.feed.teams.length);
  assert.equal(preview.unresolvedTieRiders,
    document.finishEvidence.unresolvedModelClockTies
      .reduce((sum,row)=>sum+row.riderIds.length,0));
});
