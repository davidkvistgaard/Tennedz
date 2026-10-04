// Offline paired diagnostic for the isolated GC objectives. No live data or
// official stage-time rules are used here.
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {projectGeneralClassification,startGeneralClassification,
  recordGeneralClassificationStage} from '../lib/engine/v2/classification.mjs';

const samples=Number(process.argv[2]??20);
const traceIndex=Number(process.argv.find(arg=>arg.startsWith('--trace-index='))?.split('=')[1]??-1);
if(!Number.isInteger(samples)||samples<1||samples>200)
  throw new Error('Sample count must be 1-200.');
const stage={distance_km:40,profile_points:[[0,100],[40,100]],keypoints:[]};
const teams=['a','b'].map(id=>({id,riders:Array.from({length:8},(_,index)=>({
  id:`${id}${index}`,gender:'M',flat:70,strength:70,endurance:70,
  sprint:60,leadership:index===1?100:50,
})),orders:{captainId:`${id}0`,roadCaptainId:`${id}1`,
  preset:id==='a'?'protect':'aggressive',baseline:id==='a'?{
    chase:'ignore',attack:'none',effort:'conserve',
  }:{attack:'none',chase:'ignore',effort:'conserve'}}}));
const faster=new Set(['a1','a2','a3','a4','a5','a6','a7','b1','b2']);
const initial=startGeneralClassification({raceCategory:'M',riders:teams.flatMap(team=>
  team.riders.map(rider=>({riderId:rider.id,teamId:team.id,gender:'M'})))});
const classification=recordGeneralClassificationStage(initial,{stageId:'earlier-stage',
  classifiedTimes:teams.flatMap(team=>team.riders.map(rider=>({
    riderId:rider.id,timeSeconds:faster.has(rider.id)?3590:
      rider.id==='a0'?3600:rider.id==='b0'?3602:3610,
  })))});
const summary={samples,description:'paired fictional 2-second tenth-versus-eleventh GC gap',
  target:{launched:0,energySpentOverPassive:0,reachedTopTen:0,
    defenderKeptTopTen:0},
  headToHead:{defenceReacted:0,counteredAttack:0,targetLaunched:0,
    defenceChaseKilometres:0,
    defenderDropped:0,defenderKeptTopTen:0,challengerReachedTopTen:0}};
const rank=(race,riderId)=>projectGeneralClassification(classification,{
  roadGroups:race.frames.at(-1).roadGroups,
  riderStates:race.frames.at(-1).riderGroups,
}).find(row=>row.riderId===riderId).position;
const energy=(race,teamId)=>race.frames.at(-1).teamEnergy.find(row=>
  row.teamId===teamId).mean;
for(let index=0;index<samples;index++){
  const seed=`paired-gc-${index}`;
  const run=(aObjective,bObjective)=>{
    const cast=structuredClone(teams);
    const challengerPower=65+(index%8)*5;
    const helperPower=70+(Math.floor(index/8)%5)*5;
    Object.assign(cast[0].riders[0],{flat:85,strength:85,endurance:85});
    Object.assign(cast[1].riders[0],{flat:challengerPower,
      strength:challengerPower,endurance:challengerPower});
    for(const rider of cast[0].riders.slice(2))Object.assign(rider,{
      flat:helperPower,strength:helperPower,endurance:helperPower,
    });
    cast[0].orders.gcObjective=aObjective;
    cast[1].orders.gcObjective=bObjective;
    return simulateTacticalTour({stage,teams:cast,seed,classification});
  };
  const passive=run('stage_result','stage_result');
  const target=run('stage_result','target_top_ten');
  const contest=run('defend_top_ten','target_top_ten');
  if(index===traceIndex){
    console.error(JSON.stringify({passiveRanks:[rank(passive,'a0'),rank(passive,'b0')],
      targetRanks:[rank(target,'a0'),rank(target,'b0')],
      contestRanks:[rank(contest,'a0'),rank(contest,'b0')]},null,2));
    console.error(JSON.stringify(contest.frames.filter(frame=>frame.decisions.length||
      frame.activeGcResponseTeamIds.length||frame.attackers.length||
      frame.breakawayRiderIds.length).map(frame=>({km:frame.km,
      gap:frame.pelotonGapSeconds,breakaway:frame.breakawayRiderIds,
      attackers:frame.attackers,chasers:frame.chasers,decisions:frame.decisions,
      activeGcResponse:frame.activeGcResponseTeamIds,
      availableHelpers:frame.riderGroups.filter(rider=>rider.id.startsWith('a')&&
        !['a0','a1'].includes(rider.id)&&rider.group==='peloton').length,
    })),null,2));
  }
  summary.target.launched+=Number(target.frames.some(frame=>
    frame.attackers.includes('b0')));
  summary.target.energySpentOverPassive+=energy(passive,'b')-energy(target,'b');
  summary.target.reachedTopTen+=Number(rank(target,'b0')<=10);
  summary.target.defenderKeptTopTen+=Number(rank(target,'a0')<=10);
  summary.headToHead.defenceReacted+=Number(contest.frames.some(frame=>
    frame.activeGcResponseTeamIds.includes('a')));
  summary.headToHead.counteredAttack+=Number(contest.frames.some(frame=>
    frame.gcCounterTeamIds.includes('a')));
  summary.headToHead.targetLaunched+=Number(contest.frames.some(frame=>
    frame.attackers.includes('b0')));
  summary.headToHead.defenceChaseKilometres+=contest.frames.filter(frame=>
    frame.chasers.includes('a')).length;
  summary.headToHead.defenderDropped+=Number(contest.frames.at(-1).riderGroups.find(
    rider=>rider.id==='a0').group==='dropped');
  summary.headToHead.defenderKeptTopTen+=Number(rank(contest,'a0')<=10);
  summary.headToHead.challengerReachedTopTen+=Number(rank(contest,'b0')<=10);
}
for(const section of ['target','headToHead'])for(const [key,value] of
  Object.entries(summary[section]))summary[section][key]=+(value/samples).toFixed(3);
console.log(JSON.stringify(summary,null,2));
