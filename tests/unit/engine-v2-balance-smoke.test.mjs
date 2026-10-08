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

test('fixed-role chase probe changes only nominated hard-chaser teams',()=>{
  const reports=[0,3].map(chasers=>JSON.parse(execFileSync(process.execPath,
    [ensembleScript,'1','15','attack-trace',
      `planned-finale-allied-manager-mix-${chasers}`,'260','100','0',
      '2','20','4','100','hard','0','80','0','4','0','independent',
      '0','fixed'],{
      encoding:'utf8',timeout:60_000,maxBuffer:8*1024*1024,
    })));
  const [without,withChase]=reports.map(report=>
    new Map(report.managerMixRoleAssignments.map(row=>[row.teamId,row.role])));
  for(const [teamId,role] of without){
    if(withChase.get(teamId)==='hard')assert.equal(role,'passive');
    else assert.equal(withChase.get(teamId),role);
  }
  assert.equal([...withChase.values()].filter(role=>role==='hard').length,3);
  for(const report of reports)assert.equal(report.managerMixRoleMode,'fixed');
});

test('fixed-role finale validates a partial merge and line catch',()=>{
  // Rolling/M/aggressive/sample-5 merges road-6 into road-7 while several
  // former road-6 riders and one road-7 rider are caught at the finish.
  const report=JSON.parse(execFileSync(process.execPath,[ensembleScript,'1','20',
    'attack-trace','planned-finale-allied-manager-mix-1','260','100','0',
    '2','20','4','100','hard','0','80','0','4','0','independent','5','fixed'],{
    encoding:'utf8',timeout:60_000,maxBuffer:8*1024*1024,
  }));
  assert.equal(report.sampleOffset,5);
  assert.equal(report.managerMixRoleMode,'fixed');
});

test('guarded short-step coverage accounts for every independent source state',()=>{
  const report=JSON.parse(execFileSync(process.execPath,[ensembleScript,'1','20',
    'attack-trace','planned-finale-allied-manager-mix-2','260','100','0',
    '2','20','4','100','hard','0','80','0','4','0','independent','2',
    'fixed','ordered'],{
    encoding:'utf8',timeout:60_000,maxBuffer:8*1024*1024,
  }));
  assert.equal(report.orderedFinaleCoverage,'ordered');
  let pendingAttacks=0;
  for(const genders of Object.values(report.courses))
    for(const strategies of Object.values(genders))
      for(const cell of Object.values(strategies)){
        const coverage=cell.orderedFinale;
        assert.equal(coverage.noRoadGroup+coverage.oneRoadGroup+
          coverage.multipleRoadGroups+coverage.noBunch,1);
        const rejected=Object.values(coverage.readOnlyRejections)
          .reduce((sum,count)=>sum+count,0);
        assert.equal(coverage.accepted+rejected,coverage.oneRoadGroup);
        assert.equal(coverage.survived+coverage.caught,coverage.accepted);
        const oneRoadSeparatedRejected=Object.values(
          coverage.oneRoadSeparatedRejections)
          .reduce((sum,count)=>sum+count,0);
        assert.equal(coverage.oneRoadSeparatedAccepted+
          oneRoadSeparatedRejected,rejected);
        const multiRejected=Object.values(coverage.multiSeparatedRejections)
          .reduce((sum,count)=>sum+count,0);
        assert.equal(coverage.multiSeparatedAccepted+multiRejected,
          coverage.multipleRoadGroups);
        pendingAttacks+=Object.entries({...coverage.readOnlyRejections,
          ...coverage.multiSeparatedRejections}).filter(([reason])=>
          reason.includes('needs a recorded peloton attack'))
          .reduce((sum,[,count])=>sum+count,0);
        assert.ok(coverage.racesWithExhaustionDrop<=coverage.accepted);
      }
  assert.ok(pendingAttacks>0);
});

test('single-group separated coverage keeps valid selective chase after phase stops',()=>{
  const report=JSON.parse(execFileSync(process.execPath,[ensembleScript,'1','20',
    'attack-trace','planned-finale-allied-manager-mix-2','260','100','0',
    '3','20','4','100','hard','0','80','5','4','0','independent','0',
    'fixed','ordered'],{
    encoding:'utf8',timeout:60_000,maxBuffer:8*1024*1024,
  }));
  const cells=Object.values(report.courses).flatMap(genders=>
    Object.values(genders).flatMap(strategies=>
      Object.values(strategies)));
  assert.ok(cells.reduce((sum,cell)=>
    sum+cell.orderedFinale.oneRoadSeparatedAccepted,0)>0);
  for(const cell of cells){
    const coverage=cell.orderedFinale;
    const orderedRejected=Object.values(coverage.readOnlyRejections)
      .reduce((sum,count)=>sum+count,0);
    const separatedRejected=Object.values(
      coverage.oneRoadSeparatedRejections)
      .reduce((sum,count)=>sum+count,0);
    assert.equal(coverage.oneRoadSeparatedAccepted+separatedRejected,
      orderedRejected);
  }
});

test('post-attack handoff never counts an unresolved later attack as travel',()=>{
  const report=JSON.parse(execFileSync(process.execPath,[ensembleScript,'1','20',
    'attack-trace','planned-finale-allied-manager-mix-0','260','100','0',
    '3','5','4','100','hard','0','0','0','4','0','independent','0',
    'fixed','ordered'],{
    encoding:'utf8',timeout:60_000,maxBuffer:8*1024*1024,
  }));
  const cells=Object.values(report.courses).flatMap(genders=>
    Object.values(genders).flatMap(strategies=>
      Object.values(strategies)));
  assert.ok(cells.some(cell=>cell.orderedFinale.postAttackAccepted>0));
  let refusedLater=0;
  for(const cell of cells){
    const coverage=cell.orderedFinale;
    const rejected=Object.values(coverage.postAttackRejections)
      .reduce((sum,count)=>sum+count,0);
    assert.equal(coverage.postAttackAccepted+rejected,
      coverage.postAttackCandidates);
    refusedLater+=Object.entries(coverage.postAttackRejections)
      .filter(([reason])=>reason.includes('at km 260'))
      .reduce((sum,[,count])=>sum+count,0);
  }
  assert.ok(refusedLater>0);
});

test('complete separated-field audit records blocked team-limit orders without awarding points',()=>{
  const report=JSON.parse(execFileSync(process.execPath,[ensembleScript,'1','20',
    'attack-trace','planned-finale-allied-manager-mix-1','260','100','0',
    '2','20','4','100','hard','0','80','0','4','0','independent',
    '0','fixed','ordered'],{
      encoding:'utf8',timeout:120_000,maxBuffer:8*1024*1024,
    }));
  const cells=Object.values(report.courses).flatMap(genders=>
    Object.values(genders).flatMap(strategies=>
      Object.values(strategies)));
  const totals={candidates:0,accepted:0,blocked:0};
  for(const cell of cells){
    const audit=cell.orderedFinale.fullFieldSeparated;
    assert.equal(audit.travelVersion,'v2-finale-separated-team-limit-9');
    assert.equal(audit.boundsVersion,
      'v2-finale-separated-finish-bounds-2');
    const rejected=Object.values(audit.rejections)
      .reduce((sum,count)=>sum+count,0);
    assert.equal(audit.accepted+rejected,audit.candidates);
    totals.candidates+=audit.candidates;
    totals.accepted+=audit.accepted;
    totals.blocked+=audit.blockedTeamLimitDecisions;
  }
  assert.ok(totals.candidates>0);
  assert.ok(totals.accepted>0);
  assert.ok(totals.blocked>0);
});
