import test from 'node:test';
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../../lib/engine/v2/skills.mjs';
import {forecastBreakThreat,assessOneKmChaseDelay} from
  '../../lib/engine/v2/break-threat-matrix.mjs';
import {perceiveRivalStrength,assessRoadGroupsForObserver} from
  '../../lib/engine/v2/break-threat-perception.mjs';

function team(index,{skill=70,energy=60,chase='all'}={}){
  const id=`team-${index}`;
  const riders=Array.from({length:8},(_,number)=>({
    id:`${id}-${number}`,form:50,fatigue:20,
    ...Object.fromEntries(SPORTING_SKILLS.map(key=>[key,skill])),
  }));
  return {id,riders,energy:Object.fromEntries(riders.map(rider=>[rider.id,energy])),
    orders:{helperIds:riders.slice(2).map(rider=>rider.id),
      baseline:{effort:'steady',chase,breakWork:'cooperate'},phases:[]}};
}
function route(length){
  return Array.from({length},(_,index)=>({km:index+1,terrain:'flat',
    gradientPct:0,surface:'road',exposed:false,
    weather:{temperatureC:16,windKph:0,rainMm:0}}));
}

test('observer has stable bounded rival estimates and exact own riders',()=>{
  const teams=[team(1,{skill:80,energy:67}),team(2,{skill:55,energy:31})];
  const input={teams,observerTeamId:teams[0].id,raceSeed:'stable-perception'};
  const first=perceiveRivalStrength(input);
  const second=perceiveRivalStrength(input);
  assert.deepEqual(first,second);
  assert.deepEqual(first.teams[0].riders,teams[0].riders);
  assert.deepEqual(first.teams[0].energy,teams[0].energy);
  for(const rider of teams[1].riders){
    const seen=first.teams[1].riders.find(row=>row.id===rider.id);
    const bands=first.intervalsByRiderId[rider.id];
    for(const field of [...SPORTING_SKILLS,'form','fatigue']){
      assert.ok(Math.abs(seen[field]-rider[field])<=5);
      assert.ok(bands.skillIntervals[field][0]<=rider[field]);
      assert.ok(bands.skillIntervals[field][1]>=rider[field]);
    }
    assert.ok(Math.abs(first.teams[1].energy[rider.id]-
      teams[1].energy[rider.id])<=10);
    assert.ok(bands.energyInterval[0]<=teams[1].energy[rider.id]);
    assert.ok(bands.energyInterval[1]>=teams[1].energy[rider.id]);
  }
  assert.deepEqual(teams[1].riders[0].flat,55);
  assert.deepEqual(teams[1].energy[teams[1].riders[0].id],31);
});

test('two observers can hold different beliefs without altering true source',()=>{
  const teams=[team(1),team(2),team(3)];
  const left=perceiveRivalStrength({teams,observerTeamId:teams[0].id,
    raceSeed:'observer-difference'});
  const right=perceiveRivalStrength({teams,observerTeamId:teams[1].id,
    raceSeed:'observer-difference'});
  assert.notDeepEqual(left.teams[2].riders,right.teams[2].riders);
  assert.deepEqual(teams[2].riders[0].flat,70);
});

test('new attack is assessed separately from an older front group',()=>{
  const teams=[team(1),team(2),team(3)];
  const roadGroups=[
    {id:'road-1',riderIds:[teams[0].riders[0].id],teamIds:[teams[0].id],
      gapSeconds:120},
    {id:'road-2',riderIds:[teams[1].riders[0].id],teamIds:[teams[1].id],
      gapSeconds:35},
  ];
  const result=assessRoadGroupsForObserver({teams,roadGroups,
    observerTeamId:teams[2].id,raceSeed:'two-fronts',
    nominatedChaseTeamIds:[teams[2].id],remainingSegments:route(25)});
  assert.deepEqual(result.groups.map(row=>row.roadGroupId),['road-1','road-2']);
  assert.deepEqual(result.groups.map(row=>row.gapSeconds),[120,35]);
  assert.deepEqual(result.groups.map(row=>row.assessment.nominated.frontRiderCount),[1,1]);
  assert.deepEqual(result.groups.map(row=>row.assessment.nominated.unavailableRiderCount),[1,1]);
  assert.throws(()=>assessRoadGroupsForObserver({teams,roadGroups,
    observerTeamId:teams[2].id,raceSeed:'two-fronts',
    nominatedChaseTeamIds:[teams[0].id],remainingSegments:route(25)}),
  /coalition/);
  const forged=structuredClone(roadGroups);
  forged[1].teamIds=[teams[0].id];
  assert.throws(()=>assessRoadGroupsForObserver({teams,roadGroups:forged,
    observerTeamId:teams[2].id,raceSeed:'two-fronts',
    nominatedChaseTeamIds:[teams[2].id],remainingSegments:route(25)}),
  /coalition/);
});

test('observer can apply the physical one-leader matrix to both fronts',()=>{
  const teams=[team(1,{skill:78}),team(2,{skill:72}),
    team(3,{skill:82,chase:'all'})];
  const roadGroups=[
    {id:'road-1',riderIds:[teams[0].riders[0].id],
      teamIds:[teams[0].id],gapSeconds:90},
    {id:'road-2',riderIds:[teams[1].riders[0].id],
      teamIds:[teams[1].id],gapSeconds:25},
  ];
  const result=assessRoadGroupsForObserver({teams,roadGroups,
    observerTeamId:teams[2].id,raceSeed:'physical-two-fronts',
    nominatedChaseTeamIds:[teams[2].id],
    remainingSegments:route(35),rotationVersion:3});
  assert.equal(result.groups.length,2);
  assert.ok(result.groups.every(row=>
    row.assessment.nominated.rotationVersion===3));
  assert.ok(result.groups.every(row=>
    row.assessment.nominated.kilometres[0].chaseLeaderAbility!==null));
});

