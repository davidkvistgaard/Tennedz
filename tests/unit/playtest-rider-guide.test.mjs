import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {playtestRiderCards} from '../../lib/engine/v2/playtest-riders.mjs';
import {summarizePlaytestRaceStory} from
  '../../lib/engine/v2/playtest-race-story.mjs';
import {raceViewerCheckpoints,raceViewerEnergySeries,
  raceViewerBreaksAndChase,raceViewerFinale,raceViewerRoad} from
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
  atOneKm:'in the bunch'}]);
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
