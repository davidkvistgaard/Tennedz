import test from 'node:test';
import assert from 'node:assert/strict';
import {raceViewerCommentaryV1} from
  '../../lib/engine/v2/playtest-commentary-v1.mjs';

const base={roadGroups:[],droppedRiders:[],ownRiders:[
  {riderId:'you-2',energy:75},{riderId:'you-5',energy:76},
  {riderId:'you-6',energy:77}],attackAttempts:[],joinedRiderIds:[],
  caughtRiderIds:[],chasingTeamIds:[],paidBunchPaceRiderIds:[]};

test('commentary distinguishes orders, paid actions, separation, chase and catch',()=>{
  const race={settings:{seed:'commentary-1',managerTacticalOrdersV4:[
    {atKm:5,effort:'hard',frontWork:'rotate'}]},kilometreFrames:[
    {...base,km:5},
    {...base,km:6,attackAttempts:['you-2'],
      paidBunchPaceTeamId:'you',paidBunchPaceRiderIds:['you-5','you-6']},
    {...base,km:7,joinedRiderIds:['you-2'],roadGroups:[
      {id:'road-1',riderIds:['you-2'],gapSeconds:3.4}]},
    {...base,km:8,roadGroups:[
      {id:'road-1',riderIds:['you-2'],gapSeconds:2.1}],
      chasingTeamIds:['rival-1']},
    {...base,km:9,caughtRiderIds:['you-2'],chasingTeamIds:['rival-1']}]};
  const names={teams:{you:'Birger Racing','rival-1':'Team Mana'},
    riders:{'you-2':'Carsten Andersen','you-5':'Anna Nielsen',
      'you-6':'Mia Hansen'}};
  const lines=raceViewerCommentaryV1(race,{names});
  assert.deepEqual(lines.map(row=>row.kind),[
    'start','order','attack','frontWork','join','chase','catch']);
  assert.equal(lines.find(row=>row.kind==='order').km,6);
  assert.match(lines.find(row=>row.kind==='order').text,/Birger Racing/);
  assert.match(lines.find(row=>row.kind==='attack').text,/Carsten Andersen/);
  assert.match(lines.find(row=>row.kind==='join').text,/3\.4 s/);
  assert.match(lines.find(row=>row.kind==='chase').text,/Team Mana/);
  assert.match(lines.find(row=>row.kind==='frontWork').text,
    /Anna Nielsen and Mia Hansen/);
  assert.match(lines.find(row=>row.kind==='catch').text,/Carsten Andersen/);
  assert.deepEqual(raceViewerCommentaryV1(race,{names}),lines);
  assert.ok(lines.every(row=>row.evidence?.type));
  assert.ok(lines.every(row=>!/(made|ensured|because|forced).*catch/i
    .test(row.text)));
});

test('repeated action uses several stable phrasings rather than a single line',()=>{
  const race={settings:{seed:'repeated-actions'},
    kilometreFrames:Array.from({length:10},(_,index)=>({
      ...base,km:index+1,attackAttempts:['you-2']}))};
  const first=raceViewerCommentaryV1(race);
  const attacks=first.filter(row=>row.kind==='attack');
  assert.equal(attacks.length,10);
  assert.equal(new Set(attacks.map(row=>row.text)).size,3);
  assert.deepEqual(raceViewerCommentaryV1(race),first);
  assert.notDeepEqual(raceViewerCommentaryV1({...race,settings:{seed:'other'} })
    .filter(row=>row.kind==='attack').slice(0,2).map(row=>row.text),
    attacks.slice(0,2).map(row=>row.text));
});

test('commentary does not turn simultaneous events or markers into a cause',()=>{
  const race={kilometreFrames:[
    {...base,km:1},
    {...base,km:2,roadGroups:[
      {id:'road-1',riderIds:['you-2'],gapSeconds:2}],
      chasingTeamIds:['rival-1']},
    {...base,km:3,roadGroups:[],chasingTeamIds:['rival-1']} ]};
  const lines=raceViewerCommentaryV1(race);
  assert.ok(lines.some(row=>row.kind==='chase'));
  assert.ok(lines.some(row=>row.kind==='road'));
  assert.ok(!lines.some(row=>row.kind==='catch'||row.kind==='join'));
  assert.ok(lines.every(row=>!/(caught|joined|attack)/i.test(row.text)));
});

