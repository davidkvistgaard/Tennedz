// Resolve the guided lab's uncustomized rival managers before the race.
// The recorded input contains these exact tactics; playback never rerolls.
const ATTACKER={effort:'steady',attack:'repeated',chase:'ignore'};
const SELECTIVE_ATTACKER={effort:'steady',attack:'selective',
  chase:'ignore'};
const SMALL_FIELD=[ATTACKER,
  SELECTIVE_ATTACKER,
  {effort:'steady',attack:'none',chase:'selective'},
  {effort:'conserve',attack:'none',chase:'ignore'}];
const LARGE_FIELD=[...SMALL_FIELD,
  {effort:'hard',attack:'none',chase:'all'}];

export function resolveRandomRivalTactics({teamCount,customTactics=[],
  overrides=[],random=Math.random}){
  const chosen=new Map(overrides.map(row=>[Number(row.teamId.slice(6))-1,
    {effort:row.effort,attack:row.attack,chase:row.chase}]));
  const open=[];
  for(let index=0;index<teamCount-1;index++)
    if(index>=customTactics.length&&!chosen.has(index))open.push(index);
  const attackers=[...open];
  for(let index=attackers.length-1;index>0;index--){
    const swap=Math.floor(random()*(index+1));
    [attackers[index],attackers[swap]]=[attackers[swap],attackers[index]];
  }
  const pool=open.length<=3?SMALL_FIELD:LARGE_FIELD;
  return Array.from({length:teamCount-1},(_,index)=>{
    const tactic=customTactics[index]??chosen.get(index)??
      (index===attackers[0]?ATTACKER:index===attackers[1]?
        SELECTIVE_ATTACKER:pool[Math.floor(random()*pool.length)]);
    return {...tactic};
  });
}
