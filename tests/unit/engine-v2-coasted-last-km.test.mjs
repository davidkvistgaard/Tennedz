import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_ENERGY_LEDGER_VERSION,MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleCoastDroppedLastKmClock,
  validateFinaleCoastDroppedLastKmClock} from
  '../../lib/engine/v2/finale-separated-last-km.mjs';

const terrains=['flat','rolling','mountain','exposed','custom'];
function source(terrain,gender,version=MOTOR_EXHAUSTION_COAST_VERSION){
  const {stage,weather,teams,seed}=prepareV91Playtest({distanceKm:260,
    terrain,gender,teamCount:4,fatigue:30,seed:'cross-route-1',
    defaultRivalPlan:'mixed',attack:'selective',chase:'selective',
    ...(terrain==='custom'?{profileHeightsM:[100,350,150,500,180,100]}:{})});
  return simulateTacticalTour({stage,weather,teams,seed,motorVersion:version});
}

test('v93 carries dropped deficits and sustainable travel to the line on ten roads',()=>{
  for(const terrain of terrains)for(const gender of ['M','F']){
    const race=source(terrain,gender);
    const result=recordFinaleCoastDroppedLastKmClock(race);
    assert.equal(validateFinaleCoastDroppedLastKmClock(race,result),true);
    const sourceFrame=race.frames.at(-2);
    const dropped=sourceFrame.riderGroups.filter(row=>row.group==='dropped');
    const line=result.trace.frames.at(-1);
    assert.ok(dropped.length>0);
    assert.equal(result.lineDistanceM,260000);
    assert.equal(line.endDistanceM,260000);
    assert.equal(result.trace.frames[0].startDistanceM,259000);
    assert.deepEqual([...result.trace.sourceDroppedRiderIds].sort(),
      dropped.map(row=>row.id).sort());
    assert.equal(result.line.riders.length,32);
    assert.ok(result.trace.frames.some(frame=>frame.droppedTravel.riders
      .some(row=>row.curtailedEnergyDemand>0&&
        row.sustainableFraction<1)));
    const prior=new Map(dropped.map(row=>[row.id,{
      deficitSeconds:row.deficitSeconds,energy:row.energy}]));
    let bunchTime=0;
    for(const frame of result.trace.frames){
      bunchTime+=frame.bunchElapsedSeconds;
      for(const row of frame.droppedTravel.riders){
        const before=prior.get(row.riderId);
        assert.ok(before);
        assert.ok(Math.abs(row.deficitSecondsBefore-
          before.deficitSeconds)<1e-7);
        assert.ok(Math.abs(row.energyBefore-before.energy)<1e-7);
        assert.ok(Math.abs(row.deficitSecondsAfter-
          (row.deficitSecondsBefore+row.elapsedSeconds-
            frame.bunchElapsedSeconds))<1e-7);
        assert.ok(row.energySpent<=row.energyBefore+1e-7);
        assert.ok(row.curtailedEnergyDemand>=-1e-7);
        assert.ok(row.unmetEnergyDemand===undefined);
        assert.ok(Math.abs(row.elapsedSeconds-
          (frame.endDistanceM-frame.startDistanceM)*3.6/
            row.speedKph)<1e-7);
        prior.set(row.riderId,{deficitSeconds:row.deficitSecondsAfter,
          energy:row.energyAfter});
      }
    }
    for(const row of result.passageFrames.at(-1).droppedPassages){
      const final=prior.get(row.riderId);
      assert.ok(Math.abs(row.deficitSeconds-final.deficitSeconds)<1e-7);
      assert.ok(Math.abs(row.passageSecondsFromBunchMarker-
        bunchTime-final.deficitSeconds)<1e-7);
    }
    assert.equal(result.pointsStatus,'withheld');
    assert.equal(result.canCommitAwards,false);
  }
});

test('coasted last-kilometre replay rejects altered road and older source',()=>{
  const race=source('flat','M');
  const result=recordFinaleCoastDroppedLastKmClock(race);
  const altered=structuredClone(result);
  altered.trace.frames[0].droppedTravel.riders[0].elapsedSeconds+=1;
  assert.throws(()=>validateFinaleCoastDroppedLastKmClock(race,altered),
    /does not replay/);
  assert.throws(()=>recordFinaleCoastDroppedLastKmClock(
    source('flat','M',MOTOR_ENERGY_LEDGER_VERSION)),/v93 source/);
});
