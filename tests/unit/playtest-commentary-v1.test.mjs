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

test('continuous paid chase is compared with the same recorded front gap',()=>{
  const names={teams:{'rival-1':'Team Mana'}};
  const frames=Array.from({length:15},(_,index)=>{
    const km=index+1;
    return {...base,km,chasingTeamIds:km>=6?['rival-1']:[],
      roadGroups:[{id:'road-1',riderIds:['you-2','rival-2-4'],
        gapSeconds:km<=5?40:km<=10?40+(km-5)*5:65-(km-10)*4}]};
  });
  const lines=raceViewerCommentaryV1({settings:{seed:'paid-chase'},
    kilometreFrames:frames},{names});
  const trends=lines.filter(row=>row.evidence.type==='front_gap_trend');
  assert.deepEqual(trends.map(row=>[row.km,row.kind]),[
    [10,'chaseNotClosing'],[15,'chaseClosing']]);
  assert.ok(trends.every(row=>row.text.includes('Team Mana')));
  assert.ok(trends.every(row=>row.evidence.continuousChasingTeamId===
    'rival-1'));
  assert.match(trends[0].text,/gained|grows|further clear/);
  assert.match(trends[1].text,/fallen|closer|shrinks/);
  assert.ok(trends.every(row=>!/caused|ensured|forced|caught/i.test(row.text)));
});

test('own continuous front work reports only measured reserve change',()=>{
  const frames=Array.from({length:15},(_,index)=>{
    const km=index+1;
    return {...base,km,paidBunchPaceTeamId:km>=6?'you':null,
      paidBunchPaceRiderIds:km>=6?km===13?['you-5','you-2']:
        ['you-5','you-6']:[],
      ownRiders:[{riderId:'you-2',energy:75-km*.1},
        {riderId:'you-5',energy:80-km},
        {riderId:'you-6',energy:81-km}]};
  });
  const lines=raceViewerCommentaryV1({settings:{seed:'front-spell'},
    kilometreFrames:frames});
  const summaries=lines.filter(row=>row.kind==='frontWorkReserve');
  assert.deepEqual(summaries.map(row=>row.km),[10]);
  assert.equal(summaries[0].evidence.priorKm,5);
  assert.deepEqual(summaries[0].evidence.riderIds,['you-5','you-6']);
  assert.match(summaries[0].text,/75\.0 and 76\.0/);
  assert.match(summaries[0].text,/70\.0 and 71\.0/);
  assert.ok(!lines.some(row=>row.kind==='frontWorkReserve'&&row.km===15));
});

test('interrupted chase or front membership gets no combined chase claim',()=>{
  const frames=Array.from({length:10},(_,index)=>{
    const km=index+1;
    return {...base,km,chasingTeamIds:km===8?[]:['rival-1'],
      roadGroups:[{id:'road-1',riderIds:['you-2','rival-2-4'],
        gapSeconds:km<=5?40:40+(km-5)*5}]};
  });
  const interrupted=raceViewerCommentaryV1({kilometreFrames:frames});
  assert.equal(interrupted.find(row=>row.evidence.type==='front_gap_trend')
    .kind,'leadGrowing');
  frames[7]={...frames[7],roadGroups:[{...frames[7].roadGroups[0],
    riderIds:['you-2','rival-3-2']}]};
  const changedFront=raceViewerCommentaryV1({kilometreFrames:frames.map(
    frame=>({...frame,chasingTeamIds:['rival-1']}))});
  assert.equal(changedFront.find(row=>row.evidence.type==='front_gap_trend')
    .kind,'leadGrowing');
});

test('a multi-rider break is described once after three continuous recorded frames',()=>{
  const race={settings:{seed:'stable-break'},kilometreFrames:
    Array.from({length:8},(_,index)=>({...base,km:index+1,
      roadGroups:[{id:'road-1',riderIds:index%2?
        ['rival-1-3','you-2','rival-2-4']:
        ['you-2','rival-2-4','rival-1-3'],gapSeconds:34+index}]}))};
  const names={riders:{'you-2':'Carsten Andersen',
    'rival-1-3':'Anna Berg','rival-2-4':'Eli Cole'}};
  const first=raceViewerCommentaryV1(race,{names});
  const breaks=first.filter(row=>row.kind==='breakEstablished');
  assert.equal(breaks.length,1);
  assert.equal(breaks[0].km,3);
  assert.match(breaks[0].text,/Carsten Andersen/);
  assert.match(breaks[0].text,/Anna Berg/);
  assert.match(breaks[0].text,/1 other rider/);
  assert.deepEqual(breaks[0].evidence,{type:'stable_front_group',
    roadGroupId:'road-1',riderIds:['you-2','rival-2-4','rival-1-3'],
    observedFromKm:1,gapSeconds:36});
  assert.deepEqual(raceViewerCommentaryV1(race,{names}),first);
});

test('break commentary waits for stable membership and sufficient gap',()=>{
  const groups=[
    {riderIds:['you-2','rival-1-3'],gapSeconds:35},
    {riderIds:['you-2','rival-2-4'],gapSeconds:35},
    {riderIds:['you-2','rival-2-4'],gapSeconds:29},
    {riderIds:['you-2','rival-2-4'],gapSeconds:29},
    {riderIds:['you-2','rival-2-4'],gapSeconds:31}];
  const race={kilometreFrames:groups.map((group,index)=>({...base,
    km:index+1,roadGroups:[{id:'road-1',...group}]}))};
  const lines=raceViewerCommentaryV1(race);
  assert.deepEqual(lines.filter(row=>row.kind==='breakEstablished')
    .map(row=>row.km),[5]);
  const short={kilometreFrames:race.kilometreFrames.slice(0,2)};
  assert.equal(raceViewerCommentaryV1(short)
    .filter(row=>row.kind==='breakEstablished').length,0);
});

test('a later separate break episode can receive its own recorded headline',()=>{
  const group={id:'road-1',riderIds:['you-2','rival-1-3'],
    gapSeconds:45};
  const race={kilometreFrames:Array.from({length:7},(_,index)=>({
    ...base,km:index+1,roadGroups:index===3?[]:[group]}))};
  const rows=raceViewerCommentaryV1(race);
  assert.deepEqual(rows.filter(row=>row.kind==='breakEstablished')
    .map(row=>row.km),[3,7]);
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
