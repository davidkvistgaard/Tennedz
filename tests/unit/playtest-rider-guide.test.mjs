import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {playtestRiderCards} from '../../lib/engine/v2/playtest-riders.mjs';
import {summarizePlaytestRaceStory} from
  '../../lib/engine/v2/playtest-race-story.mjs';
import {raceViewerCheckpoints,raceViewerEnergySeries,
  raceViewerEnergyCurve,
  raceViewerBreaksAndChase,raceViewerFinale,raceViewerRoad,
  raceViewerLateEffort,raceViewerLateTeamWork,
  raceViewerEffortInsight,raceViewerTimeline,raceViewerRivalAt} from
  '../../lib/engine/v2/playtest-viewer.mjs';

test('rider guide shows the exact synthetic riders committed to the race',()=>{
  const prepared=prepareV91Playtest({teamCount:4,gender:'F',fatigue:15,
    teamOverrides:[{teamId:'rival-2',level:66,fatigue:30}]});
  for(const team of prepared.teams){
    assert.deepEqual(playtestRiderCards(prepared.settings,team.id),team.riders);
  }
  assert.equal(prepared.teams[0].riders[7].sprint,100);
  assert.equal(prepared.teams[0].riders[6].mountain,94);
});

test('viewer finale uses only the selected rider paid 500 m and line state',()=>{
  const race={settings:{distanceKm:40},
    kilometreFrames:[{ownRiders:[{riderId:'you-7',energy:65}]}],
    bandReplays:[{id:'peloton',riderIds:['you-7'],
      passageAt500Seconds:44,frames:[{startDistanceM:39500,
        riders:[{riderId:'you-7',energyAtDecision:60,role:'sheltered'}]}]}],
    lineTimes:[{riderId:'you-7',energyAtLine:48,
      elapsedSecondsFromLastKmStart:87}]};
  assert.deepEqual(raceViewerFinale(race,'you-7'),{
    atOneKmEnergy:65,at500Energy:60,at500Role:'sheltered',
    at500Seconds:44,atLineEnergy:48,atLineSeconds:87,
    roadBandId:'peloton'});
  race.bandReplays[0].frames[0].startDistanceM=39600;
  assert.equal(raceViewerFinale(race,'you-7').at500Energy,null);
});

test('viewer road orders recorded fronts, solo riders and bunch without losing riders',()=>{
  const frame={roadGroups:[
    {id:'road-1',gapSeconds:12.5,riderIds:['you-2','rival-1-0']},
    {id:'road-2',gapSeconds:4,riderIds:['rival-2-0']}],
  droppedRiders:[{riderId:'you-3',deficitSeconds:3.2}],
  ownRiders:Array.from({length:8},(_,index)=>({riderId:`you-${index}`}))};
  const road=raceViewerRoad(frame,32);
  assert.deepEqual(road.map(row=>[row.label,row.riderCount,row.gapSeconds]),[
    ['Front group 1',2,12.5],['Front group 2',1,4],
    ['Bunch',28,0],['you-3 riding alone',1,-3.2]]);
  assert.deepEqual(road.map(row=>row.ownRiderIds),[
    ['you-2'],[],['you-0','you-1','you-4','you-5','you-6','you-7'],['you-3']]);
});

test('rival focus ties a manager to its recorded finisher and road actions',()=>{
  const race={settings:{teamCount:4},
    managerDecisions:[{teamId:'rival-2',finisherId:'rival-2-7'}],
    managerOrders:[{teamId:'rival-2',effort:'steady',attack:'selective',
      chase:'all'}],lineTimes:[{riderId:'rival-2-7',energyAtLine:42}]};
  const frame={roadGroups:[{id:'road-1',gapSeconds:7.5,
    riderIds:['rival-2-7','rival-2-1']}],
    droppedRiders:[{riderId:'rival-2-3',deficitSeconds:2}],
    attackAttempts:['rival-2-7','rival-1-0'],
    joinedRiderIds:['rival-2-7'],caughtRiderIds:[],
    pullRiderIds:['rival-2-1'],chasingTeamIds:['rival-2']};
  assert.deepEqual(raceViewerRivalAt(race,frame,'rival-2'),{
    teamId:'rival-2',finisherId:'rival-2-7',
    orders:race.managerOrders[0],
    finisherRoad:'7.5 s ahead with 2 riders',
    frontCount:2,bunchCount:5,droppedCount:1,
    attacks:['rival-2-7'],joins:['rival-2-7'],catches:[],
    pulls:['rival-2-1'],chased:true,lineEnergy:42});
  assert.equal(raceViewerRivalAt(race,frame,'rival-4'),null);
});

