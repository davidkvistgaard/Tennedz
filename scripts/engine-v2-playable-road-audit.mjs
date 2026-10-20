// Reproducible fictional road coverage for the opt-in v91 test drive.
// A paid line or band is not an official result or a sporting win-rate target.
import assert from 'node:assert/strict';
import {POINT_POLICY_VERSION,pointsForDivisionResult} from
  '../lib/calendar/points.mjs';
import {runV91TestDrive} from './engine-v2-test-drive.mjs';

const routes=[
  {distanceKm:40,terrain:'flat',fatigue:0},
  {distanceKm:40,terrain:'exposed',fatigue:15},
  {distanceKm:120,terrain:'rolling',fatigue:15},
  {distanceKm:120,terrain:'custom',fatigue:15,
    profileHeightsM:[100,350,150,500,180,100]},
  {distanceKm:260,terrain:'mountain',fatigue:30}];
const modes={
  mixed:{attack:'selective',chase:'selective'},
  attack:{attack:'repeated',chase:'ignore'},
  chase:{attack:'none',chase:'all'}};
const pointPreview=process.argv.includes('--point-preview');
const individualLines=pointPreview||process.argv.includes('--individual-lines');
if(process.argv.slice(2).some(arg=>
  !['--individual-lines','--point-preview'].includes(arg)))
  throw new Error('Usage: node scripts/engine-v2-playable-road-audit.mjs [--individual-lines] [--point-preview]');
const scenarios=[];
for(const route of routes)for(const gender of ['M','F'])
  for(const teamCount of [4,15,20])
    for(const [mode,orders] of Object.entries(modes))
      scenarios.push({kind:'baseline',mode,settings:{...route,gender,
        teamCount,seed:'test-drive-acceptance-1',
        defaultRivalPlan:mode,...orders}});

// These pairs vary actual manager choices and rider ability/fatigue, not the
// seed alone. They expose boundaries that a homogeneous default field misses.
for(const route of routes)for(const gender of ['M','F']){
  const settings={...route,gender,teamCount:4,
    seed:'test-drive-acceptance-1',defaultRivalPlan:'mixed',
    teamOverrides:[{teamId:'you',level:74,fatigue:route.fatigue},
      {teamId:'rival-1',level:88,fatigue:0},
      {teamId:'rival-2',level:66,fatigue:30}]};
  scenarios.push({kind:'independent',mode:'coordinated_chase',settings:{
    ...settings,attack:'none',chase:'all',managerTactics:[
      {effort:'hard',attack:'none',chase:'all'},
      {effort:'conserve',attack:'none',chase:'ignore'},
      {effort:'hard',attack:'none',chase:'all'}]}});
  scenarios.push({kind:'independent',mode:'split_intents',settings:{
    ...settings,attack:'repeated',chase:'ignore',managerTactics:[
      {effort:'hard',attack:'none',chase:'all'},
      {effort:'steady',attack:'repeated',chase:'ignore'},
      {effort:'conserve',attack:'none',chase:'selective'}]}});
}

