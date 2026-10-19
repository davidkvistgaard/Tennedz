import test from 'node:test';
import assert from 'node:assert/strict';
import {recordFinaleMultibandOverlapAudit,
  validateFinaleMultibandOverlapAudit,
  recordFinaleAllBandOverlapAudit,
  validateFinaleAllBandOverlapAudit,
  recordFinaleUnorderedBandOverlapAudit} from
  '../../lib/engine/v2/finale-multiband-overlap-audit.mjs';

function band(id,riderId,startM,distanceM){
  return {roadBandId:id,runner:{frames:[{
    elapsedSecondsAtStart:0,durationSeconds:10,
    riders:[{riderId,role:'sheltered',positionBeforeM:startM,
      positionM:startM+distanceM,activeSeconds:10,
      activeDistanceM:distanceM,shelteredSeconds:0,
      shelteredDistanceM:0,elapsedToLineSeconds:null}]}]}};
}

test('the first longitudinal meeting is measured on one clock',()=>{
  const bands=[band('break','front',100,10),
    band('peloton','bunch',90,30)];
  const audit=recordFinaleMultibandOverlapAudit(bands);
  assert.equal(audit.status,'potential_longitudinal_overlap');
  assert.equal(audit.firstPotentialOverlap.frontRiderId,'front');
  assert.equal(audit.firstPotentialOverlap.bunchRiderId,'bunch');
  assert.ok(Math.abs(audit.firstPotentialOverlap
    .elapsedSecondsFromLastKmStart-5)<1e-8);
  assert.ok(Math.abs(audit.firstPotentialOverlap.distanceM-105)<1e-8);
  assert.equal(audit.contactResolved,false);
  assert.equal(audit.classifiedResults,null);
  assert.equal(audit.canCommitAwards,false);
  assert.equal(validateFinaleMultibandOverlapAudit(bands,audit),true);
  const altered=structuredClone(audit);
  altered.firstPotentialOverlap.distanceM+=1;
  assert.throws(()=>validateFinaleMultibandOverlapAudit(bands,altered),
    /does not replay/);
});

test('separate trajectories retain an explicit no-overlap finding',()=>{
  const audit=recordFinaleMultibandOverlapAudit([
    band('break','front',100,10),
    band('peloton','bunch',90,5)]);
  assert.equal(audit.status,'separated_through_conditional_lines');
  assert.equal(audit.firstPotentialOverlap,null);
  assert.equal(audit.pointsStatus,'withheld');
});

test('several bands report the earliest potential meeting with both identities',()=>{
  const bands=[band('front','front-rider',100,10),
    band('middle','middle-rider',90,30),
    band('peloton','bunch-rider',70,45)];
  const audit=recordFinaleAllBandOverlapAudit(bands);
  assert.equal(audit.status,'potential_longitudinal_overlap');
  assert.equal(audit.firstPotentialOverlap.aheadRoadBandId,'front');
  assert.equal(audit.firstPotentialOverlap.behindRoadBandId,'middle');
  assert.ok(Math.abs(audit.firstPotentialOverlap
    .elapsedSecondsFromLastKmStart-5)<1e-8);
  assert.equal(validateFinaleAllBandOverlapAudit(bands,audit),true);
  const altered=structuredClone(audit);
  altered.firstPotentialOverlap.behindRoadBandId='peloton';
  assert.throws(()=>validateFinaleAllBandOverlapAudit(bands,altered),
    /does not replay/);
});

test('isolated rider ID order cannot create a longitudinal meeting',()=>{
  const behind=band('isolated:1','rider-1',90,10);
  const ahead=band('isolated:2','rider-2',100,10);
  const reversed=recordFinaleUnorderedBandOverlapAudit([behind,ahead]);
  assert.equal(reversed.status,'separated_through_conditional_lines');
  assert.equal(reversed.firstPotentialOverlap,null);
  assert.deepEqual(recordFinaleUnorderedBandOverlapAudit([ahead,behind])
    .firstPotentialOverlap,null);
  const catchAudit=recordFinaleUnorderedBandOverlapAudit([
    band('isolated:1','rider-1',90,30),ahead]);
  assert.equal(catchAudit.status,'potential_longitudinal_overlap');
  assert.ok(Math.abs(catchAudit.firstPotentialOverlap
    .elapsedSecondsFromLastKmStart-5)<1e-8);
});
