import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {playtestRiderCards} from '../../lib/engine/v2/playtest-riders.mjs';
import {summarizePlaytestRaceStory} from
  '../../lib/engine/v2/playtest-race-story.mjs';

test('rider guide shows the exact synthetic riders committed to the race',()=>{
  const prepared=prepareV91Playtest({teamCount:4,gender:'F',fatigue:15,
    teamOverrides:[{teamId:'rival-2',level:66,fatigue:30}]});
  for(const team of prepared.teams){
    assert.deepEqual(playtestRiderCards(prepared.settings,team.id),team.riders);
  }
  assert.equal(prepared.teams[0].riders[7].sprint,100);
  assert.equal(prepared.teams[0].riders[6].mountain,94);
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
