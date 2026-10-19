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
        assert.ok(['paid_conditional_line','paid_group_bands',
          'paid_separated_bands','recorded_depleted_bands']
          .includes(trial.roadStatus));
        if(trial.roadStatus==='paid_conditional_line'){
          assert.equal(trial.paidFinale.finishers.length,teamCount*8);
          assert.equal(new Set(trial.paidFinale.finishers.map(row=>
            row.riderId)).size,teamCount*8);
        }else if(trial.roadStatus==='paid_group_bands'){
          assert.equal(handoff.roadGroups.length,1);
          assert.equal(handoff.droppedRiderIds.length,0);
          assert.equal(trial.paidFinale.line.finalRiderEnergy.length,
            teamCount*8);
          assert.equal(trial.finalePlanStatus,'unapplied_group_band');
        }else if(trial.roadStatus==='paid_separated_bands'){
          assert.ok(handoff.roadGroups.length>=2);
          assert.equal(handoff.droppedRiderIds.length,0);
          assert.equal(trial.paidFinale.line.riders.length,teamCount*8);
          assert.equal(trial.paidFinale.line.finalRiderEnergy.length,
            teamCount*8);
          assert.equal(trial.paidFinale.line.bands.at(-1)
            .lastPossiblePlace,teamCount*8);
          assert.equal(trial.finalePlanStatus,
            'unapplied_group_bands');
        }else{
          assert.ok(handoff.roadGroups.length>=1);
          assert.ok(handoff.droppedRiderIds.length>=1);
          assert.equal(trial.paidFinale.line.riders.length,teamCount*8);
          assert.equal(trial.paidFinale.line.finalRiderEnergy.length,
            teamCount*8);
          assert.equal(trial.paidFinale.line.bands.at(-1)
            .lastPossiblePlace,teamCount*8);
          assert.ok(trial.paidFinale.passageFrames.some(frame=>
            frame.droppedPassages.some(row=>
              row.unmetEnergyDemand>0)));
          assert.equal(trial.finalePlanStatus,
            'unapplied_depleted_bands');
        }
        assert.equal(trial.classifiedResults,null);
        assert.equal(trial.pointsStatus,'withheld');
        assert.equal(trial.canCommitAwards,false);
        assert.equal(validateV91ConditionalRaceFinal(
          settings,{},trial),true);
        status=trial.roadStatus;
      }catch(error){
        if(![
          'The inactive-intents bunch has an unresolved road action.',
          'The cooperative group has an unresolved last-kilometre road action.'
        ].includes(error.message))
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
console.log(JSON.stringify({version:'v2-conditional-coverage-audit-4',
  seed:'conditional-coverage-1',scenarios:rows.length,
  mixedPaid:count('mixed','paid_conditional_line'),
  mixedGroupBands:count('mixed','paid_group_bands'),
  mixedSeparatedBands:count('mixed','paid_separated_bands'),
  mixedDepletedBands:count('mixed','recorded_depleted_bands'),
  mixedRefused:count('mixed','refused'),
  attackPaid:count('attack','paid_conditional_line'),
  attackGroupBands:count('attack','paid_group_bands'),
  attackSeparatedBands:count('attack','paid_separated_bands'),
  attackDepletedBands:count('attack','recorded_depleted_bands'),
  attackRefused:count('attack','refused'),
  rows},null,2));
