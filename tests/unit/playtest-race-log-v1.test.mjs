import test from 'node:test';
import assert from 'node:assert/strict';
import {formatMotorLabRaceLog} from
  '../../lib/engine/v2/playtest-race-log-v1.mjs';

test('copied log preserves selected options, resolved orders and nominations',()=>{
  const selected={settings:{distanceKm:260,terrain:'mountain',teamCount:4,
    gender:'F',fatigue:30,seed:'sample-flat-finish',
    defaultRivalPlan:'random'},timelineOrders:[{atKm:55,
    effort:'hard',chase:'ignore'}],breakWindow:{fromKm:55,toKm:95},
  finalePlans:{you:{finisherId:'you-6',leadOutRiderId:'you-5'}}};
  const race={version:'v93-test',tuningVersion:'v93-tuning',
    settings:{...selected.settings,defaultRivalPlan:'mixed',
      effort:'steady',attack:'none',chase:'selective',
      managerTactics:[{effort:'hard',attack:'none',chase:'all'}],
      managerTacticalOrdersV5:[
        {teamId:'you',atKm:55,effort:'hard',chase:'ignore',
          attack:'selective'},
        {teamId:'you',atKm:95,attack:'none'}]},
    managerOrders:[{teamId:'you',effort:'steady',attack:'none',
      chase:'selective',phaseOrders:[
        {atKm:55,effort:'hard',chase:'ignore',attack:'selective'},
        {atKm:95,attack:'none'}]}],
    managerDecisions:[{teamId:'you',finisherId:'you-6',
      leadOutRiderId:'you-5',finisherEnergy:48}],
    lineTimes:Array.from({length:32},()=>({}))};
  const log=formatMotorLabRaceLog(race,[{km:60,text:'A move is recorded.'}],
    selected);
  assert.match(log,/Field: 4 teams · women/);
  assert.match(log,/Starting fatigue: 30/);
  assert.match(log,/Rival option selected: random/);
  assert.match(log,/Rival plan committed after any draw: mixed/);
  assert.match(log,/"managerTacticalOrdersV5"/);
  assert.match(log,/"fromKm": 55/);
  assert.match(log,/"finisherId": "you-6"/);
  assert.doesNotMatch(log,/finisherEnergy/);
  assert.match(log,/Km 60: A move is recorded\./);
  assert.match(log,/32 conditional rider crossings/);
});
