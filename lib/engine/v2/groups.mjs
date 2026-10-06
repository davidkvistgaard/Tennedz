import {TUNING} from './tuning.mjs';

function median(values){
  const sorted=[...values].sort((a,b)=>a-b);
  if(!sorted.length)return 50;
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}
function lowerQuartile(values){
  const sorted=[...values].sort((a,b)=>a-b);
  if(!sorted.length)return 50;
  return sorted[Math.floor((sorted.length-1)/4)];
}

// A rider needs several consecutive difficult kilometres before being marked
// dropped. Stronger kilometres can reduce an existing deficit, never create a
// negative one. This is provisional group logic for the isolated laboratory.
export function updateRiderGroups(states,breakawayRiderIds,{
  paceSetterAbility=null,frontPaceAbility=null,unworkedFront=false,
  shelteredToleranceBonus=0,frontWorkerRiderIds=[]}={}){
  if(paceSetterAbility!==null&&(!Number.isFinite(paceSetterAbility)||
    paceSetterAbility<0))throw new Error('Invalid bunch pace setter.');
  if(frontPaceAbility!==null&&(!Number.isFinite(frontPaceAbility)||
    frontPaceAbility<0))throw new Error('Invalid front pace.');
  if(!Number.isFinite(shelteredToleranceBonus)||shelteredToleranceBonus<0||
    shelteredToleranceBonus>20||!Array.isArray(frontWorkerRiderIds))
    throw new Error('Invalid front shelter.');
  const ahead=new Set(breakawayRiderIds);
  const frontWorkers=new Set(frontWorkerRiderIds);
  const bunch=states.filter(s=>!ahead.has(s.id));
  const attached=bunch.filter(s=>s.group!=='dropped');
  // Riders already distanced cannot slow the reference pace of the bunch.
  // Fall back to the remaining riders if every rider has been marked dropped.
  const tune=TUNING.groups;
  const unpacedAbilities=(attached.length?attached:bunch).map(s=>s.ability);
  const unpacedReference=unworkedFront?lowerQuartile(unpacedAbilities):median(unpacedAbilities);
  // V86 never lets a slower nominated pair reduce its unworked group pace;
  // its break-gap calculation uses the same floor. Historical versions retain
  // their direct front input and median fallback.
  const reference=frontPaceAbility!==null?(unworkedFront?
    Math.max(unpacedReference,frontPaceAbility):frontPaceAbility):
    paceSetterAbility===null?unpacedReference:
    Math.max(unpacedReference,paceSetterAbility-tune.hardPaceDraftDiscountPoints);
  return states.map(state=>{
    // Joining a road group means the rider closed any residual bunch deficit.
    // Carrying that old deficit into the finish would charge the same gap twice.
    if(ahead.has(state.id))return {...state,lowKilometres:0,deficitSeconds:0,
      group:'breakaway'};
    // Drafting can offset only the additional speed actually created by the
    // paid pair. A slow pair must never make attachment easier than no work.
    const shelter=frontPaceAbility!==null&&!frontWorkers.has(state.id)?
      Math.min(shelteredToleranceBonus,
        Math.max(0,frontPaceAbility-unpacedReference)):0;
    const shortfall=reference-state.ability-tune.dropTolerance-shelter;
    const lowKilometres=shortfall>0?state.lowKilometres+1:0;
    const lost=lowKilometres>=tune.consecutiveKm?shortfall*tune.dropSecondsPerPoint:0;
    const regained=state.ability>reference?(state.ability-reference)*tune.rejoinSecondsPerPoint:0;
    const deficitSeconds=Math.max(0,state.deficitSeconds+lost-regained);
    return {...state,lowKilometres,deficitSeconds:+deficitSeconds.toFixed(3),
      group:deficitSeconds>tune.droppedAtSeconds?'dropped':'peloton'};
  });
}
