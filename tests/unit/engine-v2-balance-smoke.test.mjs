import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ensembleScript=fileURLToPath(new URL('../../scripts/engine-v2-ensemble.mjs',import.meta.url));

test('paired fictional races flag degenerate finale balance before tuning is accepted',()=>{
  // This is a coarse guard, not a claim that v2 sporting balance is approved.
  // Five deterministic paired seeds cover three routes, both categories and
  // three committed strategies. A net-chase-only change made final automatic
  // attackers win most races; suppressing those attacks as well almost erased
  // breakaway wins. Neither change is safe in isolation.
  const report=JSON.parse(execFileSync(process.execPath,[ensembleScript,'5'],{
    encoding:'utf8',timeout:60_000,maxBuffer:8*1024*1024,
  }));
  assert.equal(report.pairedSamples,5);
  assert.equal(report.fieldTeams,4);
  for(const [course,genders] of Object.entries(report.courses)){
    const rows=Object.values(genders).flatMap(strategies=>Object.values(strategies));
    assert.equal(rows.length,6);
    for(const row of rows){
      assert.ok(Math.abs(row.preFinalBreakWinnerRaceRate+
        row.finalKmJoinWinnerRaceRate-row.breakWinRate)<1e-9,
      `${course}: breakaway winner has no recorded origin`);
      assert.ok(row.finalAutoWinnerRaceRate<=row.finalKmJoinWinnerRaceRate);
      assert.ok(Math.abs(row.finalPhaseCadenceWinnerRaceRate+
        row.finalBaselineCadenceWinnerRaceRate-row.finalAutoWinnerRaceRate)<1e-9,
      `${course}: final cadence winner has no committed order source`);
      assert.ok(row.residualAffectedBreakWinRaceRate<=row.breakWinRate);
      assert.ok(row.multiGroupResidualAffectedRaceRate>=0&&
        row.multiGroupResidualAffectedRaceRate<=1);
    }
    const breakWinRate=rows.reduce((sum,row)=>sum+row.breakWinRate,0)/rows.length;
    const finalAutoWinnerRate=rows.reduce((sum,row)=>
      sum+row.finalAutoWinnerRaceRate,0)/rows.length;
    assert.ok(breakWinRate>=.1,`${course}: breakaway wins nearly vanished`);
    assert.ok(finalAutoWinnerRate<.5,
      `${course}: automatic final-kilometre attacks dominate winners`);
  }
});

test('paired balance audit runs complete recordings for small and division-sized fields',()=>{
  for(const fieldTeams of [2,15]){
    const report=JSON.parse(execFileSync(process.execPath,
      [ensembleScript,'1',String(fieldTeams)],{
        encoding:'utf8',timeout:60_000,maxBuffer:8*1024*1024,
      }));
    assert.equal(report.fieldTeams,fieldTeams);
    assert.equal(report.pairedSamples,1);
    for(const genders of Object.values(report.courses))
      for(const strategies of Object.values(genders))
        for(const row of Object.values(strategies)){
          assert.ok(row.breakWinRate>=0&&row.breakWinRate<=1);
          assert.ok(row.meanDroppedRiders>=0&&row.meanDroppedRiders<=fieldTeams*8);
          assert.ok(row.meanMaxRoadGroups>=0&&row.meanMaxRoadGroups<=40);
        }
  }
});

test('independent 20-team finale keeps a line-caught bridge recording valid',()=>{
  // Mountain/M/protect/sample-1 bridges into the existing road group at km 260.
  // The finishing sprint then catches the whole group at the line.
  const report=JSON.parse(execFileSync(process.execPath,[ensembleScript,'2','20',
    'attack-trace','planned-finale-allied-manager-mix-2','260','100','0',
    '2','20','4','100','hard','0','80','5','2','0','independent'],{
    encoding:'utf8',timeout:120_000,maxBuffer:8*1024*1024,
  }));
  assert.equal(report.genderSkillMode,'independent');
  assert.equal(report.pairedSamples,2);
  assert.notEqual(report.courses.mountain.M.protect.meanFieldEnergy,
    report.courses.mountain.F.protect.meanFieldEnergy);
});

test('line catch can remove only the bridged rear group',()=>{
  // At km 260 in flat/F/aggressive/sample-12, road-5 survives while the
  // newly bridged road-6 and its fresh joiners are caught at the line.
  const report=JSON.parse(execFileSync(process.execPath,[ensembleScript,'1','15',
    'attack-trace','planned-finale-allied-manager-mix-2','260','100','0',
    '2','20','4','100','hard','0','80','0','4','0','independent','12'],{
    encoding:'utf8',timeout:60_000,maxBuffer:8*1024*1024,
  }));
  assert.equal(report.sampleOffset,12);
  assert.equal(report.courses.flat.F.aggressive.breakWinRate,1);
});

test('independent manager audit accepts zero hard chasers with later options',()=>{
  const report=JSON.parse(execFileSync(process.execPath,[ensembleScript,'1','15',
    'attack-trace','planned-finale-allied-manager-mix-0','260','100','0',
    '2','20','4','100','hard','0','80','0','4','0','independent'],{
    encoding:'utf8',timeout:60_000,maxBuffer:8*1024*1024,
  }));
  assert.equal(report.managerMixHardChasers,0);
  assert.equal(report.chaserSkillCap,null);
  assert.equal(report.genderSkillMode,'independent');
});
