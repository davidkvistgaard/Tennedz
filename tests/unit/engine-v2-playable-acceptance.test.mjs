import test from 'node:test';
import assert from 'node:assert/strict';
import {pointsForDivisionResult} from '../../lib/calendar/points.mjs';
import {summarizeV91PaidFinaleReplay,summarizeV91PaidFinaleTail,
  summarizeV91PaidNamedAttackApproach,
  summarizeV91PaidPartialContactReplay} from
  '../../lib/engine/v2/playtest-finale-replay.mjs';
import {runV91IntegratedTestDrive} from
  '../../scripts/engine-v2-test-drive.mjs';

const cases=[
  [40,'flat',4,'M',0],
  [120,'rolling',15,'F',15],
  [260,'mountain',20,'M',15],
  [40,'rolling',20,'F',0],
  [120,'mountain',4,'F',15],
  [260,'flat',15,'M',0],
];
const pointContext={tier:3,divisionIndex:1,divisionCount:1};

for(const [distanceKm,terrain,teamCount,gender,fatigue] of cases){
  test(`playable bunch path connects ${distanceKm} km ${terrain}, ${teamCount} teams, ${gender}, fatigue ${fatigue}`,()=>{
    const settings={distanceKm,terrain,teamCount,gender,fatigue,
      effort:'steady',attack:'none',chase:'ignore',
      defaultRivalPlan:'passive',seed:'playable-acceptance-1'};
    const {summary,recording}=runV91IntegratedTestDrive({settings,
      pointContext},{full:true});
    const riderCount=teamCount*8;
    assert.equal(summary.roadStatus,'paid_conditional_line');
    assert.equal(summary.finale.lineTimes.length,riderCount);
    const lines=new Map(summary.finale.lineTimes.map(row=>
      [row.riderId,row]));
    assert.equal(lines.size,riderCount);

    const replay=summarizeV91PaidFinaleReplay(recording);
    assert.equal(replay.status,'complete_paid_trace');
    assert.equal(replay.handoffDistanceM,(distanceKm-1)*1000);
    assert.equal(replay.lineDistanceM,distanceKm*1000);
    assert.ok(replay.frames.every(frame=>
      frame.riders.length===riderCount));
    for(const row of replay.frames.at(-1).riders){
      const line=lines.get(row.riderId);
      assert.ok(line);
      assert.equal(row.positionM,replay.lineDistanceM);
      assert.equal(row.elapsedToLineSeconds,
        line.elapsedSecondsFromLastKmStart);
      assert.equal(row.energyAfter,line.energyAtLine);
    }

    const preview=summary.provisionalPointPreview;
    assert.equal(preview.riders.length,riderCount);
    assert.deepEqual(preview.awardRows,[]);
    assert.equal(preview.canCommitAwards,false);
    assert.deepEqual(preview.riders.map(row=>row.provisionalPlace),
      Array.from({length:riderCount},(_,index)=>index+1));
    for(const row of preview.riders){
      const line=lines.get(row.riderId);
      assert.equal(row.elapsedSecondsFromLastKmStart,
        line.elapsedSecondsFromLastKmStart);
      assert.equal(row.energyAtLine,line.energyAtLine);
      assert.equal(row.previewPoints,pointsForDivisionResult({
        tier:pointContext.tier,resultType:'ONE_DAY',
        placing:row.provisionalPlace,multiplier:1}));
    }
    assert.equal(summary.pointsStatus,'withheld');
    assert.equal(summary.canCommitAwards,false);
    assert.equal(recording.classifiedResults,null);
  });
}

