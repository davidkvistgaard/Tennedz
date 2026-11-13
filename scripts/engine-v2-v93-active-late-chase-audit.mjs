// Controlled fictional whole races. Only the player's 5 km effort changes;
// a fixed all-out chase is active in both runs. No live data or awards.
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest} from
  '../lib/engine/v2/playtest-v93-coasted.mjs';

const results=[];
for(const distanceKm of [40,120])for(const gender of ['M','F'])
  for(const terrain of ['flat','rolling','mountain','exposed','custom']){
    const settings={distanceKm,teamCount:4,gender,terrain,fatigue:0,
      seed:'active-late-chase-audit',effort:'steady',attack:'none',
      chase:'all',defaultRivalPlan:'attack'};
    const runs=[];
    for(const effort of ['conserve','hard']){
      const race=createV93PlayableTest({...settings,managerFinaleOrders:[
        {teamId:'you',atKm:distanceKm-5,effort,chase:'all'}]});
      const summary=summarizeV93CoastedPlaytest(race);
      assert.equal(summary.lineTimes.length,32);
      assert.equal(summary.pointsStatus,'withheld');
      assert.equal(race.canCommitAwards,false);
      const finisherId=summary.managerDecisions.find(row=>
        row.teamId==='you').finisherId;
      const line=summary.lineTimes.find(row=>row.riderId===finisherId);
      const one=summary.kilometreFrames.at(-1);
      const late=race.recording.frames.filter(frame=>
        frame.km>distanceKm-5);
      const chaseKm=late.filter(frame=>
        frame.chasers.includes('you')).length;
      assert.equal(chaseKm,5);
      runs.push({effort,finisherId,chaseKm,
        roadStatus:race.roadStatus,
        frontGapAtOneKm:Math.max(0,...one.roadGroups.map(group=>
          group.gapSeconds)),
        conditionalPlace:summary.provisionalLineOrder?.find(row=>
          row.riderId===finisherId)?.position??null,
        energyAtLine:line.energyAtLine,
        lastKmSeconds:line.elapsedSecondsFromLastKmStart,
        preFiveFrames:summary.kilometreFrames.filter(frame=>
          frame.km<distanceKm-5)});
    }
    assert.deepEqual(runs[0].preFiveFrames,runs[1].preFiveFrames);
    assert.equal(runs[0].finisherId,runs[1].finisherId);
    results.push({distanceKm,gender,terrain,
      runs:runs.map(({preFiveFrames,...run})=>run),
      hardMinusConserve:{
        frontGapAtOneKm:runs[1].frontGapAtOneKm-
          runs[0].frontGapAtOneKm,
        conditionalPlace:runs[1].conditionalPlace-
          runs[0].conditionalPlace,
        energyAtLine:runs[1].energyAtLine-runs[0].energyAtLine,
        lastKmSeconds:runs[1].lastKmSeconds-runs[0].lastKmSeconds}});
  }
console.log(JSON.stringify({pairs:results.length,results},null,2));
