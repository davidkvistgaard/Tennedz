import test from 'node:test';
import assert from 'node:assert/strict';
import {forecastBreakThreat,assessBreakThreatRange,assessOneKmChaseDelay} from
  '../../lib/engine/v2/break-threat-matrix.mjs';

function team(index,{flat=50,mountain=50,energy=90,chase='selective',
  breakWork='cooperate'}={}){
  const id=`team-${index}`;
  const riders=Array.from({length:8},(_,riderIndex)=>({
    id:`${id}-${riderIndex}`,flat,mountain,strength:55,endurance:55,
    hills:50,sprint:50,cobbles:50,wind:50,timetrial:50,form:50,fatigue:0,
  }));
  return {id,riders,energy:Object.fromEntries(riders.map(rider=>[rider.id,energy])),
    orders:{helperIds:riders.slice(2).map(rider=>rider.id),
      baseline:{effort:'steady',chase,breakWork},phases:[]}};
}
function route(terrain,length){
  return Array.from({length},(_,index)=>({km:index+1,terrain,
    gradientPct:terrain==='climb'?8:0,surface:'road',exposed:false,
    weather:{temperatureC:16,windKph:0,rainMm:0}}));
}

test('matrix exposes front size, available chase helpers, route and shadow energy',()=>{
  const teams=[team(1),team(2),team(3)];
  const result=forecastBreakThreat({teams,
    frontRiderIds:[teams[0].riders[0].id,teams[0].riders[1].id],
    chaseTeamIds:[teams[1].id,teams[2].id],
    remainingSegments:route('flat',10),gapSeconds:120});
  assert.equal(result.frontRiderCount,2);
  assert.equal(result.frontTeamCount,1);
  assert.equal(result.chaseTeamCount,2);
  assert.equal(result.peakConcurrentChaseHelpers,4);
  assert.ok(result.participatingChaseHelperCount>=4);
  assert.equal(result.potentialChaseHelperCountAtStart,12);
  assert.ok(result.frontWorkReserveAtStart>0);
  assert.ok(result.chaseWorkReserveAtStart>0);
  assert.equal(result.terrainKilometres.flat,10);
  assert.ok(result.frontWorkerKm>0);
  assert.ok(result.chaseHelperKm>0);
  assert.ok(result.frontEnergySpent>0);
  assert.ok(result.chaseEnergySpent>0);
  assert.equal(result.kilometres.length,10);
});

test('weak climbers lose more modeled ground to strong climbers on a final climb',()=>{
  const front=team(1,{flat:70,mountain:20});
  const chasing=team(2,{flat:45,mountain:90,chase:'all'});
  const input={teams:[front,chasing],frontRiderIds:[front.riders[0].id],
    chaseTeamIds:[chasing.id],gapSeconds:600};
  const flat=forecastBreakThreat({...input,remainingSegments:route('flat',25)});
  const climb=forecastBreakThreat({...input,remainingSegments:route('climb',25)});
  assert.ok(climb.projectedGapSeconds<flat.projectedGapSeconds);
  // The current road clock still cannot honestly promise a ten-minute catch.
  assert.equal(climb.allInCatchPossible,false);
});

test('physical matrix gives equal riders one leader speed, with reserve from rotation',()=>{
  const front=team(1,{flat:65});
  const chasing=team(2,{flat:75,chase:'all'});
  const input={teams:[front,chasing],chaseTeamIds:[chasing.id],
    remainingSegments:route('flat',30),gapSeconds:60,rotationVersion:3};
  const one=forecastBreakThreat({...input,
    frontRiderIds:[front.riders[0].id]});
  const two=forecastBreakThreat({...input,
    frontRiderIds:[front.riders[0].id,front.riders[1].id]});
  assert.equal(one.kilometres[0].frontAbility,two.kilometres[0].frontAbility);
  assert.ok(two.frontWorkReserveAtStart>one.frontWorkReserveAtStart);
  assert.ok(one.kilometres[0].chaseLeaderAbility!==null);
  assert.ok(one.kilometres[0].chaseRecoverySeconds>=0);
});