for(const gender of ['M','F'])for(const teamCount of [4,15,20]){
  test(`named attack and coordinated chase connect ${teamCount} teams, ${gender}`,()=>{
    const base={distanceKm:120,terrain:'rolling',teamCount,gender,
      fatigue:15,effort:'steady',attack:'none',chase:'ignore',
      seed:'integrated-probe'};
    const run=defaultRivalPlan=>runV91IntegratedTestDrive({
      settings:{...base,defaultRivalPlan},
      attack:{teamId:'you',riderId:'you-0'},pointContext},
    {full:true});
    const passive=run('passive');
    const chase=run('chase');
    const riderCount=teamCount*8;
    assert.deepEqual(passive.recording.recording.committedInputs.teams
      .map(team=>team.riders),chase.recording.recording.committedInputs.teams
      .map(team=>team.riders));
    assert.equal(passive.recording.roadDecision.branch,'solo');
    assert.equal(chase.recording.roadDecision.branch,'caught');
    for(const output of [passive,chase]){
      assert.equal(output.summary.roadStatus,'paid_conditional_line');
      assert.equal(output.summary.finale.lineTimes.length,riderCount);
      assert.equal(new Set(output.summary.finale.lineTimes.map(row=>
        row.riderId)).size,riderCount);
      assert.equal(output.summary.provisionalPointPreview.status,
        'unavailable');
      assert.equal(output.summary.pointsStatus,'withheld');
      assert.equal(output.summary.canCommitAwards,false);
      assert.equal(output.recording.classifiedResults,null);
      assert.equal(summarizeV91PaidFinaleReplay(output.recording),null);
    }
    const soloApproach=summarizeV91PaidNamedAttackApproach(
      passive.recording);
    const caughtApproach=summarizeV91PaidNamedAttackApproach(
      chase.recording);
    assert.deepEqual(soloApproach.frames.map(frame=>
      frame.roadGroups.length),[1,1]);
    assert.deepEqual(caughtApproach.frames.map(frame=>
      frame.roadGroups.length),[1,0]);
    assert.ok(caughtApproach.frames[1].catchDistanceM>119_250);
    assert.ok(caughtApproach.frames[1].catchDistanceM<119_500);
    assert.equal(caughtApproach.frames[1].pelotonRiderCount,riderCount);
    assert.ok(caughtApproach.frames.every(frame=>
      frame.riders.length===riderCount));
    const tail=summarizeV91PaidFinaleTail(chase.recording);
    assert.equal(tail.status,'partial_paid_trace');
    assert.equal(tail.handoffDistanceM,119_500);
    assert.equal(tail.frames.length,5);
    const lines=new Map(chase.summary.finale.lineTimes.map(row=>
      [row.riderId,row]));
    for(const rider of tail.frames.at(-1).riders){
      const line=lines.get(rider.riderId);
      assert.ok(line);
      assert.equal(rider.positionM,120_000);
      assert.equal(rider.elapsedToLineSeconds,
        line.elapsedSecondsFromLastKmStart);
      assert.equal(rider.energyAfter,line.energyAtLine);
    }
    const ownTime=output=>output.summary.finale.lineTimes.find(row=>
      row.riderId==='you-7').elapsedSecondsFromLastKmStart;
    assert.notEqual(ownTime(passive),ownTime(chase));
  });
}

for(const [distanceKm,terrain,gender] of [
  [40,'exposed','M'],[120,'custom','F']]){
  test(`one rival chase changes the paid ${distanceKm} km ${terrain} attack road`,()=>{
    const passive={effort:'steady',attack:'none',chase:'ignore'};
    const settings={distanceKm,terrain,gender,teamCount:4,fatigue:15,
      seed:'integrated-probe',defaultRivalPlan:'passive',
      attack:'none',chase:'ignore',
      ...(terrain==='custom'?{profileHeightsM:[100,350,150,500,180,100]}:{})};
    const run=rivalOne=>runV91IntegratedTestDrive({settings:{...settings,
      managerTactics:[rivalOne,passive,passive]},
    attack:{teamId:'you',riderId:'you-0'},
    finalePlans:[{teamId:'you',finisherId:'you-7',leadOutRiderId:null}],
    pointContext},{full:true});
    const solo=run(passive);
    const caught=run({effort:'hard',attack:'none',chase:'all'});
    assert.deepEqual(solo.recording.recording.route,
      caught.recording.recording.route);
    const soloTeams=solo.recording.recording.committedInputs.teams;
    const caughtTeams=caught.recording.recording.committedInputs.teams;
    assert.deepEqual(soloTeams.map(team=>team.riders),
      caughtTeams.map(team=>team.riders));
    assert.notDeepEqual(soloTeams[0].orders,caughtTeams[0].orders);
    for(let index=1;index<soloTeams.length;index++)
      assert.deepEqual(soloTeams[index].orders,caughtTeams[index].orders);
    assert.equal(solo.recording.roadDecision.branch,'solo');
    assert.equal(caught.recording.roadDecision.branch,'caught');
    const soloApproach=summarizeV91PaidNamedAttackApproach(solo.recording);
    const caughtApproach=summarizeV91PaidNamedAttackApproach(caught.recording);
    assert.deepEqual(soloApproach.frames.map(frame=>frame.roadGroups.length),
      [1,1]);
    assert.deepEqual(caughtApproach.frames.map(frame=>frame.roadGroups.length),
      [1,0]);
    assert.ok(caughtApproach.frames[1].catchDistanceM>
      distanceKm*1000-750);
    assert.ok(caughtApproach.frames[1].catchDistanceM<
      distanceKm*1000-500);
    for(const output of [solo,caught]){
      assert.equal(output.summary.roadStatus,'paid_conditional_line');
      assert.equal(output.summary.finale.lineTimes.length,32);
      assert.equal(output.summary.provisionalPointPreview.status,
        'unavailable');
      assert.equal(output.summary.pointsStatus,'withheld');
      assert.equal(output.summary.canCommitAwards,false);
      assert.equal(output.recording.classifiedResults,null);
    }
    const ownTime=output=>output.summary.finale.lineTimes.find(row=>
      row.riderId==='you-7').elapsedSecondsFromLastKmStart;
    assert.notEqual(ownTime(solo),ownTime(caught));
  });
}

