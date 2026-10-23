import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  validateFinaleSeparatedGroupsFromTour,
  FINALE_COAST_DISSOLVED_FRONT_LAST_KM_VERSION} from
  '../../lib/engine/v2/finale-multi-run.mjs';
import {auditDissolvedFrontContact} from
  '../../lib/engine/v2/finale-dissolved-front-contact.mjs';

test('whole-race dissolved front identifies both active overtakes without a result',()=>{
  const prepared=prepareV91Playtest({distanceKm:260,teamCount:4,
    gender:'M',terrain:'rolling',fatigue:30,seed:'v93-expanded-61-a',
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',
    chase:'selective',profileHeightsM:[900,700,300,500,200,100],
    managerTactics:[
      {effort:'steady',attack:'none',chase:'selective'},
      {effort:'hard',attack:'selective',chase:'all'},
      {effort:'hard',attack:'repeated',chase:'ignore'}]});
  const tour=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:prepared.teams,seed:prepared.seed,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_DISSOLVED_FRONT_LAST_KM_VERSION});
  assert.equal(validateFinaleSeparatedGroupsFromTour(tour,trace),true);
  assert.equal(trace.frames.at(-1).endDistanceM,260000);
  assert.deepEqual(trace.frames[0].frontGroupDissolutions[0].riderIds,
    ['rival-2-7','rival-3-5','you-5']);
  assert.deepEqual(trace.contactAudit.encounters.map(row=>row.activeBandId),
    ['road-13','road-13','road-13','peloton','peloton','peloton']);
  assert.ok(trace.contactAudit.encounters.every(row=>
    row.distanceM>259000&&row.distanceM<259250));
  assert.ok(Math.abs(trace.contactAudit.firstPotentialContact.distanceM-
    259061.1835909186)<1e-6);
  assert.equal(trace.contactAudit.status,
    'unresolved_active_isolated_contact');
  assert.equal(trace.roadStatus,'provisional_contact_unresolved');
  assert.equal(trace.classifiedResults,null);
  assert.equal(trace.canCommitAwards,false);
  assert.equal(trace.pointsStatus,'withheld');
  const altered=structuredClone(trace);
  altered.contactAudit.encounters[0].distanceM+=1;
  assert.throws(()=>validateFinaleSeparatedGroupsFromTour(tour,altered),
    /differs from its locked tour/);
});

test('dissolved-front contact audit has no encounter on separate paid paths',()=>{
  const result=auditDissolvedFrontContact({frames:[{
    startDistanceM:259000,endDistanceM:259250,
    bunchElapsedSeconds:25,roadGroups:[{id:'road-1',gapSeconds:4,
      elapsedSeconds:25}],droppedTravel:{riders:[{
      riderId:'solo',deficitSecondsBefore:-8,
      deficitSecondsAfter:-7}]}}]});
  assert.equal(result.status,'no_active_isolated_contact');
  assert.equal(result.firstPotentialContact,null);
  assert.deepEqual(result.encounters,[]);
  assert.equal(result.canCommitAwards,false);
});
