// Whole-race plan variation for the locked 260 km shared-wheel finale.
// The road source is simulated once; each manager decision then pays a
// fresh sprint, all individual crossings and the same versioned replay.
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../lib/engine/v2/tuning.mjs';
import {recordFinaleCoastedWheelContactLine,
  validateFinaleCoastedWheelContactLine} from
  '../lib/engine/v2/finale-coasted-wheel-contact-line.mjs';

const tactics=[
  {effort:'hard',attack:'none',chase:'all'},
  {effort:'steady',attack:'selective',chase:'ignore'},
  {effort:'conserve',attack:'none',chase:'selective'},
  {effort:'steady',attack:'repeated',chase:'selective'}];
const settings={distanceKm:260,teamCount:20,gender:'M',terrain:'exposed',
  fatigue:0,seed:'v93-long-stress-M-exposed-0-2',
  defaultRivalPlan:'passive',effort:'steady',attack:'repeated',
  chase:'selective',managerTactics:Array.from({length:19},(_,index)=>
    tactics[index%tactics.length])};
const {stage,weather,teams,seed}=prepareV91Playtest(settings);
const tour=simulateTacticalTour({stage,weather,teams,seed,
  motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
validateRecordedTour(tour);
const byTeam=new Map(tour.committedInputs.teams.map(team=>
  [team.id,team]));
const base=tour.committedInputs.teams.map(team=>({teamId:team.id,
  finisherId:team.orders.captainId,leadOutRiderId:null}));
const roster=new Set(tour.committedInputs.teams.flatMap(team=>
  team.riders.map(rider=>rider.id)));
const planCases=[];
// rival-10 can nominate helpers in the active group; rival-1 has helpers
// already isolated, so its refusals must remain explicit.
for(const teamId of ['you','rival-10','rival-1']){
  const team=byTeam.get(teamId);
  for(const finisher of team.riders.map(rider=>rider.id))
    for(const helper of [null,...team.orders.helperIds]){
      if(helper===finisher)continue;
      planCases.push({teamId,finisher,helper});
    }
}
let firstContactM=null,withLeadOut=0,completed=0;
const helperRefusals=[];
for(const selected of planCases){
  const plans=base.map(row=>row.teamId===selected.teamId?{
    ...row,finisherId:selected.finisher,
    leadOutRiderId:selected.helper}:row);
  const input={plans};
  let line;
  try{line=recordFinaleCoastedWheelContactLine(tour,input);}
  catch(error){
    if(selected.helper===null||error.cause?.teamId!==selected.teamId||
      error.cause?.helperId!==selected.helper||
      !['exhausted','different_road_group'].includes(
        error.cause?.reason))throw error;
    helperRefusals.push({teamId:selected.teamId,
      helperId:selected.helper,reason:error.cause.reason});
    continue;
  }
  assert.equal(validateFinaleCoastedWheelContactLine(tour,input,line),true);
  assert.equal(line.finishers.length,roster.size);
  assert.deepEqual(new Set(line.finishers.map(row=>row.riderId)),roster);
  assert.equal(line.lineOrder.length,roster.size);
  const replayed=new Map(line.runner.frames.flatMap(frame=>frame.riders)
    .filter(row=>row.elapsedToLineSeconds!==null)
    .map(row=>[row.riderId,row]));
  for(const crossing of line.runner.finishers){
    const replay=replayed.get(crossing.riderId);
    assert.equal(replay?.elapsedToLineSeconds,
      crossing.elapsedSecondsFromLastKmStart);
    assert.equal(replay.energyAfter,crossing.energyAtLine);
  }
  for(const dropped of line.isolated){
    assert.equal(dropped.frames.at(-1).elapsedSecondsFromLastKmStart,
      dropped.elapsedSecondsFromLastKmStart);
    assert.equal(dropped.frames.at(-1).energy,dropped.energyAtLine);
  }
  assert.equal(replayed.size+line.isolated.length,roster.size);
  assert.equal(line.classifiedResults,null);
  assert.equal(line.pointsStatus,'withheld');
  assert.equal(line.canCommitAwards,false);
  if(firstContactM===null)firstContactM=line.contact.bunchEdgeM;
  assert.equal(line.contact.bunchEdgeM,firstContactM);
  completed++;
  if(selected.helper!==null){
    assert.ok(line.runner.frames.some(frame=>frame.riders.some(row=>
      row.riderId===selected.helper&&row.role==='lead_out'&&
      row.energySpent>0)));
    withLeadOut++;
  }
}
assert.ok(planCases.length>=140&&completed>=90&&withLeadOut>0&&
  helperRefusals.length>0);
console.log(JSON.stringify({fullRacePlanCases:planCases.length,
  completed,withLeadOut,helperRefusals:helperRefusals.length,
  completeFinishers:roster.size,
  sharedWheelContactM:firstContactM,
  resultStatus:'conditional_no_official_awards'},null,2));
