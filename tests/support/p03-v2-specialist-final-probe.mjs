// Read-only long-race specialist counterfactual on the opt-in paid-pace motor.
// Run: node tests/support/p03-v2-specialist-final-probe.mjs [--bounded-finale] [seed ...]
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {MOTOR_PAID_PACE_VERSION,MOTOR_FINALE_VERSION} from '../../lib/engine/v2/tuning.mjs';

const keys=['sprint','flat','hills','mountain','cobbles','timetrial',
  'endurance','strength','wind'];
const stage={distance_km:260,profile_points:[[0,200],[40,250],[80,800],
  [120,300],[160,950],[200,400],[230,1200],[255,450],[260,400]],
  tags:['HILLY']};
const weather={temp_c:16,wind_kph:12,precipitation_mm:0};
const clamp=value=>Math.max(0,Math.min(100,value));
function team(id,level,role,phases=[]){
  const riders=Array.from({length:8},(_,index)=>{
    const base=level+(index-3)*2;
    const abilities=Object.fromEntries(keys.map(key=>[key,clamp(base)]));
    if(index===7)Object.assign(abilities,role);
    return {id:`${id}-${index}`,gender:'M',form:70,fatigue:8,
      ...abilities};
  });
  return {id,riders,orders:{captainId:`${id}-7`,preset:'balanced',
    baseline:{effort:'conserve',attack:'none',chase:'ignore'},phases}};
}
const breakPhases=[
  {atKm:230,attack:'selective',attackRiderId:'rouleur-7'},
  {atKm:240,attack:'none',attackRiderId:null},
];
const finalePhases=[{atKm:255,attack:'selective',
  attackRiderId:'climber-7',effort:'hard'}];
const chasePhases=[{atKm:240,effort:'hard',chase:'all'}];
const easePhases=[...chasePhases,{atKm:250,effort:'conserve',chase:'ignore'}];
const boundedFinale=process.argv.includes('--bounded-finale');
const seeds=process.argv.slice(2).filter(value=>value!=='--bounded-finale');
if(!seeds.length)seeds.push('s1','s2','s3');
for(const seed of seeds)for(const plan of [
  {name:'hold',chase:false,finaleAttack:false},
  {name:'chase',chase:true,finaleAttack:false},
  {name:'chase plus named finale',chase:true,finaleAttack:true},
  {name:'chase then ease plus named finale',chase:true,ease:true,finaleAttack:true},
]){
  const teams=[
    team('rouleur',82,{timetrial:98,endurance:98,strength:91,flat:94,
      hills:91,mountain:77,sprint:58},breakPhases),
    team('sprinter',83,{sprint:100,flat:92,endurance:79,strength:80,
      hills:78,mountain:58},plan.ease?easePhases:plan.chase?chasePhases:[]),
    team('climber',82,{mountain:99,hills:95,endurance:91,
      sprint:66,flat:75,acceleration:99,strength:95},
    plan.finaleAttack?finalePhases:[]),
    ...Array.from({length:12},(_,index)=>
      team(`neutral-${index}`,76+index%8,
        index%3===0?{sprint:90}:index%3===1?{mountain:91}:{timetrial:90})),
  ];
  const race=simulateTacticalTour({stage,teams,seed,weather,
    motorVersion:boundedFinale?MOTOR_FINALE_VERSION:MOTOR_PAID_PACE_VERSION});
  assert.equal(validateRecordedTour(race),true);
  const frames=race.frames,final=frames.at(-1);
  const namedBreak=frames.filter(frame=>frame.attackReasons.some(row=>
    row.riderId==='rouleur-7'&&row.reason==='named_order'));
  assert.equal(namedBreak.length,1);
  assert.equal(namedBreak[0].km,240);
  const namedFinale=final.attackReasons.some(row=>
    row.riderId==='climber-7'&&row.reason==='named_order');
  assert.equal(namedFinale,plan.finaleAttack);
  const rider=id=>race.provisionalResults.find(row=>row.riderId===id);
  const beforeFinal=frames.at(-2);
  console.log(JSON.stringify({seed,plan:plan.name,version:race.tuningVersion,
    winner:race.provisionalResults[0].riderId,
    gapAt250:frames[249].gapSeconds,gapAt255:frames[254].gapSeconds,
    gapBeforeFinal:beforeFinal.gapSeconds,gapAtFinish:final.gapSeconds,
    chaseKm:frames.filter(frame=>frame.chasers.includes('sprinter')).length,
    paidPaceKm:frames.filter(frame=>frame.paidBunchPace?.teamId==='sprinter').length,
    namedFinale,finaleJoin:final.joinedBreakawayRiderIds.includes('climber-7'),
    specialists:Object.fromEntries(['rouleur-7','sprinter-7','climber-7'].map(id=>[
      id,{place:rider(id).position,group:rider(id).group,
        energy:rider(id).energy,finaleAbility:rider(id).finaleAbility},
    ]))}));
}
