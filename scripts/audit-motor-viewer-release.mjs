// Reproduce the experimental Motor Lab -> viewer export across complete races.
// This reports calibration; it does not bless the preview as an official race.
import {createPhysicalFirstRaceDocumentV2} from
  '../lib/viewer/physical-first-race-document-v2.mjs';

const smoke=process.argv.includes('--smoke');
const strict=process.argv.includes('--require-calibrated');
const seeds=smoke?['preview-recorded-road-1']:
  ['preview-recorded-road-1','viewer-release-holdout-2'];
const cases=[];
for(const seed of seeds)
  for(const category of ['men','women'])
    for(const terrain of ['flat','rolling','mountain'])
      for(const chase of ['selective','all'])
        for(const attack of ['none','selective','repeated']){
          if(smoke&&attack!=='none'&&terrain!=='mountain')continue;
          cases.push({category,terrain,chase,attack,seed});
        }

const rows=[];
for(const input of cases){
  try{
    const {category,...variant}=input;
    const document=createPhysicalFirstRaceDocumentV2(
      category,variant);
    const {coverage,source,finishEvidence,feed}=document;
    rows.push({input,status:'complete',
      riderCount:coverage.riderCount,
      paidRiderKilometres:coverage.paidRiderKilometres,
      validatedRiderKilometres:source.validatedRiderKilometres,
      finishEntries:finishEvidence.entries.length,
      finishClockGroups:finishEvidence.clockGroups?.length??null,
      unresolvedTieRiders:finishEvidence.unresolvedTieRiders??null,
      boundaryFrames:coverage.boundaryFrames,
      recordedContactEvents:coverage.recordedContactEvents,
      sameSeedFinishMismatches:coverage.sameSeedFinishMismatches,
      maxFinishMismatchSeconds:coverage.maxFinishMismatchSeconds,
      officialResults:coverage.officialResults,
      sha256:document.sha256,
      durationSeconds:feed.duration});
  }catch(error){
    rows.push({input,status:'failed',
      sourceKm:error.sourceKm??null,error:error.message});
  }
}
const complete=rows.filter(row=>row.status==='complete');
const byAttack=Object.fromEntries(
  ['none','selective','repeated'].map(attack=>{
    const set=rows.filter(row=>row.input.attack===attack);
    return [attack,{scenarios:set.length,
      completed:set.filter(row=>row.status==='complete').length,
      calibrated:set.filter(row=>row.status==='complete'&&
        row.sameSeedFinishMismatches===0).length,
      mismatched:set.filter(row=>row.status==='complete'&&
        row.sameSeedFinishMismatches>0).length}];
  }));
const summary={version:'motor-viewer-release-audit-2',
  scenarios:rows.length,completed:complete.length,
  failed:rows.length-complete.length,
  calibrated:complete.filter(row=>
    row.sameSeedFinishMismatches===0).length,
  mismatched:complete.filter(row=>
    row.sameSeedFinishMismatches>0).length,
  officialResultsAvailable:complete.filter(row=>
    row.officialResults).length,
  unresolvedTieRiders:complete.reduce((count,row)=>
    count+(row.unresolvedTieRiders??0),0),
  racesWithUnresolvedTies:complete.filter(row=>
    row.unresolvedTieRiders>0).length,
  finishClockGroupsAvailable:complete.every(row=>
    Number.isInteger(row.finishClockGroups)&&
    row.finishClockGroups>0&&
    Number.isInteger(row.unresolvedTieRiders)),
  byAttack,
  readyForGuidedRace:rows.length>0&&rows.every(row=>
    row.status==='complete'&&
    row.sameSeedFinishMismatches===0&&
    row.unresolvedTieRiders===0&&
    row.officialResults)};
process.stdout.write(`${JSON.stringify({summary,rows},null,2)}\n`);
if(strict&&!summary.readyForGuidedRace)process.exitCode=1;
