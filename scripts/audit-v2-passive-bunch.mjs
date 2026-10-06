// Isolate the effect of entrants who neither attack nor chase an existing break.
// No database, live roster or result path is used.
import {normalizeOrders} from '../lib/engine/v2/orders.mjs';
import {resolveTacticalKilometre} from '../lib/engine/v2/tactics.mjs';
import {TUNING_VERSION} from '../lib/engine/v2/tuning.mjs';

function team(id,ability){
  const riders=Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender:'M',flat:ability,timetrial:ability,
    strength:ability,endurance:ability,sprint:ability,leadership:ability,
  }));
  const riderIds=riders.map(rider=>rider.id);
  return {id,riders,orders:normalizeOrders({captainId:riderIds[0],
    roadCaptainId:riderIds[1],preset:'balanced',
    baseline:{attack:'none',chase:'ignore',breakWork:'cooperate'}},
  {riderIds,distanceKm:40})};
}

const front=team('front',70),bunch=team('bunch',60);
const base={km:21,gapSeconds:30,breakawayTeamIds:['front'],
  breakawayRiderIds:['front-0']};
const scenarios=[
  {name:'two teams',teams:[front,bunch]},
  {name:'one weaker passive team',teams:[front,bunch,team('weak-1',20)]},
  {name:'thirteen weaker passive teams',teams:[front,bunch,
    ...Array.from({length:13},(_,index)=>team(`weak-${index+1}`,20))]},
  {name:'one stronger passive team',teams:[front,bunch,team('strong',90)]},
];
const rows=scenarios.map(({name,teams})=>{
  const result=resolveTacticalKilometre({...base,teams});
  if(result.attackers.length||result.chasers.length||result.chasePower!==0)
    throw new Error(`${name} unexpectedly ordered an attack or chase.`);
  return {name,teams:teams.length,passiveGapDelta:result.passiveGapDelta,
    nextGapSeconds:result.gapSeconds};
});
console.log(JSON.stringify({tuningVersion:TUNING_VERSION,
  question:'Do teams that neither attack nor chase alter passive bunch pace?',
  fixedGapSeconds:base.gapSeconds,rows},null,2));
