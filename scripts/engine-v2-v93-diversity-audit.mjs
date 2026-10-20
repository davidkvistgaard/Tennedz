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
const pointContext={tier:3,divisionIndex:1,divisionCount:1};
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
  projectedPoints:0,unavailablePoints:0,replayedVersions:[],
  conditionalCrossings:0};
const replayed=new Set();
for(let index=0;index<audit.scenarios;index++){
  const settings=settingsFor(index);
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
  assert.equal(race.canCommitAwards,false);
  assert.equal(race.pointsStatus,'withheld');
  assert.equal(race.pointPreview.canCommitAwards,false);
  if(race.pointPreview.status==='unavailable')
    audit.unavailablePoints++;
  else{
    assert.equal(race.pointPreview.riders.length,settings.teamCount*8);
    for(const rider of race.pointPreview.riders)
      assert.equal(rider.previewPoints,pointsForDivisionResult({
        tier:pointContext.tier,resultType:'ONE_DAY',
        placing:rider.provisionalPlace,
        multiplier:race.pointPreview.multiplier}));
    audit.projectedPoints++;
  }
  if(!replayed.has(race.version)){
    assert.equal(validateV93CoastedPlaytest(settings,{pointContext},race),
      true);
    replayed.add(race.version);
    audit.replayedVersions.push(race.version);
  }
  audit.finished++;
  audit.conditionalCrossings+=summary.lineTimes.length;
  audit.versions[race.version]=(audit.versions[race.version]??0)+1;
}
console.log(JSON.stringify(audit,null,2));
