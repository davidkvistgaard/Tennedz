import test from 'node:test';
import assert from 'node:assert/strict';
import {generatePlaytestStageProfile} from
  '../../lib/engine/v2/playtest-stage-generator.mjs';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {buildKilometreRoute} from '../../lib/engine/v2/route.mjs';
import {createV93CoastedPlaytest,validateV93CoastedPlaytest,
  summarizeV93CoastedPlaytest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

test('generated routes are reproducible, varied and accepted by the race',()=>{
  for(const distanceKm of [40,120,260]){
    for(const style of ['flat','rolling','mountain']){
      const input={distanceKm,style,seed:'route-example-1'};
      const heights=generatePlaytestStageProfile(input);
      assert.deepEqual(generatePlaytestStageProfile(input),heights);
      assert.equal(heights.length,6);
      assert.notDeepEqual(generatePlaytestStageProfile({...input,
        seed:'route-example-2'}),heights);
      assert.ok(heights.every((height,index)=>Number.isInteger(height)&&
        height>=0&&height<=2500&&
        (index===0||Math.abs(height-heights[index-1])<=
          distanceKm/5*100)));
      const prepared=prepareV91Playtest({distanceKm,terrain:'custom',
        profileHeightsM:heights,seed:'race-example-1'});
      const route=buildKilometreRoute(prepared.stage,{seed:prepared.seed,
        weather:prepared.weather});
      assert.equal(route.kilometres.length,distanceKm);
      assert.deepEqual(prepared.settings.profileHeightsM,heights);
    }
  }
});

test('stage generator refuses unsupported inputs',()=>{
  for(const input of [{distanceKm:41,style:'rolling',seed:'a'},
    {distanceKm:40,style:'unknown',seed:'a'},
    {distanceKm:40,style:'rolling',seed:''}])
    assert.throws(()=>generatePlaytestStageProfile(input));
});

test('generated long rolling and mountain routes retain a paid finish',()=>{
  for(const style of ['rolling','mountain']){
    const seed=`generated-long-${style}-1`;
    const profileHeightsM=generatePlaytestStageProfile({distanceKm:260,
      style,seed});
    const settings={distanceKm:260,terrain:'custom',profileHeightsM,
      teamCount:20,gender:'M',fatigue:15,effort:'steady',
      attack:'selective',chase:'selective',seed};
    const plans=Array.from({length:20},(_,index)=>{
      const teamId=index?`rival-${index}`:'you';
      return {teamId,finisherId:`${teamId}-7`,leadOutRiderId:null};
    });
    const race=createV93CoastedPlaytest(settings,{plans});
    validateV93CoastedPlaytest(settings,{plans},race);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.deepEqual(summary.settings.profileHeightsM,profileHeightsM);
    assert.equal(summary.kilometreFrames.length,259);
    assert.equal(summary.lineTimes.length,160);
  }
});
