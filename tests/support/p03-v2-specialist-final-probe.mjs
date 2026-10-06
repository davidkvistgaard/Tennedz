// Read-only long-race specialist counterfactual on the opt-in paid-pace motor.
// Run: node tests/support/p03-v2-specialist-final-probe.mjs
//   [--bounded-finale|--bounded-bridge-finale|--earned-bridge-finale|--neutral-pace|--explicit-front]
//   [--neutrals=0..17]
//   [--chase-at=230|240|250] [--route=flat|hilly|mountain]
//   [--neutral-mode=rotating|weak|mixed] [--neutral-level=0..100] [seed ...]
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {MOTOR_PAID_PACE_VERSION,MOTOR_FINALE_VERSION,
  MOTOR_BRIDGE_FINALE_VERSION,MOTOR_EARNED_BRIDGE_VERSION,
  MOTOR_NEUTRAL_PACE_VERSION,MOTOR_EXPLICIT_FRONT_VERSION} from '../../lib/engine/v2/tuning.mjs';

const keys=['sprint','flat','hills','mountain','cobbles','timetrial',
  'endurance','strength','wind'];
const stages={
  flat:{distance_km:260,profile_points:[[0,200],[260,200]],tags:['FLAT']},
  hilly:{distance_km:260,profile_points:[[0,200],[40,250],[80,800],
    [120,300],[160,950],[200,400],[230,1200],[255,450],[260,400]],
  tags:['HILLY']},
  mountain:{distance_km:260,profile_points:[[0,300],[40,500],[80,1200],
    [120,500],[160,1600],[200,700],[230,1500],[255,600],[260,1000]],
  tags:['MOUNTAIN']},
};
const weathers={flat:{temp_c:16,wind_kph:12,precipitation_mm:0},
  hilly:{temp_c:16,wind_kph:12,precipitation_mm:0},
  mountain:{temp_c:12,wind_kph:10,precipitation_mm:0}};
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
const option=(name,fallback)=>{
  const values=process.argv.slice(2).filter(arg=>arg.startsWith(`--${name}=`));
  if(values.length>1)throw new Error(`Duplicate ${name} option.`);
  return values.length?Number(values[0].split('=')[1]):fallback;
};
const textOption=(name,fallback)=>{
  const values=process.argv.slice(2).filter(arg=>arg.startsWith(`--${name}=`));
  if(values.length>1)throw new Error(`Duplicate ${name} option.`);
  return values.length?values[0].slice(name.length+3):fallback;
};
const neutralCount=option('neutrals',12),chaseAt=option('chase-at',240);
const neutralLevel=option('neutral-level',20);
const routeName=textOption('route','hilly');
const neutralMode=textOption('neutral-mode','rotating');
if(!Number.isInteger(neutralCount)||neutralCount<0||neutralCount>17||
  !Number.isInteger(neutralLevel)||neutralLevel<0||neutralLevel>100||
  ![230,240,250].includes(chaseAt)||!stages[routeName]||
  !['rotating','weak','mixed'].includes(neutralMode))
  throw new Error('Invalid specialist probe options.');
const stage=stages[routeName],weather=weathers[routeName];
const chasePhases=[{atKm:chaseAt,effort:'hard',chase:'all'}];
const easePhases=[...chasePhases,{atKm:chaseAt>=250?255:250,
  effort:'conserve',chase:'ignore'}];
const boundedFinale=process.argv.includes('--bounded-finale');
const boundedBridgeFinale=process.argv.includes('--bounded-bridge-finale');
const earnedBridgeFinale=process.argv.includes('--earned-bridge-finale');
const neutralPace=process.argv.includes('--neutral-pace');
const explicitFront=process.argv.includes('--explicit-front');
if([boundedFinale,boundedBridgeFinale,earnedBridgeFinale,neutralPace,explicitFront]
  .filter(Boolean).length>1)
  throw new Error('Choose one finale motor.');
