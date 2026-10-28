import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {finaleSnapshotFromTour} from
  '../../lib/engine/v2/finale-snapshot.mjs';
import {planFinaleBunchFrontWork} from
  '../../lib/engine/v2/finale-bunch-front-work.mjs';

test('candidate final-kilometre front pair pays a named worker without substitution',()=>{
  const prepared=prepareV91Playtest({distanceKm:40,terrain:'flat',
    teamCount:4,attack:'none',chase:'ignore',seed:'named-final-front',
    defaultRivalPlan:'passive',managerTacticalOrdersV8:[
      {teamId:'you',atKm:5,frontWork:'rotate',
        frontWorkRiderId:'you-5'}]});
  const tour=simulateTacticalTour({...prepared,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  const snapshot=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  const energies=new Map(snapshot.riders.map(row=>[row.riderId,row.energy]));
  const input={teams:tour.committedInputs.teams,
    pelotonRiderIds:snapshot.peloton.riderIds,energies,
    segment:tour.route.kilometres[39],sourceKm:40,sliceLengthKm:.25};
  const plan=planFinaleBunchFrontWork(input);
  assert.equal(plan.teamId,'you');
  assert.equal(plan.riderIds.length,2);
  assert(plan.riderIds.includes('you-5'));
  assert(plan.workers.every(row=>row.energySpent>0&&
    row.energySpent<row.energyBefore));
  assert(plan.speedKph>0);
  energies.set('you-5',0);
  assert.equal(planFinaleBunchFrontWork(input),null);
});
