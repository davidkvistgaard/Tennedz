import test from 'node:test';
import assert from 'node:assert/strict';
import {recordFinaleMultibandOverlapAudit,
  validateFinaleMultibandOverlapAudit} from
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