test('late effort snapshot reads the chosen phase and recorded rider road',()=>{
  const race={settings:{distanceKm:40},managerOrders:[{teamId:'you',
    effort:'steady',phaseOrders:[{atKm:35,effort:'hard'}]}],
  kilometreFrames:[{km:35,roadGroups:[{id:'road-1',gapSeconds:8,
    riderIds:['you-7']}],droppedRiders:[],
  ownRiders:[{riderId:'you-7',energy:51}]},
  {km:39,roadGroups:[{id:'road-1',gapSeconds:4.8,
    riderIds:['rival-1-7']}],droppedRiders:[],
    ownRiders:[{riderId:'you-7',energy:28}]}]};
  assert.deepEqual(raceViewerLateEffort(race,'you-7'),{
    effort:'hard',atFiveKmEnergy:51,
    atFiveKmRoad:'8.0 s ahead with 1 rider',
    atOneKmEnergy:28,atOneKmRoad:'in the bunch',
    atOneKmFrontGapSeconds:4.8});
});

test('late team work counts only paid activity after the 5 km order',()=>{
  const frames=[{km:35,attackAttempts:['you-1'],
    caughtRiderIds:[],
    chasingTeamIds:['you'],pullRiderIds:['you-2'],
    paidBunchPaceTeamId:'you'},
  {km:36,attackAttempts:['you-1','rival-1-2'],
    caughtRiderIds:[],
    chasingTeamIds:['rival-1'],pullRiderIds:['rival-1-3'],
    paidBunchPaceTeamId:'rival-1'},
  {km:37,attackAttempts:[],chasingTeamIds:['you'],
    caughtRiderIds:['rival-1-7','rival-2-7'],
    pullRiderIds:['you-2'],paidBunchPaceTeamId:null},
  {km:38,attackAttempts:[],chasingTeamIds:[],
    caughtRiderIds:[],
    pullRiderIds:[],paidBunchPaceTeamId:'you'}];
  assert.deepEqual(raceViewerLateTeamWork({settings:{distanceKm:40},
    kilometreFrames:frames}),{recordedKm:3,
    catches:[{km:37,riderIds:['rival-1-7','rival-2-7']}],
    attacks:1,chaseKm:1,
    breakPullKm:1,bunchPaceKm:1});
});

test('late effort takeaway only isolates matching plans and finisher',()=>{
  const before={planWithoutLateEffort:'same',finisherId:'you-7',
    lateEffort:{effort:'conserve'},energyAtLine:48,place:'12'};
  const after={...before,lateEffort:{effort:'hard'},
    energyAtLine:39,place:'13'};
  assert.equal(raceViewerEffortInsight(before,after),
    'Only your 5 km effort changed. In the current run, you-7 had 9.0 less energy at the line and conditional place 13 instead of 12.');
  assert.match(raceViewerEffortInsight(before,{...after,place:'12'}),
    /hard spent more energy without improving the conditional place/);
  assert.doesNotMatch(raceViewerEffortInsight({...before,place:null},
    {...after,place:null}),/without improving/);
  assert.match(raceViewerEffortInsight(before,{...after,
    planWithoutLateEffort:'changed'}),/do not isolate/);
  assert.match(raceViewerEffortInsight(before,{...after,
    finisherId:'you-6'}),/do not isolate/);
});

test('viewer timeline reports recorded attacks, chase, road changes and catches',()=>{
  const base={roadGroups:[],droppedRiders:[],attackAttempts:[],
    joinedRiderIds:[],caughtRiderIds:[],engagedChaseTeamIds:[]};
  const frames=[{...base,km:1},
    {...base,km:2,attackAttempts:['you-2'],engagedChaseTeamIds:['you']},
    {...base,km:3,roadGroups:[{id:'road-1',riderIds:['you-2']}],
      joinedRiderIds:['you-2'],engagedChaseTeamIds:['you']},
    {...base,km:4,caughtRiderIds:['you-2']}];
  assert.deepEqual(raceViewerTimeline({kilometreFrames:frames}).map(row=>
    [row.km,row.messages]),[
    [1,['Race recording begins']],
    [2,['1 attack attempt: you-2','Your team chased']],
    [3,['Road changed: 1 front group, 0 riding alone',
      'you-2 joined a front group']],
    [4,['Road changed: 0 front groups, 0 riding alone',
      'you-2 was caught','Your team stopped chasing',
      'Final kilometre begins']]]);
});

