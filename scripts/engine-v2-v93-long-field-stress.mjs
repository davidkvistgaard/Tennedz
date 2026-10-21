// Full-race 260 km stress corpus for the opt-in v93 playable road.
// Every outcome either replays all riders or exposes only a validated
// pre-catch road; no fictional result or award is accepted.
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,V93_UNSUPPORTED_CATCH_PREVIEW_VERSION} from
  '../lib/engine/v2/playtest-v93-coasted.mjs';

const tactics=[
  {effort:'hard',attack:'none',chase:'all'},
  {effort:'steady',attack:'selective',chase:'ignore'},
  {effort:'conserve',attack:'none',chase:'selective'},
  {effort:'steady',attack:'repeated',chase:'selective'}];
const genders=['M','F'];
const terrains=['flat','rolling','mountain','exposed','custom'];
const fatigues=[0,15,30];
const seeds=[0,1,2];
const pointContext={tier:3,divisionCount:4,divisionIndex:2};
const rows=[];
for(const gender of genders)for(const terrain of terrains)
  for(const fatigue of fatigues)for(const seedIndex of seeds){
    const settings={distanceKm:260,teamCount:20,gender,terrain,fatigue,
      seed:`v93-long-stress-${gender}-${terrain}-${fatigue}-${seedIndex}`,
      defaultRivalPlan:'passive',effort:'steady',attack:'repeated',
      chase:'selective',managerTactics:Array.from({length:19},(_,index)=>
        tactics[index%tactics.length])};
    const label={gender,terrain,fatigue,seedIndex};
    let race;
    try{race=createV93PlayableTest(settings,{pointContext});}
    catch(error){
      assert.match(error.message,/needs a recorded catch for road-/);
      const preview=error.roadPreview;
      assert.equal(preview?.version,V93_UNSUPPORTED_CATCH_PREVIEW_VERSION);
      assert.equal(preview.unsupportedReason,'unpaid_front_catch');
      assert.equal(preview.kilometreFrames.length,259);
      assert.equal(preview.kilometreFrames.at(-1).km,259);
      assert.ok(preview.kilometreFrames.at(-1).roadGroups.some(group=>
        group.id===preview.catch.groupId));
      assert.equal(preview.catch.calculatedCatchDistanceM,
        error.cause.calculatedCatchDistanceM);
      assert.ok(preview.catch.metresToGo>=0&&
        preview.catch.metresToGo<=1000);
      assert.deepEqual(preview.lastKmRoad,[]);
      assert.deepEqual(preview.exits,[]);
      assert.equal(preview.lineTimes,null);
      assert.equal(preview.bandReplays,null);
      assert.equal(preview.classifiedResults,null);
      assert.equal(preview.pointPreview.status,'unavailable');
      assert.equal(preview.canCommitAwards,false);
      rows.push({...label,status:'unpaid_front_catch',
        groupId:preview.catch.groupId,
        metresToGo:preview.catch.metresToGo});
      continue;
    }
    assert.equal(validateV93CoastedPlaytest(settings,{pointContext},race),true);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(summary.lineTimes.length,160);
    assert.equal(summary.canCommitAwards,false);
    assert.equal(summary.pointsStatus,'withheld');
    const crossings=new Map(summary.lineTimes.map(row=>[row.riderId,row]));
    assert.equal(crossings.size,160);
    const at500=race.clock.trace.frames.find(frame=>
      frame.endDistanceM===259500);
    assert.ok(at500);
    const energyAt500=new Map(at500.riders.map(row=>
      [row.riderId,row.energy]));
    const replayed=new Set();
    for(const band of summary.bandReplays){
      for(const rider of band.frames[0].riders)
        assert.equal(rider.energyAtDecision,
          energyAt500.get(rider.riderId));
      for(const rider of band.frames.at(-1).riders){
        assert.equal(replayed.has(rider.riderId),false);
        replayed.add(rider.riderId);
        const crossing=crossings.get(rider.riderId);
        assert.equal(crossing.roadBandId,band.id);
        assert.equal(crossing.elapsedSecondsFromLastKmStart,
          rider.elapsedToLineSeconds);
        assert.equal(crossing.energyAtLine,rider.energyAfter);
      }
    }
    assert.equal(replayed.size,160);
    rows.push({...label,status:'conditional_finish',
      points:summary.pointPreview.status??'illustrative'});
  }

const completed=rows.filter(row=>row.status==='conditional_finish');
const refused=rows.filter(row=>row.status==='unpaid_front_catch');
assert.equal(rows.length,90);
assert.equal(completed.length,78);
assert.equal(refused.length,12);
console.log(JSON.stringify({scenarios:rows.length,completed:completed.length,
  refused:refused.length,
  byGender:genders.map(gender=>({gender,
    completed:completed.filter(row=>row.gender===gender).length,
    refused:refused.filter(row=>row.gender===gender).length})),
  byTerrain:terrains.map(terrain=>({terrain,
    completed:completed.filter(row=>row.terrain===terrain).length,
    refused:refused.filter(row=>row.terrain===terrain).length})),
  pointIllustrations:completed.filter(row=>
    row.points==='illustrative').length,
  refusals:refused},null,2));
