import test from 'node:test';
import assert from 'node:assert/strict';
import {raceViewerGapSeries,raceViewerRoadClockSnapshot,
  raceViewerSituationAt} from
  '../../lib/engine/v2/playtest-viewer.mjs';
import {playtestRiderCards} from
  '../../lib/engine/v2/playtest-riders.mjs';

test('situation reports distance, field, own roads, energy and starting fatigue separately',()=>{
  const settings={distanceKm:40,teamCount:3,gender:'M',fatigue:15,
    teamOverrides:[{teamId:'you',fatigue:30}]};
  const frame={km:11,roadGroups:[
    {id:'road-1',gapSeconds:12.4,riderIds:['you-2','rival-1-1']},
    {id:'road-2',gapSeconds:3.2,riderIds:['rival-2-3']}],
  droppedRiders:[{riderId:'you-6',deficitSeconds:8.5}],
  ownRiders:Array.from({length:8},(_,index)=>({riderId:`you-${index}`,
    energy:80-index}))};
  const result=raceViewerSituationAt({settings},frame,
    playtestRiderCards(settings,'you'));
  assert.equal(result.km,11);
  assert.equal(result.remainingKm,29);
  assert.deepEqual([result.frontGroups,result.frontRiders,
    result.isolatedRiders,result.bunchRiders,result.leadGapSeconds],
  [2,3,1,20,12.4]);
  assert.equal(result.own.length,8);
  assert.deepEqual(result.own.find(row=>row.riderId==='you-2'),{
    riderId:'you-2',name:'Your test team rider 3',energy:78,
    startingFatigue:30,position:'Front group · +12.4 s'});
  assert.equal(result.own.find(row=>row.riderId==='you-6').position,
    'Alone behind · −8.5 s');
  assert.equal(result.own.find(row=>row.riderId==='you-7').position,'Bunch');
  assert.equal(result.own.find(row=>row.riderId==='you-7').energy,73);
  assert.equal(result.own.find(row=>row.riderId==='you-7').startingFatigue,30);
});

test('situation refuses an absent frame rather than inventing rider state',()=>{
  assert.equal(raceViewerSituationAt({settings:{distanceKm:40}},null,[]),null);
});

test('group-clock chart derives only recorded checkpoint time gaps',()=>{
  const ownRiders=[{riderId:'you-2',energy:70}];
  const race={kilometreFrames:[
    {km:1,roadGroups:[{gapSeconds:18,riderIds:['you-2']}],
      droppedRiders:[],ownRiders},
    {km:2,roadGroups:[{gapSeconds:22,riderIds:['rival-1-0']}],
      droppedRiders:[],ownRiders},
    {km:3,roadGroups:[{gapSeconds:25,riderIds:['rival-1-0']}],
      droppedRiders:[{riderId:'you-2',deficitSeconds:7}],ownRiders},
  ]};
  assert.deepEqual(raceViewerGapSeries(race,'you-2'),[
    {km:1,leadingGroupSeconds:18,riderSeconds:18},
    {km:2,leadingGroupSeconds:22,riderSeconds:0},
    {km:3,leadingGroupSeconds:25,riderSeconds:-7},
  ]);
  assert.deepEqual(raceViewerGapSeries(race,'you-7'),[]);
});

test('group-clock chart can follow a valid rival through recorded group and bunch clocks',()=>{
  const race={settings:{teamCount:2},kilometreFrames:[
    {km:1,roadGroups:[{gapSeconds:12,riderIds:['rival-1-3']}],
      droppedRiders:[],ownRiders:[]},
    {km:2,roadGroups:[],droppedRiders:[],ownRiders:[]},
    {km:3,roadGroups:[],droppedRiders:[{riderId:'rival-1-3',
      deficitSeconds:4}],ownRiders:[]},
  ]};
  assert.deepEqual(raceViewerGapSeries(race,'rival-1-3'),[
    {km:1,leadingGroupSeconds:12,riderSeconds:12},
    {km:2,leadingGroupSeconds:0,riderSeconds:0},
    {km:3,leadingGroupSeconds:0,riderSeconds:-4},
  ]);
  assert.deepEqual(raceViewerGapSeries(race,'rival-2-3'),[]);
});

test('road-clock snapshot follows only current recorded group identities',()=>{
  const ownRiders=['you-2','you-3','you-7'].map(riderId=>({riderId,
    energy:70}));
  const race={kilometreFrames:[
    {km:1,roadGroups:[{id:'old',gapSeconds:12,riderIds:['you-2']}],
      droppedRiders:[],ownRiders},
    {km:2,roadGroups:[{id:'old',gapSeconds:14,riderIds:['you-2']},
      {id:'new',gapSeconds:5,riderIds:['rival-1-0']}],
    droppedRiders:[],ownRiders},
    {km:3,roadGroups:[{id:'new',gapSeconds:7,
      riderIds:['rival-1-0','you-3']}],
    droppedRiders:[{riderId:'you-2',deficitSeconds:9}],ownRiders},
  ]};
  assert.deepEqual(raceViewerRoadClockSnapshot(race,2),{
    groups:[
      {id:'old',gapSeconds:14,riderCount:1,ownRiderIds:['you-2'],
        trace:[{km:1,gapSeconds:12},{km:2,gapSeconds:14}]},
      {id:'new',gapSeconds:5,riderCount:1,ownRiderIds:[],
        trace:[{km:2,gapSeconds:5}]},
    ],bunchOwnRiderIds:['you-3','you-7'],isolatedOwn:[],
  });
  assert.deepEqual(raceViewerRoadClockSnapshot(race,3)?.groups[0].trace,[
    {km:2,gapSeconds:5},{km:3,gapSeconds:7}]);
  assert.deepEqual(raceViewerRoadClockSnapshot(race,3)?.isolatedOwn,[
    {riderId:'you-2',seconds:-9}]);
  assert.equal(raceViewerRoadClockSnapshot(race,4),null);
});