test('viewer keeps paid chase visible in the kilometre that catches a front',()=>{
  const base={roadGroups:[],droppedRiders:[],attackAttempts:[],
    joinedRiderIds:[],caughtRiderIds:[],engagedChaseTeamIds:[],
    chasingTeamIds:[],ownRiders:[{riderId:'you-7',energy:80}],
    terrain:'flat'};
  const race={settings:{distanceKm:40},kilometreFrames:[
    {...base,km:38,roadGroups:[{id:'road-1',riderIds:[
      'rival-1-7','rival-2-7','rival-3-7'],gapSeconds:.26}],
    engagedChaseTeamIds:['you'],chasingTeamIds:['you']},
    {...base,km:39,caughtRiderIds:[
      'rival-1-7','rival-2-7','rival-3-7'],
    chasingTeamIds:['you']}],lastKmRoad:[],lineTimes:[]};
  assert.equal(raceViewerBreaksAndChase(race).ownChaseKm,2);
  const catchMoment=raceViewerTimeline(race).at(-1);
  assert.equal(catchMoment.km,39);
  assert.match(catchMoment.messages.join(' · '),/3 riders were caught/);
  assert.doesNotMatch(catchMoment.messages.join(' · '),
    /stopped chasing/);
  assert.equal(raceViewerCheckpoints(race,'you-7').at(-1).chasing,true);
});

test('viewer timeline links a paid final catch to its exact recorded road',()=>{
  const frame={km:39,roadGroups:[],droppedRiders:[],attackAttempts:[],
    joinedRiderIds:[],caughtRiderIds:[],engagedChaseTeamIds:[]};
  const race={kilometreFrames:[frame],
    frontCatch:{roadGroupId:'road-1',atDistanceM:39279.115,
      caughtRiderIds:['you-1','rival-1-7']},
    lastKmRoad:[{distanceM:39000},
      {distanceM:39500,contact:{atDistanceM:39279.115}},
      {distanceM:40000}],lineTimes:[{riderId:'you-1'}]};
  const moment=raceViewerTimeline(race).at(-1);
  assert.equal(moment.km,39.279);
  assert.equal(moment.finaleRoadIndex,1);
  assert.match(moment.messages[0],/you-1, rival-1-7/);
  assert.equal(raceViewerTimeline({...race,lineTimes:[]}).length,1);
  assert.equal(raceViewerTimeline({...race,lastKmRoad:[
    {distanceM:39000,groups:[{id:'road-1'}]},
    {distanceM:39500,groups:[]},
    {distanceM:40000,groups:[]}]}).at(-1).finaleRoadIndex,1);
  assert.equal(raceViewerTimeline({...race,lastKmRoad:[
    {distanceM:39000,groups:[{id:'road-1'}]},
    {distanceM:40000,groups:[{id:'road-1'}]}]}).length,1);
});

test('viewer checkpoints keep recorded attack, catch, position and energy',()=>{
  const frames=Array.from({length:10},(_,index)=>({km:index+1,
    terrain:'flat',attackAttempts:index===2?['you-2']:[],
    joinedRiderIds:index===3?['you-2']:[],
    caughtRiderIds:index===7?['you-2']:[],
    engagedChaseTeamIds:index===7?['you']:[],
    roadGroups:index===5?[{id:'road-1',riderIds:['you-7'],
      gapSeconds:4.2}]:[],droppedRiders:[],
    ownRiders:[{riderId:'you-7',energy:90-index}]}));
  const checkpoints=raceViewerCheckpoints({settings:{distanceKm:11},
    kilometreFrames:frames},'you-7');
  assert.deepEqual(checkpoints.filter(row=>row.moments.length)
    .map(row=>[row.km,row.moments[0]]),[
      [3,'you-2 tried to attack'],[4,'you-2 joined a break'],
      [8,'you-2 was caught']]);
  assert.equal(checkpoints.find(row=>row.km===6).position,
    '4.2 s ahead with 1 rider');
  assert.equal(checkpoints.at(-1).energy,81);
  assert.deepEqual(raceViewerEnergySeries({kilometreFrames:frames},'you-7')
    .map(row=>row.energy),[90,89,88,87,86,85,84,83,82,81]);
  const breaks=raceViewerBreaksAndChase({kilometreFrames:frames});
  assert.equal(breaks.ownChaseKm,1);
  assert.deepEqual(breaks.riders,[{riderId:'you-2',events:[
    'km 3: tried to attack','km 4: joined a break','km 8: was caught'],
  fate:'Caught at km 8',firstKm:3,atOneKm:'in the bunch'}]);
});

