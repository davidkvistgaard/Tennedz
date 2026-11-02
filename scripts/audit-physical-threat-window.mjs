// Read-only search for a paid-front pursuit decision window. It reports
// source-derived gaps and perceived actions without moving road groups.
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../lib/engine/v2/skills.mjs';
import {normalizeOrders} from '../lib/engine/v2/orders.mjs';
import {commitTeamChaseStakesV1} from
  '../lib/engine/v2/team-chase-stake-v1.mjs';
import {startPhysicalBunchV1} from
  '../lib/engine/v2/physical-start-bunch-v1.mjs';
import {decidePhysicalFrontThreatV1} from
  '../lib/engine/v2/physical-front-threat-choice-v1.mjs';
import {advancePhysicalPerceivedChaseKmV1} from
  '../lib/engine/v2/physical-perceived-chase-km-v1.mjs';

const route=Array.from({length:20},(_,index)=>({km:index+1,
  terrain:'flat',gradientPct:0,surface:'road',exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}}));
const field=()=>['control','sprint','other'].map(id=>{
  const riders=Array.from({length:8},(_,number)=>({
    id:`${id}-${number}`,form:50,fatigue:20,
    ...Object.fromEntries(SPORTING_SKILLS.map(skill=>
      [skill,96]))}));
  return {id,riders,
    energy:Object.fromEntries(riders.map(row=>[row.id,92])),
    orders:{captainId:riders[0].id,
      helperIds:riders.slice(2).map(row=>row.id),
      baseline:{effort:'steady',attack:'none',chase:'ignore',
        ...(id==='control'?{frontWork:'rotate',
          frontWorkRiderId:'control-2'}:{})},phases:[]}};
});

function choice({attackerSkill,observerSkill,choiceKm}){
  const teams=field();
  for(const skill of SPORTING_SKILLS){
    teams[2].riders[2][skill]=attackerSkill;
    for(const rider of teams[1].riders)
      rider[skill]=observerSkill;
  }
  teams[2].orders.phases=[{atKm:1,attack:'selective',
    attackRiderId:'other-2',effort:'hard'}];
  teams[0].orders.phases=[{atKm:choiceKm-1,
    frontWork:'sit_in'}];
  teams[1].orders.phases=[{atKm:choiceKm-1,
    chase:'selective',frontWork:'rotate',
    frontWorkRiderId:'sprint-2'}];
  for(const team of teams)team.orders=normalizeOrders(team.orders,{
    riderIds:team.riders.map(rider=>rider.id),
    distanceKm:20,keypoints:[{km:1},{km:choiceKm-1}],
    allowFrontWork:true,allowNamedFrontWorker:true});
  const commitment=commitTeamChaseStakesV1({teams,
    distanceKm:20,keypoints:[{km:1},{km:choiceKm-1}],
    intentions:teams.map(team=>({teamId:team.id,
      baseline:{goal:team.id==='sprint'?'sprint_finish':
        team.id==='other'?'break_stage':'none',
      captainId:team.riders[0].id},phases:[]}))});
  const startInput={teams,routeKilometres:route,commitment,
    raceSeed:'same-threat-window-seed'};
  const start=startPhysicalBunchV1(startInput);
  const input={startInput,start,
    attackKm:2,choiceKm,observerTeamId:'sprint',
    nominatedChaseTeamIds:['sprint']};
  const recording=decidePhysicalFrontThreatV1(input);
  const action=recording.choice.choice.assessments[0].action;
  let paidGapChangeSeconds;
  if(['commit_now','commit_and_request_help'].includes(action)){
    const paid=advancePhysicalPerceivedChaseKmV1(input);
    paidGapChangeSeconds=+(paid.gapSecondsToBunch-
      recording.observedGapSeconds).toFixed(3);
  }
  return {attackerSkill,observerSkill,choiceKm,
    gapSeconds:+recording.observedGapSeconds.toFixed(3),
    action,
    headroomSeconds:+recording.choice.choice.assessments[0]
      .nominatedHeadroomSeconds.toFixed(3),
    estimatedGapChangeSeconds:recording.paceEstimate
      .estimatedGapChangeSeconds,
    ...(paidGapChangeSeconds===undefined?{}:{paidGapChangeSeconds})};
}

const results=[];
for(const attackerSkill of [94,95,96,97])
  for(const observerSkill of [95,96,97,98,99,100])
    for(let choiceKm=4;choiceKm<=19;choiceKm++){
      try{results.push(choice({attackerSkill,observerSkill,
        choiceKm}));}
      catch(error){results.push({attackerSkill,observerSkill,
        choiceKm,refused:error.message});}
    }
const actionCounts=Object.fromEntries([...new Set(results.map(row=>
  row.action??'refused'))].map(action=>[action,results.filter(row=>
    (row.action??'refused')===action).length]));
const commitWindows=results.filter(row=>
  ['commit_now','commit_and_request_help'].includes(row.action));
if(process.argv.includes('--assert')){
  assert.equal(results.length,384);
  assert.equal(actionCounts.refused??0,0);
  assert.equal(actionCounts.commit_now,3);
  assert.equal(commitWindows.length,3);
  assert.ok(commitWindows.every(row=>
    Number.isFinite(row.paidGapChangeSeconds)&&
    Math.abs(row.estimatedGapChangeSeconds-
      row.paidGapChangeSeconds)<.1));
  assert.ok(actionCounts.watch>0&&
    actionCounts.capacity_shortfall>0);
}
process.stdout.write(JSON.stringify({version:1,
  raceSeed:'same-threat-window-seed',actionCounts,
  commitWindows,
  ...(process.argv.includes('--verbose')?{results}:{})},
null,2)+'\n');