const rows=scenarios.map(({kind,mode,settings})=>{
  const output=runV91TestDrive({settings,
    ...(individualLines?{individualGroupLine:true}: {}),
    ...(pointPreview?{pointContext:{tier:3,divisionIndex:1,
      divisionCount:1}}:{})});
  const status=output.roadStatus??output.status;
  const expected=settings.teamCount*8;
  assert.equal(output.pointsStatus,'withheld');
  assert.equal(output.canCommitAwards,false);
  assert.ok(['paid_conditional_line','conditional_multiband_line',
    'conditional_depleted_line','recorded_depleted_bands'].includes(status),
  `Unexpected unpaid road: ${settings.terrain} ${settings.gender} ${settings.teamCount} ${mode}: ${status}`);
  if(status==='paid_conditional_line'||
    status==='conditional_multiband_line'||
    status==='conditional_depleted_line'){
    assert.equal(output.finale.lineTimes.length,expected);
    assert.equal(new Set(output.finale.lineTimes.map(row=>row.riderId))
      .size,expected);
    if(status==='conditional_multiband_line'||
      status==='conditional_depleted_line'){
      assert.equal(output.finale.overlapAudit!==undefined,true);
      assert.equal(output.finale.lineTimes.every(row=>
        Number.isFinite(row.elapsedSecondsFromLastKmStart)&&
        Number.isFinite(row.energyAtLine)),true);
    }
  }else{
    assert.equal(settings.terrain,'mountain');
    assert.equal(settings.teamCount,4);
    assert.equal(mode,'mixed');
    assert.equal(output.finale.lineTimes,undefined);
    assert.equal(output.finale.finalRiderEnergy.length,expected);
    if(status!=='paid_group_bands')
      assert.equal(output.finale.bands.at(-1).lastPossiblePlace,expected);
    assert.equal(output.finale.individualFinishStatus,
      'unresolved_within_road_bands');
  }
  if(pointPreview){
    const preview=output.provisionalPointPreview;
    assert.ok(preview);
    if(Array.isArray(preview.riders)){
      assert.equal(preview.riders.length,expected);
      assert.equal(new Set(preview.riders.map(row=>row.riderId)).size,
        expected);
      assert.equal(preview.pointsPolicyVersion,POINT_POLICY_VERSION);
      assert.equal(preview.canCommitAwards,false);
      assert.deepEqual(preview.awardRows,[]);
      const crossings=new Map(output.finale.lineTimes.map(row=>[
        row.riderId,row]));
      for(const [index,row] of preview.riders.entries()){
        const crossing=crossings.get(row.riderId);
        assert.ok(crossing);
        assert.equal(row.provisionalPlace,index+1);
        assert.equal(row.elapsedSecondsFromLastKmStart,
          crossing.elapsedSecondsFromLastKmStart);
        assert.equal(row.energyAtLine,crossing.energyAtLine);
        assert.equal(row.previewPoints,pointsForDivisionResult({
          tier:3,resultType:'ONE_DAY',placing:index+1,
          multiplier:preview.multiplier}));
      }
    }else{
      assert.equal(preview.status,'unavailable');
      assert.ok(preview.reason);
    }
  }
  return {kind,mode,distanceKm:settings.distanceKm,
    terrain:settings.terrain,fatigue:settings.fatigue,
    gender:settings.gender,teamCount:settings.teamCount,
    roadGroups:output.lastKmSource?.roadGroups.length??null,
    droppedRiders:output.lastKmSource?.droppedRiderIds.length??null,
    status,...(status==='unsupported'?{reason:output.reason}:{}),
    ...(pointPreview?{pointPreviewStatus:
      output.provisionalPointPreview.status??'read_only'}:{}),
    ...(status==='conditional_multiband_line'?{
      potentialPre500ActiveOverlap:
        output.finale.pre500Audit.firstPotentialOverlap!==null,
      potentialCrossBandOverlap:
        output.finale.overlapAudit.firstPotentialOverlap!==null,
      provisionalUniqueOrder:output.finale.provisionalLineOrder?.every(
        row=>row.position!==null)??false}:{}),
    ...(status==='conditional_depleted_line'?{
      potentialCrossBandOverlap:
        output.finale.overlapAudit.firstPotentialOverlap!==null,
      pre500ContactStatus:output.finale.pre500ContactStatus,
      provisionalUniqueOrder:
        output.finale.provisionalLineOrder?.every(row=>
          row.position!==null)??false}:{}),
    ...(status==='recorded_depleted_bands'||
      status==='recorded_dropped_bands'?{
        totalUnmetEnergyDemand:output.finale.totalUnmetEnergyDemand}: {})};
});
const counts=Object.fromEntries([...new Set(rows.map(row=>row.status))]
  .sort().map(status=>[status,rows.filter(row=>row.status===status).length]));
console.log(JSON.stringify({version:pointPreview?
  'v2-playable-road-audit-point-preview-8':individualLines?
    'v2-playable-road-audit-individual-7':'v2-playable-road-audit-2',
  seed:'test-drive-acceptance-1',scenarios:rows.length,counts,rows},null,2));