test('physical observer does not read rival private work orders',()=>{
  const teams=[team(1,{skill:72}),team(2,{skill:80}),team(3)];
  const roadGroups=[{id:'road-1',riderIds:[teams[0].riders[0].id],
    teamIds:[teams[0].id],gapSeconds:45}];
  const input={roadGroups,observerTeamId:teams[2].id,
    raceSeed:'private-rival-orders',
    nominatedChaseTeamIds:[teams[1].id],
    remainingSegments:route(30),rotationVersion:3};
  const before=assessRoadGroupsForObserver({...input,teams});
  const changed=structuredClone(teams);
  changed[0].orders.baseline.breakWork='sit_on';
  changed[1].orders.baseline.chase='ignore';
  changed[1].orders.helperIds=[];
  const after=assessRoadGroupsForObserver({...input,teams:changed});
  assert.deepEqual(after.groups,before.groups);
});

test('underestimating a front rider can change the expected catch',()=>{
  const teams=[team(1,{skill:80,energy:80}),
    team(2,{skill:70,energy:80,chase:'all'})];
  const base={frontRiderIds:[teams[0].riders[0].id],
    chaseTeamIds:[teams[1].id],remainingSegments:route(30)};
  const trueBudget=forecastBreakThreat({...base,teams,gapSeconds:200})
    .allInCatchableGapSeconds;
  let underestimated=null;
  for(let index=0;index<100;index++){
    const belief=perceiveRivalStrength({teams,observerTeamId:teams[1].id,
      raceSeed:`belief-${index}`});
    const perceivedBudget=forecastBreakThreat({...base,teams:belief.teams,
      gapSeconds:200}).allInCatchableGapSeconds;
    if(perceivedBudget>trueBudget+1){underestimated=belief;break;}
  }
  assert.ok(underestimated,'at least one stable observer bias underestimates the front');
  const believedBudget=forecastBreakThreat({...base,teams:underestimated.teams,
    gapSeconds:200}).allInCatchableGapSeconds;
  const gap=(trueBudget+believedBudget)/2;
  assert.equal(forecastBreakThreat({...base,teams,gapSeconds:gap})
    .allInCatchPossible,false);
  assert.equal(forecastBreakThreat({...base,teams:underestimated.teams,
    gapSeconds:gap}).allInCatchPossible,true);
});

test('tired and unavailable helpers materially shrink chase capacity',()=>{
  const front=team(1,{skill:70,energy:80});
  const fresh=team(2,{skill:80,energy:90,chase:'all'});
  const tired=team(2,{skill:80,energy:20,chase:'all'});
  for(const rider of tired.riders)rider.fatigue=70;
  const base={frontRiderIds:[front.riders[0].id],chaseTeamIds:[fresh.id],
    remainingSegments:route(30),gapSeconds:300};
  const freshBudget=forecastBreakThreat({...base,teams:[front,fresh]})
    .allInCatchableGapSeconds;
  const tiredBudget=forecastBreakThreat({...base,teams:[front,tired]})
    .allInCatchableGapSeconds;
  const injuredBudget=forecastBreakThreat({...base,teams:[front,tired],
    unavailableRiderIds:tired.orders.helperIds.slice(0,4)})
    .allInCatchableGapSeconds;
  assert.ok(freshBudget>tiredBudget);
  assert.ok(tiredBudget>injuredBudget);
});

test('a stable underestimate can delay the chase by one decisive kilometre',()=>{
  const teams=[team(1,{skill:80,energy:80}),
    team(2,{skill:70,energy:80,chase:'all'})];
  const base={frontRiderIds:[teams[0].riders[0].id],
    nominatedChaseTeamIds:[teams[1].id],remainingSegments:route(30)};
  const trueNow=forecastBreakThreat({...base,teams,
    chaseTeamIds:[teams[1].id],gapSeconds:200})
    .allInCatchableGapSeconds;
  const trueLater=forecastBreakThreat({...base,teams,
    chaseTeamIds:[teams[1].id],gapSeconds:200,chaseStartKm:2})
    .allInCatchableGapSeconds;
  let witness=null;
  for(let index=0;index<100;index++){
    const perceived=perceiveRivalStrength({teams,
      observerTeamId:teams[1].id,raceSeed:`delay-belief-${index}`});
    const believedLater=forecastBreakThreat({...base,teams:perceived.teams,
      chaseTeamIds:[teams[1].id],gapSeconds:200,chaseStartKm:2})
      .allInCatchableGapSeconds;
    const headroom=Math.min(trueNow,believedLater)-trueLater;
    if(headroom<=.1)continue;
    const gap=trueLater+headroom/2;
    const actual=assessOneKmChaseDelay({...base,teams,gapSeconds:gap});
    const belief=assessOneKmChaseDelay({...base,teams:perceived.teams,
      gapSeconds:gap});
    if(actual.nominatedMustStartNow&&!belief.nominatedMustStartNow){
      witness={actual,belief};break;
    }
  }
  assert.ok(witness,'bounded uncertainty can shift the chase start decision');
  assert.equal(witness.actual.now.nominated.allInCatchPossible,true);
  assert.equal(witness.belief.deferred.nominated.allInCatchPossible,true);
});
