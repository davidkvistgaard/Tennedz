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
  for(const [course,genders] of Object.entries(report.courses)){
    const rows=Object.values(genders).flatMap(strategies=>Object.values(strategies));
    assert.equal(rows.length,6);
    for(const row of rows){
      assert.ok(Math.abs(row.preFinalBreakWinnerRaceRate+
        row.finalKmJoinWinnerRaceRate-row.breakWinRate)<1e-9,
      `${course}: breakaway winner has no recorded origin`);
      assert.ok(row.finalAutoWinnerRaceRate<=row.finalKmJoinWinnerRaceRate);
      assert.ok(row.residualAffectedBreakWinRaceRate<=row.breakWinRate);
    }
    const breakWinRate=rows.reduce((sum,row)=>sum+row.breakWinRate,0)/rows.length;
    const finalAutoWinnerRate=rows.reduce((sum,row)=>
      sum+row.finalAutoWinnerRaceRate,0)/rows.length;
    assert.ok(breakWinRate>=.1,`${course}: breakaway wins nearly vanished`);
    assert.ok(finalAutoWinnerRate<.5,
      `${course}: automatic final-kilometre attacks dominate winners`);
  }
});