test('physical matrix can distinguish a weak climbing break from a strong flat break',()=>{
  const weak=team(1,{flat:70,mountain:20});
  const climbers=team(2,{flat:45,mountain:90,chase:'all'});
  const climbing=forecastBreakThreat({teams:[weak,climbers],
    frontRiderIds:[weak.riders[0].id],chaseTeamIds:[climbers.id],
    remainingSegments:route('climb',150),gapSeconds:600,
    rotationVersion:3});
  assert.equal(climbing.terrainKilometres.climb,150);
  assert.ok(climbing.allInCatchableGapSeconds>0);
  const strong=Array.from({length:15},(_,index)=>team(index+3,{flat:88}));
  const slow=team(20,{flat:55,chase:'all'});
  const flat=forecastBreakThreat({teams:[...strong,slow],
    frontRiderIds:strong.flatMap(row=>row.riders.slice(0,2).map(r=>r.id)),
    chaseTeamIds:[slow.id],remainingSegments:route('flat',30),
    gapSeconds:180,rotationVersion:3});
  assert.equal(flat.frontRiderCount,30);
  assert.equal(flat.allInCatchPossible,false);
});

test('large strong flat front with few helpers is urgent under the current clock',()=>{
  const teams=Array.from({length:20},(_,index)=>team(index+1,{
    flat:index<15?88:55,mountain:50,chase:index<15?'ignore':'selective',
  }));
  const frontRiderIds=teams.slice(0,15).flatMap(row=>row.riders.slice(0,2)
    .map(rider=>rider.id));
  const result=forecastBreakThreat({teams,frontRiderIds,
    chaseTeamIds:[teams[15].id],remainingSegments:route('flat',30),
    gapSeconds:180});
  assert.equal(result.frontRiderCount,30);
  assert.equal(result.peakConcurrentChaseHelpers,2);
  assert.ok(result.projectedGapSeconds>0);
  assert.equal(result.allInCatchPossible,false);
});

test('no willing chase team contributes zero chase energy',()=>{
  const teams=[team(1),team(2)];
  const result=forecastBreakThreat({teams,
    frontRiderIds:[teams[0].riders[0].id],chaseTeamIds:[],
    remainingSegments:route('flat',5),gapSeconds:20});
  assert.equal(result.chaseHelperKm,0);
  assert.equal(result.chaseEnergySpent,0);
  assert.equal(result.participatingChaseHelperCount,0);
});

test('more committed chase capacity and more road time increase the catch budget',()=>{
  const teams=[team(1),team(2,{chase:'all'}),team(3,{chase:'all'})];
  const base={teams,frontRiderIds:[teams[0].riders[0].id],gapSeconds:300};
  const one=forecastBreakThreat({...base,chaseTeamIds:[teams[1].id],
    remainingSegments:route('flat',20)});
  const two=forecastBreakThreat({...base,chaseTeamIds:[teams[1].id,teams[2].id],
    remainingSegments:route('flat',20)});
  const late=forecastBreakThreat({...base,chaseTeamIds:[teams[1].id],
    remainingSegments:route('flat',5)});
  assert.ok(two.allInCatchableGapSeconds>one.allInCatchableGapSeconds);
  assert.ok(one.allInCatchableGapSeconds>late.allInCatchableGapSeconds);
});

test('a stronger and larger working front reduces the catch budget',()=>{
  const weak=team(1,{flat:35}),strong=team(2,{flat:90});
  const chasing=team(3,{flat:65,chase:'all'});
  const input={teams:[weak,strong,chasing],chaseTeamIds:[chasing.id],
    remainingSegments:route('flat',20),gapSeconds:300};
  const small=forecastBreakThreat({...input,
    frontRiderIds:[weak.riders[0].id]});
  const larger=forecastBreakThreat({...input,
    frontRiderIds:[weak.riders[0].id,strong.riders[0].id]});
  assert.ok(larger.allInCatchableGapSeconds<small.allInCatchableGapSeconds);
});

test('dropped helpers cannot enter the chase forecast',()=>{
  const teams=[team(1),team(2,{chase:'all'})];
  const input={teams,frontRiderIds:[teams[0].riders[0].id],
    chaseTeamIds:[teams[1].id],remainingSegments:route('flat',5),
    gapSeconds:100};
  const full=forecastBreakThreat(input);
  const dropped=forecastBreakThreat({...input,
    unavailableRiderIds:teams[1].orders.helperIds.slice(0,5)});
  assert.equal(dropped.unavailableRiderCount,5);
  assert.equal(dropped.potentialChaseHelperCountAtStart,1);
  assert.equal(dropped.peakConcurrentChaseHelpers,1);
  assert.ok(dropped.allInCatchableGapSeconds<full.allInCatchableGapSeconds);
  assert.throws(()=>forecastBreakThreat({...input,
    unavailableRiderIds:[teams[0].riders[0].id]}),/roster/);
});

