import test from 'node:test';
import assert from 'node:assert/strict';
import {flatScenario} from '../../lib/race-lab/scenario.mjs';
import {runKilometreLab} from '../../lib/engine/v2/lab.mjs';

test('a held peloton can let a break ride, catch it and face a new move',()=>{
 const scenario=flatScenario('sprint');
 scenario.teams[0].chaseContribution='ignore';
 scenario.teams[1].strategy='conserve';
 const race=runKilometreLab({scenario,seed:'guided-preview:1'});
 const episodes=[];
 let current=null;
 for(const frame of race.frames){
  if(frame.roadGroups.length){
   current??={start:frame.km,chaseKm:0};
   if(frame.chasers.length)current.chaseKm++;
  }else if(current){
   episodes.push({...current,end:frame.km-1,caughtAtKm:frame.km});
   current=null;
  }
 }
 const sustained=episodes.find(episode=>episode.end-episode.start+1>=60&&
  episode.chaseKm===0);
 assert.ok(sustained,'a break should be able to survive without committed pursuit');
 assert.ok(race.frames[sustained.caughtAtKm-1].caughtBreakawayRiderIds.length>0);
 assert.ok(episodes.some(episode=>episode.start>sustained.caughtAtKm),
  'a new break can form after the earlier move was caught');
});