for(const [distanceKm,terrain,teamCount,gender] of [
  [40,'flat',4,'M'],[40,'exposed',4,'M'],
  [120,'rolling',15,'F'],[120,'custom',15,'F'],
  [260,'mountain',20,'M']]){
  test(`lead-out and exact contact replay connect ${distanceKm} km ${terrain}, ${teamCount} teams, ${gender}`,()=>{
    const settings={distanceKm,terrain,teamCount,gender,
      attack:'none',chase:'ignore',defaultRivalPlan:'chase',seed:'trial',
      ...(terrain==='custom'?{profileHeightsM:[100,350,150,500,180,100]}:{})};
    const run=leadOutRiderId=>runV91IntegratedTestDrive({settings,
      attack:{teamId:'you',riderId:'you-4'},
      finalePlans:[{teamId:'you',finisherId:'you-6',leadOutRiderId}],
      pointContext},{full:true});
    const plain=run(null);
    const helped=run('you-5');
    assert.deepEqual(plain.recording.recording,
      helped.recording.recording);
    assert.equal(helped.summary.roadStatus,'paid_conditional_line');
    assert.equal(helped.recording.roadDecision.branch,'solo');
    assert.ok(helped.recording.preContactFinale.frames.some(frame=>
      frame.riders.some(row=>row.riderId==='you-5'&&
        row.role==='lead_out'&&row.energySpent>0)));
    const replay=summarizeV91PaidPartialContactReplay(helped.recording);
    assert.equal(replay.status,'partial_contact_paid_trace');
    assert.equal(replay.handoffDistanceM,distanceKm*1000-500);
    assert.equal(replay.frames.length,
      helped.recording.preContactFinale.frames.length+
        helped.recording.paidFinale.frames.length);
    const lines=new Map(helped.summary.finale.lineTimes.map(row=>
      [row.riderId,row]));
    assert.equal(lines.size,teamCount*8);
    for(const row of replay.frames.at(-1).riders){
      const line=lines.get(row.riderId);
      assert.ok(line);
      assert.equal(row.positionM,distanceKm*1000);
      assert.equal(row.elapsedToLineSeconds,
        line.elapsedSecondsFromLastKmStart);
      assert.equal(row.energyAfter,line.energyAtLine);
    }
    const finisher=output=>output.summary.finale.lineTimes.find(row=>
      row.riderId==='you-6');
    assert.notEqual(finisher(plain).elapsedSecondsFromLastKmStart,
      finisher(helped).elapsedSecondsFromLastKmStart);
    assert.equal(helped.summary.provisionalPointPreview.status,
      'unavailable');
    assert.equal(helped.summary.pointsStatus,'withheld');
    assert.equal(helped.summary.canCommitAwards,false);
    assert.equal(helped.recording.classifiedResults,null);
  });
}