test('all-in headroom is a capacity comparison and does not spend source energy',()=>{
  const teams=[team(1),team(2,{chase:'all'})];
  const energyBefore=structuredClone(teams.map(row=>row.energy));
  const result=forecastBreakThreat({teams,
    frontRiderIds:[teams[0].riders[0].id],chaseTeamIds:[teams[1].id],
    remainingSegments:route('flat',10),gapSeconds:100});
  assert.equal(result.allInGapHeadroomSeconds,
    +(result.allInCatchableGapSeconds-100).toFixed(2));
  assert.deepEqual(teams.map(row=>row.energy),energyBefore);
});

test('threat range distinguishes nominated, conditional and insufficient pursuit',()=>{
  const teams=[team(1,{flat:75}),team(2,{flat:65,chase:'all'}),
    team(3,{flat:85,chase:'all'})];
  const input={teams,frontRiderIds:[teams[0].riders[0].id],
    nominatedChaseTeamIds:[teams[1].id],
    conditionalChaseTeamIds:[teams[2].id],
    remainingSegments:route('flat',30)};
  const baseline=assessBreakThreatRange({...input,gapSeconds:100});
  const lower=baseline.nominated.allInCatchableGapSeconds;
  const upper=baseline.expanded.allInCatchableGapSeconds;
  assert.ok(upper>lower&&lower>0);
  assert.equal(assessBreakThreatRange({...input,gapSeconds:lower/2}).capacityBand,
    'nominated_capacity');
  assert.equal(assessBreakThreatRange({...input,
    gapSeconds:(lower+upper)/2}).capacityBand,'conditional_capacity');
  assert.equal(assessBreakThreatRange({...input,
    gapSeconds:upper+10}).capacityBand,'beyond_available_capacity');
  assert.throws(()=>assessBreakThreatRange({...input,
    conditionalChaseTeamIds:[teams[1].id]}),/coalition/);
});

test('a committed mid-race order changes the chase forecast at its marker',()=>{
  const front=team(1,{flat:75});
  const chaser=team(2,{flat:75,chase:'ignore'});
  chaser.orders.phases=[{atKm:10,chase:'all'}];
  const result=forecastBreakThreat({teams:[front,chaser],
    frontRiderIds:[front.riders[0].id],chaseTeamIds:[chaser.id],
    remainingSegments:route('flat',20),gapSeconds:150});
  assert.ok(result.kilometres.slice(0,10).every(row=>row.chaseHelpers===0));
  assert.ok(result.kilometres.slice(10).some(row=>row.chaseHelpers>0));
});

test('one-kilometre wait can exhaust the calculated chase headroom',()=>{
  const teams=[team(1,{flat:75}),team(2,{flat:80,chase:'all'})];
  const base={teams,frontRiderIds:[teams[0].riders[0].id],
    nominatedChaseTeamIds:[teams[1].id],remainingSegments:route('flat',20)};
  const now=forecastBreakThreat({...base,chaseTeamIds:[teams[1].id],
    gapSeconds:100});
  const later=forecastBreakThreat({...base,chaseTeamIds:[teams[1].id],
    gapSeconds:100,chaseStartKm:2});
  assert.ok(now.allInCatchableGapSeconds>later.allInCatchableGapSeconds);
  const gap=(now.allInCatchableGapSeconds+later.allInCatchableGapSeconds)/2;
  const decision=assessOneKmChaseDelay({...base,gapSeconds:gap});
  assert.equal(decision.now.nominated.allInCatchPossible,true);
  assert.equal(decision.deferred.nominated.allInCatchPossible,false);
  assert.equal(decision.nominatedMustStartNow,true);
});

test('opt-in one-rider rotation trades stacked speed for helper endurance',()=>{
  const teams=[team(1,{flat:60}),team(2,{flat:80,chase:'all'}),
    team(3,{flat:75,chase:'all'})];
  const input={teams,frontRiderIds:[teams[0].riders[0].id],
    chaseTeamIds:[teams[1].id,teams[2].id],
    remainingSegments:route('flat',10),gapSeconds:120};
  const stacked=forecastBreakThreat(input);
  const rotated=forecastBreakThreat({...input,rotationVersion:2});
  assert.equal(rotated.rotationVersion,2);
  assert.equal(rotated.peakConcurrentChaseHelpers,4);
  assert.ok(rotated.kilometres[0].chasePower<stacked.kilometres[0].chasePower);
  assert.ok(rotated.chaseEnergySpent<stacked.chaseEnergySpent);
  assert.ok(rotated.allInCatchableGapSeconds<stacked.allInCatchableGapSeconds);
});
