import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateFeed,createSampler,commentaryAt} from
  '@pelotonia/race-viewer/data';

for(const category of ['men','women'])
  test(`production-base viewer recording ${category} is complete`,()=>{
    const {feed,coverage,sourceCommit,version}=JSON.parse(readFileSync(
      new URL(`../../data/viewer/physical-40km-${category}-v1.json`,
        import.meta.url)));
    assert.deepEqual(validateFeed(feed),feed);
    assert.equal(sourceCommit,
      '21d1fbf84f571b5155d937296a6c87bfa92b8510');
    assert.equal(version,'physical-first-to-pelotonia.viewer.v1-1');
    assert.equal(coverage.paidRiderKilometres,1280);
    assert.equal(feed.riders.length,32);
    assert.equal(feed.frames.length,41);
    assert.equal(feed.results,undefined);
    const sample=createSampler(feed);
    for(const [at,distance] of [[0,0],[feed.frames[20].time,20000],
      [feed.duration,40000]]){
      const state=sample(at);
      assert.equal(state.positions.length,32);
      assert.ok(state.positions.every(row=>row.distance===distance));
      assert.equal(state.results,null);
      assert.ok(commentaryAt(feed,at).every(row=>row.time<=at));
    }
    assert.equal(commentaryAt(feed,0).some(row=>
      row.text.includes('leads kilometre')),false);
    assert.equal(commentaryAt(feed,feed.duration).at(-1).text,
      'All recorded riders reach the finish.');
  });
