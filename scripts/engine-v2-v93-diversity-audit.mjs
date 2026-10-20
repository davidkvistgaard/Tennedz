// Reproducible, synthetic coverage for the opt-in v93 road-to-line preview.
// This audit reports refusals; it never settles an event or awards points.
import assert from 'node:assert/strict';
import {pointsForDivisionResult} from '../lib/calendar/points.mjs';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest} from
  '../lib/engine/v2/playtest-v93-coasted.mjs';

const distances=[40,120,260];
const teamCounts=[4,15,20];
const genders=['M','F'];
const terrains=['flat','rolling','mountain','exposed','custom'];
const fatigues=[0,15,30];
const rivalPlans=['neutral','mixed','attack','chase'];
const attacks=['none','selective','repeated'];
const chases=['ignore','selective','all'];
const efforts=['conserve','steady','hard'];
const pointContextFor=index=>{
  const divisionCount=[1,2,4][index%3];
  return {tier:1+Math.floor(index/3)%6,
    divisionCount,
    divisionIndex:1+Math.floor(index/6)%divisionCount};
};
const settingsFor=index=>({
  distanceKm:distances[index%3],
  teamCount:teamCounts[Math.floor(index/3)%3],
  gender:genders[Math.floor(index/9)%2],
  terrain:terrains[index%5],
  fatigue:fatigues[Math.floor(index/2)%3],
  seed:`v93-diversity-${Math.floor(index/12)}`,
  defaultRivalPlan:rivalPlans[Math.floor(index/4)%4],
  attack:attacks[Math.floor(index/5)%3],
  chase:chases[Math.floor(index/7)%3],
  effort:efforts[Math.floor(index/11)%3],
  profileHeightsM:[100,350,150,500,180,100]});

const audit={scenarios:48,finished:0,refusals:[],versions:{},
  projectedPoints:0,unavailablePoints:0,unavailableCases:[],
  replayedVersions:[],tacticalVariants:[],
  conditionalCrossings:0,replayMatchedCrossings:0,
  pointTiers:[],divisionMultipliers:[]};
