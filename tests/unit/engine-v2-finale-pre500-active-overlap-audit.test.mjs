import test from 'node:test';
import assert from 'node:assert/strict';
import {recordFinalePre500ActiveOverlapAudit} from
  '../../lib/engine/v2/finale-pre500-active-overlap-audit.mjs';

const positioned={version:'fictional-position-source',startDistanceM:1000,
  roadBands:[
    {id:'break',passageSecondsFromBunchMarker:-10,
      slots:[{riderId:'front',positionM:1000,energy:10}]},
    {id:'peloton',passageSecondsFromBunchMarker:0,
      slots:[{riderId:'rear',positionM:1000,energy:10}]}]};

test('pre-500 audit records possible longitudinal contact without a result',()=>{
  const audit=recordFinalePre500ActiveOverlapAudit(positioned,[
    {endDistanceM:1250,bandTimes:[0,5],
      riderEnergy:[{riderId:'front',energy:9},
        {riderId:'rear',energy:9}]},
    {endDistanceM:1500,bandTimes:[10,10],
      riderEnergy:[{riderId:'front',energy:8},
        {riderId:'rear',energy:8}]}]);
  assert.equal(audit.status,'potential_longitudinal_overlap');
  assert.equal(audit.firstPotentialOverlap.distanceM,1500);
  assert.equal(audit.firstPotentialOverlap.aheadRiderId,'front');
  assert.equal(audit.firstPotentialOverlap.behindRiderId,'rear');
  assert.equal(audit.contactResolved,false);
  assert.equal(audit.classifiedResults,null);
  assert.equal(audit.pointsStatus,'withheld');
  assert.equal(audit.canCommitAwards,false);
});

test('pre-500 audit rejects discontinuous or unpaid active passages',()=>{
  assert.throws(()=>recordFinalePre500ActiveOverlapAudit(positioned,[
    {endDistanceM:1250,bandTimes:[0,5],riderEnergy:[
      {riderId:'front',energy:11},{riderId:'rear',energy:9}]},
    {endDistanceM:1500,bandTimes:[10,10],riderEnergy:[
      {riderId:'front',energy:8},{riderId:'rear',energy:8}]}]),
  /no paid passage/);
});
