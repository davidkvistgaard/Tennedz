// Fixed fictional sporting boundary: length, fatigue and contested chase.
// This measures coverage and paid-road integrity, never target win rates.
import assert from 'node:assert/strict';
import {runV91TestDrive} from './engine-v2-test-drive.mjs';

const seed='flat-length-boundary-1';
const rows=[];
for(const distanceKm of [40,260])for(const fatigue of [0,30])
  for(const gender of ['M','F'])for(const teamCount of [4,15,20])
    for(const mode of ['chase','attack','contested']){
      const settings={distanceKm,terrain:'flat',fatigue,gender,teamCount,
        seed,defaultRivalPlan:mode==='attack'?'attack':'chase',
        attack:mode==='chase'?'none':'repeated',
        chase:mode==='attack'?'ignore':'all'};
      const output=runV91TestDrive({settings,individualGroupLine:true});
      const status=output.roadStatus??output.status;
      const expected=teamCount*8;
      assert.equal(output.pointsStatus,'withheld');
      assert.equal(output.canCommitAwards,false);
      if(['paid_conditional_line','conditional_multiband_line',
        'conditional_depleted_line'].includes(status)){
        assert.equal(output.finale.lineTimes.length,expected);
        assert.equal(new Set(output.finale.lineTimes.map(row=>
          row.riderId)).size,expected);
        assert.ok(output.finale.lineTimes.every(row=>
          Number.isFinite(row.elapsedSecondsFromLastKmStart)&&
          Number.isFinite(row.energyAtLine)&&row.energyAtLine>=0));
      }else if(status==='paid_group_bands'){
        assert.equal(output.finale.finalRiderEnergy.length,expected);
        assert.equal(output.individualLineStatus,
          'singleton_front_unresolved');
      }else{
        assert.equal(status,'unsupported');
        assert.ok(output.reason);
        assert.ok(output.lastKmSource);
      }
      rows.push({distanceKm,fatigue,gender,teamCount,mode,status,
        groups:output.lastKmSource?.roadGroups.length??null,
        dropped:output.lastKmSource?.droppedRiderIds.length??null,
        ...(output.individualLineStatus?{
          individualLineStatus:output.individualLineStatus}:{}),
        ...(output.reason?{reason:output.reason}:{}),
        ...(output.finale?.chaseAvailability?{
          unavailableChaseTeams:output.finale.chaseAvailability
            .unavailableTeamIds.length}:{})});
    }
const counts=Object.fromEntries([...new Set(rows.map(row=>row.status))]
  .sort().map(status=>[status,rows.filter(row=>
    row.status===status).length]));
console.log(JSON.stringify({version:'v2-flat-length-boundary-audit-1',
  seed,scenarios:rows.length,counts,rows},null,2));
