import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateFeed,createSampler,commentaryAt,raceGroups} from
  '@pelotonia/race-viewer/data';
import {syntheticExhibitionV1} from
  '../../lib/viewer/synthetic-exhibition-v1.mjs';

for(const category of ['men','women'])
  test(`separate ${category} visual exhibition is valid and fictional`,()=>{
    const source=JSON.parse(readFileSync(new URL(
      `../../data/viewer/physical-40km-${category}-v1.json`,
      import.meta.url))).feed;
    const {feed,coverage}=syntheticExhibitionV1(source);
    assert.deepEqual(validateFeed(feed),feed);
    assert.equal(feed.riderCategory,category);
    assert.equal(feed.synthetic,true);
    assert.equal(feed.duration,240);
    assert.equal(feed.results,undefined);
    assert.equal(feed.riders.length,32);
    assert.equal(coverage.paidRiderKilometres,0);
    const opening=createSampler(feed)(0);
    assert.equal(new Set(opening.positions.map(row=>row.groupId)).size,4);
    assert.deepEqual(raceGroups(opening.positions).map(group=>group.id),
      ['front','chase','main','dropped']);
    const finish=createSampler(feed)(236);
    assert.equal(finish.positions.length,32);
    assert.equal(new Set(finish.positions.map(row=>row.groupId)).size,4);
    assert.ok(commentaryAt(feed,239).every(row=>row.time<240));
    assert.match(commentaryAt(feed,240).at(-1).text,/No race result/);
  });
