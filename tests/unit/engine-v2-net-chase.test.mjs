import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {resolveTacticalKilometre} from '../../lib/engine/v2/tactics.mjs';
import {normalizeOrders} from '../../lib/engine/v2/orders.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {MOTOR_CANDIDATE_VERSION} from '../../lib/engine/v2/tuning.mjs';

const skills=['sprint','flat','hills','mountain','cobbles','timetrial',
  'endurance','strength','wind'];
const spread=[-8,-6,-4,-2,2,4,6,8];
function makeTeam(id,level,{effort='steady',chase='ignore',attack='none',phases=[]}={}){
  const riders=spread.map((offset,index)=>({id:`${id}-${index}`,
    gender:'M',form:70,fatigue:10,...Object.fromEntries(skills.map(skill=>
      [skill,Math.min(100,level+offset)]))}));
  return {id,riders,orders:{captainId:`${id}-7`,preset:'balanced',
    baseline:{effort,chase,attack},phases}};
}
const stage={distance_km:260,profile_points:[[0,200],[52,800],[104,250],
  [161,1100],[208,350],[260,200]],tags:['HILLY']};
const weather={temp_c:12,wind_kph:5,precipitation_mm:1};
const rivalPhases=[
  {atKm:150,attack:'selective',attackRiderId:'rival-7',effort:'hard'},
  {atKm:160,attack:'none',attackRiderId:null},
];
function longRace(chase){
  const strongPhases=[{atKm:160,effort:'hard',...(chase?{chase:'all'}:{})}];
  const teams=[makeTeam('weak',80),
    makeTeam('strong',96,{effort:'conserve',phases:strongPhases}),
    makeTeam('rival',94,{effort:'conserve',phases:rivalPhases}),
    ...Array.from({length:12},(_,index)=>
      makeTeam(`neutral-${index}`,76+index%13))];
  const race=simulateTacticalTour({stage,teams,seed:'net-chase-long',weather,
    motorVersion:MOTOR_CANDIDATE_VERSION});
  assert.equal(validateRecordedTour(race),true);
  assert.equal(race.tuningVersion,MOTOR_CANDIDATE_VERSION);
  const attack=race.frames.filter(frame=>frame.attackers.includes('rival-7'));
  assert.equal(attack.length,1);
  assert.equal(attack[0].km,160);
  assert.ok(attack[0].joinedBreakawayRiderIds.includes('rival-7'));
  return race;
}

test('paid pursuit catches a long-race rival while an unchased move survives',()=>{
  const held=longRace(false);
  const chased=longRace(true);
  const finishHeld=held.frames.at(-1),finishChased=chased.frames.at(-1);
  assert.ok(finishHeld.gapSeconds>20);
  assert.ok(finishHeld.roadGroups.some(group=>group.riderIds.includes('rival-7')));
  assert.equal(held.frames.filter(frame=>frame.chasers.includes('strong')).length,0);
  assert.equal(finishChased.gapSeconds,0);
  assert.deepEqual(finishChased.roadGroups,[]);
  assert.ok(chased.frames.filter(frame=>frame.chasers.includes('strong')).length>0);
  const energy=(race,id)=>race.frames.at(-1).riderGroups.find(row=>row.id===id).energy;
  assert.ok(energy(chased,'strong-5')<energy(held,'strong-5'));
  assert.ok(energy(chased,'strong-6')<energy(held,'strong-6'));
});

test('a planned final-kilometre attack survives the cadence guard',()=>{
  const prepare=(id,orders)=>{
    const team=makeTeam(id,70,orders);
    team.orders=normalizeOrders(team.orders,{riderIds:team.riders.map(rider=>rider.id),
      distanceKm:40,keypoints:[{km:39}]});
    team.energy=Object.fromEntries(team.riders.map(rider=>[rider.id,100]));
    return team;
  };
  const quiet=prepare('quiet',{attack:'none'});
  const automatic=prepare('auto',{effort:'hard',attack:'repeated'});
  const context={teams:[automatic,quiet],terrain:'flat',distanceKm:40,
    resolutionVersion:MOTOR_CANDIDATE_VERSION};
  assert.equal(resolveTacticalKilometre({...context,km:35}).attackers.length,1);
  assert.deepEqual(resolveTacticalKilometre({...context,km:40}).attackers,[]);
  const planned=prepare('planned',{effort:'hard',attack:'none',
    phases:[{atKm:39,attack:'selective',attackRiderId:'planned-7'}]});
  const final=resolveTacticalKilometre({...context,teams:[planned,quiet],km:40});
  assert.deepEqual(final.attackers.map(row=>row.riderId),['planned-7']);
  assert.equal(final.attackers[0].reason,'named_order');
});


test('a named final-kilometre move is recorded and replayable in the candidate',()=>{
  const finalStage={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[makeTeam('planned',80,{attack:'none',
    phases:[{atKm:39,attack:'selective',attackRiderId:'planned-7'}]}),
  makeTeam('quiet',70)];
  const race=simulateTacticalTour({stage:finalStage,teams,seed:'planned-finale',
    motorVersion:MOTOR_CANDIDATE_VERSION});
  const final=race.frames.at(-1);
  assert.deepEqual(final.attackReasons,
    [{riderId:'planned-7',reason:'named_order'}]);
  assert.equal(validateRecordedTour(race),true);
});
