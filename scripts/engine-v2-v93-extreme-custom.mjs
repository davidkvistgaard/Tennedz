// Whole-race custom-profile regression for the opt-in v93 preview.
// Unsupported last-kilometre handoffs retain only the validated source road.
import assert from 'node:assert/strict';
import {pointsForDivisionResult} from '../lib/calendar/points.mjs';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,V93_UNSUPPORTED_HANDOFF_PREVIEW_VERSION} from
  '../lib/engine/v2/playtest-v93-coasted.mjs';

const pointContext={tier:2,divisionCount:2,divisionIndex:1};
const rows=[];
for(const gender of ['M','F'])for(const fatigue of [0,15,30])
  for(const profile of ['climb','descent']){
    const settings={distanceKm:260,teamCount:20,gender,terrain:'custom',
      fatigue,profileHeightsM:profile==='climb'?
        [100,600,1200,1800,2300,2500]:
        [2500,2200,1700,1100,500,100],
      seed:`v93-custom-extreme-${gender}-${fatigue}-${profile}`,
      defaultRivalPlan:profile==='climb'?'attack':'chase',
      effort:profile==='climb'?'hard':'steady',attack:'repeated',
      chase:profile==='climb'?'ignore':'all'};
    const label={gender,fatigue,profile};
    let race;
    try{race=createV93PlayableTest(settings,{pointContext});}
    catch(error){
      const preview=error.roadPreview;
      const reason=fatigue===30&&profile==='climb'?
        'unresolved_band_contact':null;
      assert.ok(reason,`Unexpected refusal in ${JSON.stringify(label)}`);
      assert.equal(preview?.version,V93_UNSUPPORTED_HANDOFF_PREVIEW_VERSION);
      assert.equal(preview.unsupportedReason,reason);
      assert.equal(preview.handoffKm,259);
      assert.equal(preview.kilometreFrames.length,259);
      assert.equal(preview.kilometreFrames.at(-1).km,259);
      assert.ok(preview.kilometreFrames.at(-1).roadGroups.length>0);
      assert.ok(preview.kilometreFrames.at(-1).ownRiders.every(row=>
        Number.isFinite(row.energy)&&row.energy>=0));
      assert.deepEqual(preview.lastKmRoad,[]);
      assert.equal(preview.lineTimes,null);
      assert.equal(preview.bandReplays,null);
      assert.equal(preview.classifiedResults,null);
      assert.equal(preview.pointPreview.status,'unavailable');
      assert.equal(preview.canCommitAwards,false);
      rows.push({...label,status:reason});
      continue;
    }
    assert.equal(validateV93CoastedPlaytest(settings,{pointContext},race),
      true);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(summary.lineTimes.length,160);
    assert.equal(summary.canCommitAwards,false);
    assert.equal(summary.pointsStatus,'withheld');
    const crossings=new Map(summary.lineTimes.map(row=>[row.riderId,row]));
    assert.equal(crossings.size,160);
    const replayed=new Set();
    for(const band of summary.bandReplays)
      for(const rider of band.frames.at(-1).riders){
        assert.equal(replayed.has(rider.riderId),false);
        replayed.add(rider.riderId);
        const crossing=crossings.get(rider.riderId);
        assert.equal(crossing.roadBandId,band.id);
        assert.equal(crossing.elapsedSecondsFromLastKmStart,
          rider.elapsedToLineSeconds);
        assert.equal(crossing.energyAtLine,rider.energyAfter);
      }
    assert.equal(replayed.size,160);
    if(summary.pointPreview.status!=='unavailable'){
      const places=new Map(summary.provisionalLineOrder.map(row=>
        [row.riderId,row.position]));
      for(const row of summary.pointPreview.riders){
        assert.equal(row.provisionalPlace,places.get(row.riderId));
        assert.equal(row.previewPoints,pointsForDivisionResult({
          tier:pointContext.tier,resultType:'ONE_DAY',
          placing:row.provisionalPlace,
          multiplier:summary.pointPreview.multiplier}));
      }
    }
    rows.push({...label,status:'conditional_finish',
      points:summary.pointPreview.status??'illustrative'});
  }

assert.equal(rows.length,12);
assert.equal(rows.filter(row=>row.status==='conditional_finish').length,10);
assert.equal(rows.filter(row=>row.status==='unresolved_band_contact').length,2);
assert.equal(rows.filter(row=>row.points==='illustrative').length,4);
console.log(JSON.stringify({scenarios:rows.length,completed:10,
  readOnlyPoints:4,unsupportedHandoffs:2,rows}));
