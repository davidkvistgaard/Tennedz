import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {finaleDistanceGrid} from '../../lib/engine/v2/finale-grid.mjs';
import {advanceFinaleNamedAttackTransition} from
  '../../lib/engine/v2/finale-named-attack-transition.mjs';
import {continueFinaleNamedAttackGroup} from
  '../../lib/engine/v2/finale-named-attack-followup.mjs';
import {continueFinaleNamedAttackBunch,
  continueFinaleNamedAttackBunchChain,
  validateFinaleNamedAttackBunchStep,
  validateFinaleNamedAttackBunchChain} from
  '../../lib/engine/v2/finale-named-attack-bunch-step.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';

const stage={distance_km:40,profile_points:[[0,100],[40,100]],
  keypoints:[{km:10,kind:'SPRINT'},{km:20,kind:'SPRINT'}]};
function team(id,chase,attack=false){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender:'M',flat:id==='a'?70:85,
    timetrial:id==='a'?40:85,
    strength:id==='a'?60:85,endurance:65,
    acceleration:id==='a'?95:70,repeatability:70,
    sprint:55,leadership:50,
  })),orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    helperIds:[`${id}-2`],preset:'balanced',
    baseline:{effort:'hard',chase,attack:'none',breakWork:'cooperate'},
    phases:attack?[{atKm:35,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

test('a caught or contained named attack enters one paid passive bunch slice',()=>{
  const tour=simulateTacticalTour({stage,
    teams:[team('a','ignore',true),team('b','all')],
    seed:'finale-named-bunch',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const teams=tour.committedInputs.teams;
  const pelotonRiderIds=teams.flatMap(row=>row.riders.map(rider=>rider.id));
  const energies=new Map(pelotonRiderIds.map(id=>[id,40]));
  const grid=finaleDistanceGrid(tour.route,{remainingKm:4});
  const first=grid.find(row=>row.sourceKm===40);
  const launchInput={slice:first,route:tour.route,teams,
    pelotonRiderIds,energies,attackerTeamId:'a',
    attackerRiderId:'a-0',repeatLoad:0};
  const launch=advanceFinaleNamedAttackTransition(launchInput);
  assert.equal(launch.attack.status,'split');
  const followup=continueFinaleNamedAttackGroup({launchInput,launch,
    slice:grid[grid.indexOf(first)+1]});
  assert.ok(followup.catchDistanceM);
  const caughtInput={launchInput,launch,followup,
    slice:grid[grid.indexOf(first)+2]};
  const caught=continueFinaleNamedAttackBunch(caughtInput);
  assert.equal(caught.sourceFrameVersion,followup.version);
  assert.deepEqual(caught.roadGroups,[]);
  assert.equal(caught.pelotonRiderIds.length,16);
  assert.equal(caught.riderEnergy.length,16);
  assert.ok(caught.riderEnergy.every(row=>row.role==='sheltered'&&
    row.energySpent>0&&row.energyAfter>=0));
  assert.equal(validateFinaleNamedAttackBunchStep(caughtInput,caught),true);
  assert.throws(()=>validateFinaleNamedAttackBunchStep(caughtInput,{
    ...caught,bunchElapsedSeconds:0}),/does not replay/);
  assert.throws(()=>continueFinaleNamedAttackBunch({...caughtInput,
    followup:{...followup,catchDistanceM:0}}),/does not replay/);
  const caughtFrames=[caught];
  for(const nextSlice of grid.slice(grid.indexOf(first)+3)){
    const next=continueFinaleNamedAttackBunchChain({launchInput,launch,
      followup,frames:caughtFrames,slice:nextSlice});
    caughtFrames.push(next);
  }
  assert.equal(caughtFrames.at(-1).endDistanceM,40000);
  assert.equal(caughtFrames.at(-1).pelotonRiderIds.length,16);
  assert.ok(caughtFrames.slice(1).every(row=>
    row.version==='v2-finale-named-attack-bunch-step-2'));
  const lastCatchInput={launchInput,launch,followup,
    frames:caughtFrames.slice(0,-1),slice:grid.at(-1)};
  assert.equal(validateFinaleNamedAttackBunchChain(lastCatchInput,
    caughtFrames.at(-1)),true);
  assert.throws(()=>continueFinaleNamedAttackBunchChain({
    ...lastCatchInput,frames:[{...caught,bunchElapsedSeconds:0},
      ...caughtFrames.slice(1,-1)]}),/does not replay/);
  const weakTeams=teams.map(row=>row.id==='a'?{...row,
    riders:row.riders.map(rider=>({...rider,flat:20,
      timetrial:20,strength:20,acceleration:20}))}:row);
  const containedInput={...launchInput,teams:weakTeams,repeatLoad:3};
  const containedLaunch=advanceFinaleNamedAttackTransition(containedInput);
  assert.equal(containedLaunch.attack.status,'contained');
  const contained=continueFinaleNamedAttackBunch({
    launchInput:containedInput,launch:containedLaunch,
    slice:grid[grid.indexOf(first)+1]});
  assert.equal(contained.sourceFrameVersion,containedLaunch.version);
  assert.deepEqual(contained.pelotonRiderIds,pelotonRiderIds);
  assert.equal(contained.riderEnergy.length,16);
  const containedFrames=[contained];
  for(const nextSlice of grid.slice(grid.indexOf(first)+2)){
    const next=continueFinaleNamedAttackBunchChain({
      launchInput:containedInput,launch:containedLaunch,
      frames:containedFrames,slice:nextSlice});
    containedFrames.push(next);
  }
  assert.equal(containedFrames.at(-1).endDistanceM,40000);
  assert.deepEqual(containedFrames.at(-1).pelotonRiderIds,
    pelotonRiderIds);
  assert.throws(()=>continueFinaleNamedAttackBunch({
    launchInput:containedInput,launch:containedLaunch,
    slice:grid[grid.indexOf(first)+2]}),/adjacent/);
  const rotatingTeams=weakTeams.map(row=>row.id==='b'?{...row,
    orders:{...row.orders,baseline:{...row.orders.baseline,
      frontWork:'rotate'}}}:row);
  assert.throws(()=>continueFinaleNamedAttackBunch({
    launchInput:{...containedInput,teams:rotatingTeams},
    launch:advanceFinaleNamedAttackTransition({...containedInput,
      teams:rotatingTeams}),slice:grid[grid.indexOf(first)+1]}),
  /rotation needs recorded work/);
});
