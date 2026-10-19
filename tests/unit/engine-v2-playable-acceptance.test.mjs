import test from 'node:test';
import assert from 'node:assert/strict';
import {pointsForDivisionResult} from '../../lib/calendar/points.mjs';
import {summarizeV91PaidFinaleReplay} from
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