const replayed=new Set();
for(let index=0;index<audit.scenarios;index++){
  const settings=settingsFor(index);
  const pointContext=pointContextFor(index);
  let race;
  try{race=createV93PlayableTest(settings,{pointContext});}
  catch(error){
    audit.refusals.push({index,settings,error:error.message});
    continue;
  }
  const summary=summarizeV93CoastedPlaytest(race);
  assert.equal(summary.lineTimes.length,settings.teamCount*8);
  assert.equal(new Set(summary.lineTimes.map(row=>row.riderId)).size,
    settings.teamCount*8);
  const crossings=new Map(summary.lineTimes.map(row=>[row.riderId,row]));
  const replayedRiders=new Set();
  for(const band of summary.bandReplays){
    const finalFrame=band.frames.at(-1);
    assert.ok(finalFrame);
    assert.equal(finalFrame.riders.length,band.riderIds.length);
    for(const rider of finalFrame.riders){
      assert.equal(replayedRiders.has(rider.riderId),false);
      replayedRiders.add(rider.riderId);
      assert.ok(band.riderIds.includes(rider.riderId));
      const crossing=crossings.get(rider.riderId);
      assert.ok(crossing);
      assert.equal(crossing.roadBandId,band.id);
      assert.equal(rider.positionM,race.individualLine.lineDistanceM);
      assert.equal(rider.elapsedToLineSeconds,
        crossing.elapsedSecondsFromLastKmStart);
      assert.equal(rider.energyAfter,crossing.energyAtLine);
      audit.replayMatchedCrossings++;
    }
  }
  assert.equal(replayedRiders.size,crossings.size);
  if(summary.roadPlaceBounds){
    assert.equal(summary.roadPlaceBounds.pointsStatus,'withheld');
    assert.equal(summary.roadPlaceBounds.canCommitAwards,false);
    assert.equal(summary.roadPlaceBounds.bands.at(-1).lastPossiblePlace,
      crossings.size);
    for(const rider of summary.roadPlaceBounds.riders){
      assert.ok(crossings.has(rider.riderId));
      assert.ok(rider.firstPossiblePlace<=rider.lastPossiblePlace);
    }
  }
  assert.equal(race.canCommitAwards,false);
  assert.equal(race.pointsStatus,'withheld');
  assert.equal(race.pointPreview.canCommitAwards,false);
  if(race.pointPreview.status==='unavailable'){
    audit.unavailablePoints++;
    audit.unavailableCases.push({index,version:race.version,
      reason:race.pointPreview.reason,settings,
      clockBands:race.clock.line.bands.map(band=>({kind:band.kind,
        size:band.riderIds.length,firstPossiblePlace:band.firstPossiblePlace,
        lastPossiblePlace:band.lastPossiblePlace})),
      finalDroppedCount:race.clock.passageFrames.at(-1)
        .droppedPassages.length});
  }else{
    assert.equal(race.pointPreview.tier,pointContext.tier);
    assert.equal(race.pointPreview.divisionCount,
      pointContext.divisionCount);
    assert.equal(race.pointPreview.divisionIndex,
      pointContext.divisionIndex);
    if(!audit.pointTiers.includes(pointContext.tier))
      audit.pointTiers.push(pointContext.tier);
    if(!audit.divisionMultipliers.includes(race.pointPreview.multiplier))
      audit.divisionMultipliers.push(race.pointPreview.multiplier);
    assert.equal(race.pointPreview.riders.length,settings.teamCount*8);
    assert.equal(summary.provisionalLineOrder.length,crossings.size);
    const order=new Map(summary.provisionalLineOrder.map(row=>
      [row.riderId,row]));
    assert.equal(order.size,crossings.size);
    for(const rider of race.pointPreview.riders){
      assert.equal(order.get(rider.riderId)?.position,
        rider.provisionalPlace);
      assert.equal(crossings.get(rider.riderId)?.energyAtLine,
        order.get(rider.riderId)?.energyAtLine);
      assert.equal(rider.previewPoints,pointsForDivisionResult({
        tier:pointContext.tier,resultType:'ONE_DAY',
        placing:rider.provisionalPlace,
        multiplier:race.pointPreview.multiplier}));
    }
    audit.projectedPoints++;
  }
  if(!replayed.has(race.version)){
    assert.equal(validateV93CoastedPlaytest(settings,{pointContext},race),
      true);
    const plans=race.recording.committedInputs.teams.map(team=>({
      teamId:team.id,
      finisherId:team.riders.find(rider=>rider.id!==
        race.appliedPlans.find(plan=>plan.teamId===team.id).finisherId).id,
      leadOutRiderId:null}));
    const variant=createV93PlayableTest(settings,{pointContext,plans});
    const variantSummary=summarizeV93CoastedPlaytest(variant);
    assert.deepEqual(variant.recording,race.recording);
    assert.deepEqual(variant.clock,race.clock);
    assert.deepEqual(variant.appliedPlans.map(row=>row.finisherId),
      plans.map(row=>row.finisherId));
    assert.equal(variantSummary.lineTimes.length,crossings.size);
    const changedCrossings=variantSummary.lineTimes.filter(row=>{
      const previous=crossings.get(row.riderId);
      return row.elapsedSecondsFromLastKmStart!==
        previous.elapsedSecondsFromLastKmStart||
        row.energyAtLine!==previous.energyAtLine;
    }).length;
    assert.ok(changedCrossings>0);
    assert.equal(validateV93CoastedPlaytest(settings,{pointContext,plans},
      variant),true);
    const variantCrossings=new Map(variantSummary.lineTimes.map(row=>
      [row.riderId,row]));
    assert.equal(variantCrossings.size,crossings.size);
    for(const band of variantSummary.bandReplays)
      for(const rider of band.frames.at(-1).riders){
        const crossing=variantCrossings.get(rider.riderId);
        assert.equal(crossing.roadBandId,band.id);
        assert.equal(crossing.elapsedSecondsFromLastKmStart,
          rider.elapsedToLineSeconds);
        assert.equal(crossing.energyAtLine,rider.energyAfter);
      }
    if(variant.pointPreview.status!=='unavailable'){
      const variantOrder=new Map(variantSummary.provisionalLineOrder
        .map(row=>[row.riderId,row.position]));
      for(const rider of variant.pointPreview.riders){
        assert.equal(rider.provisionalPlace,
          variantOrder.get(rider.riderId));
        assert.equal(rider.previewPoints,pointsForDivisionResult({
          tier:pointContext.tier,resultType:'ONE_DAY',
          placing:rider.provisionalPlace,
          multiplier:variant.pointPreview.multiplier}));
      }
    }
    audit.tacticalVariants.push({version:race.version,
      managerCount:plans.length,changedCrossings,
      pointStatus:variant.pointPreview.status??'illustrative'});
    replayed.add(race.version);
    audit.replayedVersions.push(race.version);
  }
  audit.finished++;
  audit.conditionalCrossings+=summary.lineTimes.length;
  audit.versions[race.version]=(audit.versions[race.version]??0)+1;
}
assert.deepEqual([...audit.pointTiers].sort((a,b)=>a-b),
  [1,2,3,4,5,6]);
assert.ok(audit.divisionMultipliers.some(value=>value<1));
console.log(JSON.stringify(audit,null,2));