test('viewer energy curve reaches only a paid individual line',()=>{
  const race={settings:{distanceKm:3},kilometreFrames:[
    {km:1,ownRiders:[{riderId:'you-7',energy:88}]},
    {km:2,ownRiders:[{riderId:'you-7',energy:74}]}],
  lineTimes:[{riderId:'you-7',energyAtLine:42}]};
  assert.deepEqual(raceViewerEnergyCurve(race,'you-7'),[
    {km:1,energy:88},{km:2,energy:74},
    {km:3,energy:42,line:true}]);
  assert.deepEqual(raceViewerEnergyCurve({...race,lineTimes:null},'you-7'),[
    {km:1,energy:88},{km:2,energy:74}]);
});

test('breakaway fate requires a recorded join, catch or clear finish road',()=>{
  const frames=[{km:3,attackAttempts:['you-2','you-7'],
    joinedRiderIds:['you-7'],caughtRiderIds:[],engagedChaseTeamIds:[],
    roadGroups:[],droppedRiders:[],ownRiders:[]},
  {km:39,attackAttempts:[],joinedRiderIds:[],caughtRiderIds:[],
    engagedChaseTeamIds:[],roadGroups:[{id:'road-1',gapSeconds:8,
      riderIds:['you-7']}],droppedRiders:[],ownRiders:[]}];
  const race={kilometreFrames:frames,
    lastKmRoad:[{groups:[{id:'road-1',gapSeconds:7,
      riderIds:['you-7']}],droppedPassages:[]}],
    lineTimes:[{riderId:'you-7'}]};
  const riders=raceViewerBreaksAndChase(race).riders;
  assert.equal(riders.find(row=>row.riderId==='you-7').firstKm,3);
  assert.equal(riders.find(row=>row.riderId==='you-7').fate,
    'Still in a recorded front group at the line');
  assert.equal(riders.find(row=>row.riderId==='you-2').fate,
    'No front-group join recorded');
  race.lastKmRoad[0].groups=[];
  assert.equal(raceViewerBreaksAndChase(race).riders.find(row=>
    row.riderId==='you-7').fate,
  'No catch recorded, but no separate front finish is confirmed');
  race.sharedWheelContact={roadGroupId:'road-1',atDistanceM:39750};
  assert.equal(raceViewerBreaksAndChase(race).riders.find(row=>
    row.riderId==='you-7').fate,
  'Caught at 39.750 km on the paid final road');
  race.sharedWheelContact={roadGroupId:'road-2',atDistanceM:39750};
  assert.equal(raceViewerBreaksAndChase(race).riders.find(row=>
    row.riderId==='you-7').fate,
  'No catch recorded, but no separate front finish is confirmed');
  delete race.sharedWheelContact;
  race.frontCatch={roadGroupId:'road-1',atDistanceM:39225,
    caughtRiderIds:['you-7']};
  assert.equal(raceViewerBreaksAndChase(race).riders.find(row=>
    row.riderId==='you-7').fate,
  'Caught at 39.225 km on the paid final road');
});

test('race story only names events and positions present in the recording',()=>{
  const race={managerDecisions:[{teamId:'you',finisherId:'you-7'}],
    kilometreFrames:[
      {km:12,attackAttempts:['you-2'],joinedRiderIds:[],caughtRiderIds:[]},
      {km:13,attackAttempts:[],joinedRiderIds:['you-2'],caughtRiderIds:[]},
      {km:34,attackAttempts:[],joinedRiderIds:[],caughtRiderIds:['you-2']},
      {km:39,attackAttempts:[],joinedRiderIds:[],caughtRiderIds:[],
        roadGroups:[{id:'road-1',gapSeconds:7.2,riderIds:['rival-1-0']}],
        droppedRiders:[],ownRiders:[{riderId:'you-7',
          roadGroup:'peloton',energy:46.1}]}]};
  assert.deepEqual(summarizePlaytestRaceStory(race),[
    'Km 12: you-2 attempted an attack.',
    'Km 13: you-2 joined a front group.',
    'Km 34: you-2 was caught.',
    'With 1 km to go, your team had no rider in a front group.',
    'With 1 km to go, you-7 was in the bunch with 46.1 of 100 energy remaining.']);
});
