// Reproduce the opt-in, same-seed physical contact holdout. This
// validates source continuity, not real-race outcome calibration.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const audit=fileURLToPath(new URL(
  './audit-physical-field-scale.mjs',import.meta.url));
const distances=[120,260];
const fatigues=[10,30,50];
const rosters=[0,1,2,3,4,5,6];
const expectedKm={
  0:{10:62,30:62,50:63},
  1:{10:106,30:107,50:70},
  2:{10:62,30:62,50:62},
  3:{10:68,30:69,50:69},
  4:{10:66,30:66,50:67},
  5:{10:67,30:67,50:67},
  6:{10:188,30:188,50:188}};

function branchFor(roster,fatigue,distance){
  if(roster===6&&distance===120)
    return {kind:'no_catch',flag:'--expect-no-catch'};
  if(roster===6&&fatigue===10)
    return {kind:'front_rear',
      flag:'--expect-front-to-rear'};
  if(roster===1)
    return {kind:'front_rear',
      flag:fatigue===30?
        '--expect-mixed-catch':
        '--expect-front-to-rear'};
  if(roster===3)
    return {kind:'front_rear',
      flag:fatigue===10?'--expect-group-pass':
        fatigue===30?'--expect-mixed-catch':
          '--expect-early-bunch-before-front'};
  if(roster===5&&fatigue===50)
    return {kind:'front_rear',
      flag:'--expect-early-passage-before-front'};
  return {kind:'front_catch',
    flag:'--expect-front-catch'};
}

function runCase({roster,fatigue,distance}){
  const branch=branchFor(roster,fatigue,distance);
  const args=[audit,'--probe-front-rear-threat',
    branch.kind==='front_rear'?
      '--probe-discovered-front-to-rear':
      '--discovered-full-race',
    branch.flag,
    `--roster-variant=${roster}`,
    `--fatigue=${fatigue}`,
    `--distance=${distance}`,
    '--front-eases','--planned-relief',
    '--front-mountain=50',
    '--decision-coverage'];
  if(branch.kind!=='front_rear')
    args.push('--report-refusal');
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,args,
      {stdio:['ignore','pipe','pipe']});
    let output='';
    let errors='';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data',chunk=>output+=chunk);
    child.stderr.on('data',chunk=>errors+=chunk);
    child.on('error',reject);
    child.on('close',code=>{
      if(code!==0){
        reject(new Error(`Roster ${roster}, fatigue ${fatigue}, ${distance} km: ${errors.trim()}`));
        return;
      }
      try{
        const row=JSON.parse(output);
        const result=branch.kind==='front_rear'?
          row.frontToRearDiscoveryProbe:
          branch.kind==='front_catch'?
            row.discoveredRace:row.noCatchRace;
        assert.ok(result);
        assert.equal(result.finishRiderCount,160);
        assert.equal(result.decisionCoverage
          ?.riderKilometres,160*distance);
        assert.equal(result.decisionCoverage
          ?.missingDecisions,0);
        assert.equal(result.decisionCoverage
          ?.missingChoice,0);
        assert.equal(result.decisionCoverage
          ?.missingRiderId,0);
        assert.equal(result.decisionCoverage
          ?.missingReason,0);
        assert.equal(result.decisionCoverage
          ?.missingGoal,0);
        assert.equal(result.decisionCoverage
          ?.missingEffort,0);
        assert.equal(result.decisionCoverage
          ?.missingTeamOrderEffort,0);
        assert.equal(result.decisionCoverage
          ?.unknownEffort,0);
        assert.equal(result.decisionCoverage
          ?.orderEffortMismatch,0);
        assert.equal(result.decisionCoverage
          ?.effortExceedsOrder,0);
        for(const field of ['invalidEnergy',
          'invalidClock','nonForwardClock',
          'missingGroupId','missingRiderState',
          'duplicateRiderState','unknownRiderState',
          'nonSequentialKm','finishClockMismatch',
          'finishEnergyMismatch'])
          assert.equal(result.decisionCoverage
            ?.[field],0);
        assert.ok(result.decisionCoverage
          ?.decisionRows>=160*distance);
        if(branch.kind!=='no_catch')
          assert.equal(result.contactKm??
            result.catchKm,
          expectedKm[roster][fatigue]);
        resolve({roster,fatigue,distance,
          branch:branch.kind,
          contactKm:result.contactKm??
            result.catchKm??null,
          decisionRows:result.decisionCoverage
            .decisionRows,
          missingRiderId:result.decisionCoverage
            .missingRiderId,
          missingVersion:result.decisionCoverage
            .missingVersion,
          missingVersionByReason:result.decisionCoverage
            .missingVersionByReason,
          finishRiderCount:result.finishRiderCount});
      }catch(error){
        reject(new Error(`Roster ${roster}, fatigue ${fatigue}, ${distance} km: ${error.message}`));
      }
    });
  });
}

const cases=fatigues.flatMap(fatigue=>
  distances.flatMap(distance=>
    rosters.map(roster=>({
      roster,fatigue,distance}))));
const results=[];
let next=0;
async function worker(){
  while(next<cases.length){
    const index=next++;
    const row=await runCase(cases[index]);
    results[index]=row;
    process.stderr.write(
      `Verified ${index+1}/${cases.length}: roster ${row.roster}, fatigue ${row.fatigue}, ${row.distance} km\n`);
  }
}
try{
  await Promise.all(Array.from({length:3},
    ()=>worker()));
  assert.equal(results.length,42);
  const unversioned=results.filter(row=>
    row.missingVersion>0);
  assert.equal(unversioned.length,0,
    JSON.stringify(unversioned.map(row=>({
      roster:row.roster,fatigue:row.fatigue,
      distance:row.distance,
      missingVersion:row.missingVersion,
      reasons:row.missingVersionByReason}))));
  console.log(JSON.stringify({version:6,
    seed:'physical-20-team-scale-1',
    cases:results.length,
    finishRiderCount:160,
    results:results.map(({
      missingVersionByReason,...row})=>row)}));
}catch(error){
  console.error(error.message);
  process.exitCode=1;
}