const seeds=process.argv.slice(2).filter(value=>!value.startsWith('--'));
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
    ...Array.from({length:neutralCount},(_,index)=>{
      const neutral=team(`neutral-${index}`,
        neutralMode==='weak'?neutralLevel:
          neutralMode==='mixed'?neutralLevel+(index%5-2)*8:76+index%8,
        neutralMode==='rotating'?
          index%3===0?{sprint:90}:index%3===1?{mountain:91}:{timetrial:90}:{});
      if(neutralMode==='mixed')neutral.riders.forEach((rider,riderIndex)=>{
        rider.fatigue=(index*7+riderIndex*3)%31;
      });
      if(explicitFront)neutral.orders.baseline.frontWork=index%3===0?'rotate':'sit_in';
      return neutral;
    }),
  ];
  const race=simulateTacticalTour({stage,teams,seed,weather,
    motorVersion:explicitFront?MOTOR_EXPLICIT_FRONT_VERSION:
      neutralPace?MOTOR_NEUTRAL_PACE_VERSION:
      earnedBridgeFinale?MOTOR_EARNED_BRIDGE_VERSION:
      boundedBridgeFinale?MOTOR_BRIDGE_FINALE_VERSION:
      boundedFinale?MOTOR_FINALE_VERSION:MOTOR_PAID_PACE_VERSION});
  assert.equal(validateRecordedTour(race),true);
  const frames=race.frames,final=frames.at(-1);
  const namedBreak=frames.filter(frame=>frame.attackReasons.some(row=>
    row.riderId==='rouleur-7'&&row.reason==='named_order'));
  assert.equal(namedBreak.length,1);
  assert.equal(namedBreak[0].km,240);
  const beforeFinal=frames.at(-2);
  const namedFinale=final.attackReasons.some(row=>
    row.riderId==='climber-7'&&row.reason==='named_order');
  // In a stronger mixed field the selected rider may already be detached;
  // the plan remains committed but cannot execute from outside the bunch.
  if(!plan.finaleAttack||neutralMode!=='mixed')
    assert.equal(namedFinale,plan.finaleAttack);
  if(plan.finaleAttack&&beforeFinal.riderGroups.find(row=>
    row.id==='climber-7')?.group==='dropped')assert.equal(namedFinale,false);
  const rider=id=>race.provisionalResults.find(row=>row.riderId===id);
  const paidPaceByTeam=Object.fromEntries([...new Set(frames.map(frame=>
    frame.paidBunchPace?.teamId).filter(Boolean))].map(teamId=>[
    teamId,frames.filter(frame=>frame.paidBunchPace?.teamId===teamId).length]));
  const groupCheckpoints=[1,100,160,168,200,230,250].map(km=>{
    const frame=frames[km-1],attached=frame.riderGroups.filter(row=>
      row.group==='peloton').length;
    const climber=frame.riderGroups.find(row=>row.id==='climber-7');
    return {km,attached,climberDeficit:climber.deficitSeconds,
      climberEnergy:climber.energy,climberGroup:climber.group};
  });
  console.log(JSON.stringify({seed,plan:plan.name,version:race.tuningVersion,
    teams:teams.length,chaseAt,route:routeName,neutralMode,neutralLevel,
    winner:race.provisionalResults[0].riderId,
    gapAt241:frames[240].gapSeconds,gapAt250:frames[249].gapSeconds,
    gapAt255:frames[254].gapSeconds,
    gapBeforeFinal:beforeFinal.gapSeconds,gapAtFinish:final.gapSeconds,
    droppedAt250:frames[249].riderGroups.filter(row=>row.group==='dropped').length,
    neutralInBunchAt250:frames[249].riderGroups.filter(row=>
      row.id.startsWith('neutral-')&&row.group==='peloton').length,
    chaseKm:frames.filter(frame=>frame.chasers.includes('sprinter')).length,
    paidPaceKm:frames.filter(frame=>frame.paidBunchPace?.teamId==='sprinter').length,
    paidPaceByTeam,groupCheckpoints,
    catchKm:frames.find(frame=>frame.caughtBreakawayRiderIds.includes('rouleur-7'))?.km??null,
    plannedFinale:plan.finaleAttack,namedFinale,
    climberFirstDroppedKm:frames.find(frame=>frame.riderGroups.some(row=>
      row.id==='climber-7'&&row.group==='dropped'))?.km??null,
    climberPreFinalGroup:beforeFinal.riderGroups.find(row=>
      row.id==='climber-7')?.group,
    finaleMove:final.joinedBreakawayRiderIds.includes('climber-7'),
    finaleGroup:final.roadGroups.find(group=>group.riderIds.includes('climber-7'))?.id??null,
    frontGroup:final.roadGroups[0]?.id??null,
    formedChaseGroupId:final.formedChaseGroupId,
    specialists:Object.fromEntries(['rouleur-7','sprinter-7','climber-7'].map(id=>[
      id,{place:rider(id).position,group:rider(id).group,
        energy:rider(id).energy,finaleAbility:rider(id).finaleAbility},
    ]))}));
}