test('a surviving front lead is described only from repeated paid checkpoints',()=>{
  const front={id:'road-1',riderIds:['you-2'],gapSeconds:4};
  const race={kilometreFrames:[
    {...base,km:3},
    {...base,km:4,roadGroups:[front],joinedRiderIds:['you-2']},
    {...base,km:5,roadGroups:[{...front,gapSeconds:3.2}]}]};
  const lines=raceViewerCommentaryV1(race);
  assert.equal(lines.filter(row=>row.kind==='join').length,1);
  assert.equal(lines.filter(row=>row.kind==='aheadSmall').length,1);
  assert.match(lines.find(row=>row.kind==='aheadSmall').text,/3\.2/);
});

test('stable leading group gains and loses recorded time without assigning cause',()=>{
  const frames=Array.from({length:15},(_,index)=>{
    const km=index+1;
    const gapSeconds=km<=5?40:km<=10?40+(km-5)*6:70-(km-10)*4;
    return {...base,km,roadGroups:[{id:'road-1',
      riderIds:km%2?['you-2','rival-1-3']:['rival-1-3','you-2'],
      gapSeconds}]};
  });
  const lines=raceViewerCommentaryV1({settings:{seed:'trend'},
    kilometreFrames:frames},{names:{riders:{'you-2':'Carsten Andersen'}}});
  const trends=lines.filter(row=>row.evidence.type==='front_gap_trend');
  assert.deepEqual(trends.map(row=>[row.km,row.kind]),[
    [10,'leadGrowing'],[15,'leadClosing']]);
  assert.equal(lines.filter(row=>[10,15].includes(row.km)&&
    ['ahead','aheadSmall'].includes(row.kind)).length,0);
  assert.match(trends[0].text,/Carsten Andersen/);
  assert.match(trends[0].text,/30\.0 s|30 s/);
  assert.match(trends[0].text,/1m 10s/);
  assert.match(trends[1].text,/20\.0 s|20 s/);
  assert.deepEqual(trends[0].evidence,{type:'front_gap_trend',
    roadGroupId:'road-1',riderIds:['rival-1-3','you-2'],priorKm:5,
    priorGapSeconds:40,gapSeconds:70});
  assert.ok(trends.every(row=>!/because|made|ensured|forced/i.test(row.text)));
});

test('gap commentary refuses changing membership and small fluctuations',()=>{
  const race={kilometreFrames:Array.from({length:15},(_,index)=>{
    const km=index+1;
    return {...base,km,roadGroups:[{id:'road-1',
      riderIds:km<=5?['you-2']:['you-2','rival-1-3'],
      gapSeconds:km<=5?40:km<=10?70:75}]};
  })};
  const lines=raceViewerCommentaryV1(race);
  assert.equal(lines.filter(row=>row.evidence.type==='front_gap_trend').length,0);
});

test('attack outcomes require a recorded status and never infer why a rival chased',()=>{
  const race={kilometreFrames:[
    {...base,km:1,attackAttempts:['you-2'],frontAttacks:[
      {riderId:'you-2',status:'contained'}],
      chasingTeamIds:['rival-1']},
    {...base,km:2,attackAttempts:['you-2'],frontAttacks:[
      {riderId:'you-2',status:'exhausted'}]},
    {...base,km:3,attackAttempts:['you-2'],frontAttacks:[
      {riderId:'you-2',status:'split'}]}]};
  const rows=raceViewerCommentaryV1(race);
  assert.deepEqual(rows.filter(row=>row.evidence.type==='front_attack_outcome')
    .map(row=>row.kind),['contained','exhausted','split']);
  assert.equal(new Set(rows.filter(row=>row.kind==='attack')
    .map(row=>row.text)).size,3);
  assert.ok(rows.every(row=>!/(rival.*contained|chase.*contained)/i
    .test(row.text)));
});
