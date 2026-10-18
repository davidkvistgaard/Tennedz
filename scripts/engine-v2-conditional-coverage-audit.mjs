// Read-only, fictional coverage audit for the opt-in paid conditional finale.
// Counts supported road states, not sporting win rates or official results.
import assert from 'node:assert/strict';
import {createV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {recordFinaleLastKmFieldHandoffFromTour} from
  '../lib/engine/v2/finale-last-km-field-handoff.mjs';
import {createV91ConditionalRaceFinal,
  validateV91ConditionalRaceFinal} from
  '../lib/engine/v2/playtest-race-final.mjs';

const routes=[
  {distanceKm:40,terrain:'flat',fatigue:0},
  {distanceKm:120,terrain:'rolling',fatigue:15},
  {distanceKm:260,terrain:'mountain',fatigue:30}];
const rows=[];
for(const route of routes)for(const gender of ['M','F'])
  for(const teamCount of [4,15,20])
    for(const mode of ['mixed','attack']){
      const settings={...route,gender,teamCount,
        seed:'conditional-coverage-1',defaultRivalPlan:mode,
        attack:mode==='attack'?'repeated':'selective',
        chase:mode==='attack'?'ignore':'selective'};
      const source=createV91Playtest(settings);
      const handoff=recordFinaleLastKmFieldHandoffFromTour(
        source.recording);
      let status='refused',reason=null;
      try{
        const trial=createV91ConditionalRaceFinal(settings);
        assert.deepEqual(trial.recording,source.recording);
        assert.equal(trial.roadStatus,'paid_conditional_line');
        assert.equal(trial.paidFinale.finishers.length,teamCount*8);
        assert.equal(new Set(trial.paidFinale.finishers.map(row=>
          row.riderId)).size,teamCount*8);
        assert.equal(trial.pointsStatus,'withheld');
        assert.equal(trial.canCommitAwards,false);
        assert.equal(validateV91ConditionalRaceFinal(
          settings,{},trial),true);
        status='paid_conditional_line';
      }catch(error){
        if(error.message!==
          'The inactive-intents bunch has an unresolved road action.')
          throw error;
        reason=error.message;
      }
      rows.push({distanceKm:route.distanceKm,terrain:route.terrain,
        fatigue:route.fatigue,gender,teamCount,mode,
        roadGroups:handoff.roadGroups.length,
        droppedRiders:handoff.droppedRiderIds.length,
        status,reason});
    }
const count=(mode,status)=>rows.filter(row=>row.mode===mode&&
  row.status===status).length;
console.log(JSON.stringify({version:'v2-conditional-coverage-audit-1',
  seed:'conditional-coverage-1',scenarios:rows.length,
  mixedPaid:count('mixed','paid_conditional_line'),
  mixedRefused:count('mixed','refused'),
  attackPaid:count('attack','paid_conditional_line'),
  attackRefused:count('attack','refused'),
  rows},null,2));
