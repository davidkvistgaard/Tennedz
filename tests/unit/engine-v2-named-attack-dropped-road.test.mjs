import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91FinaleTrial} from
  '../../lib/engine/v2/playtest-finale-trial.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleNamedAttackDroppedRoadFromTour,
  validateFinaleNamedAttackDroppedRoadFromTour} from
  '../../lib/engine/v2/finale-named-attack-dropped-road.mjs';

function source(terrain,gender){
  const prepared=prepareV91FinaleTrial({distanceKm:260,terrain,
    fatigue:30,gender,teamCount:4,seed:'test-drive-acceptance-1',
    attack:'none',chase:'ignore',defaultRivalPlan:'chase'},
  {attackTeamId:'you',attackRiderId:'you-4'});
  return simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:prepared.teams,seed:prepared.seed,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
}

test('a valid named attack and already dropped rider pay one road to the line',()=>{
  for(const terrain of ['flat','rolling','mountain'])
    for(const gender of ['M','F']){
      const tour=source(terrain,gender);
      const road=recordFinaleNamedAttackDroppedRoadFromTour(tour,
        {teamId:'you'});
      assert.equal(validateFinaleNamedAttackDroppedRoadFromTour(tour,
        {teamId:'you'},road),true);
      assert.equal(road.frames.length,7);
      assert.equal(road.frames[0].active.attack.status,'split');
      assert.equal(road.frames[0].active.riderEnergy.find(row=>
        row.riderId==='you-4').role,'attack');
      assert.ok(road.frames.some(frame=>frame.active.catchDistanceM));
      assert.deepEqual(road.line.bands.map(band=>[
        band.id,band.firstPossiblePlace,band.lastPossiblePlace]),
      [['peloton',1,31],['dropped',32,32]]);
      const energies=road.line.finalRiderEnergy;
      assert.equal(energies.length,32);
      assert.equal(new Set(energies.map(row=>row.riderId)).size,32);
      assert.ok(energies.every(row=>row.energy>=0));
      for(const frame of road.frames){
        assert.equal(frame.active.riderEnergy.length,31);
        assert.equal(frame.droppedTravel.riders.length,1);
        assert.ok(frame.droppedTravel.riders[0].deficitSecondsAfter>0);
        assert.ok(frame.droppedTravel.riders[0].energySpent>0);
      }
      assert.equal(road.classifiedResults,null);
      assert.equal(road.pointsStatus,'withheld');
      assert.equal(road.canCommitAwards,false);
    }
});
