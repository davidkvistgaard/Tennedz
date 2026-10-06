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
  paceSetterAbility=null,frontPaceAbility=null,unworkedFront=false}={}){
  if(paceSetterAbility!==null&&(!Number.isFinite(paceSetterAbility)||
    paceSetterAbility<0))throw new Error('Invalid bunch pace setter.');
  if(frontPaceAbility!==null&&(!Number.isFinite(frontPaceAbility)||
    frontPaceAbility<0))throw new Error('Invalid front pace.');
  const ahead=new Set(breakawayRiderIds);
  const bunch=states.filter(s=>!ahead.has(s.id));
  const attached=bunch.filter(s=>s.group!=='dropped');
  // Riders already distanced cannot slow the reference pace of the bunch.
  // Fall back to the remaining riders if every rider has been marked dropped.
  const tune=TUNING.groups;
  const unpacedAbilities=(attached.length?attached:bunch).map(s=>s.ability);
  const unpacedReference=unworkedFront?lowerQuartile(unpacedAbilities):median(unpacedAbilities);
  // A nominated pair sets the front pace even in a large field. Keep the old
  // hard-only input for direct scenario callers and the median as fallback
  // when the tour has no eligible pair.
  const reference=frontPaceAbility!==null?frontPaceAbility:
    paceSetterAbility===null?unpacedReference:
    Math.max(unpacedReference,paceSetterAbility-tune.hardPaceDraftDiscountPoints);
  return states.map(state=>{
    // Joining a road group means the rider closed any residual bunch deficit.
    // Carrying that old deficit into the finish would charge the same gap twice.
    if(ahead.has(state.id))return {...state,lowKilometres:0,deficitSeconds:0,
      group:'breakaway'};
    const shortfall=reference-state.ability-tune.dropTolerance;
    const lowKilometres=shortfall>0?state.lowKilometres+1:0;
    const lost=lowKilometres>=tune.consecutiveKm?shortfall*tune.dropSecondsPerPoint:0;
    const regained=state.ability>reference?(state.ability-reference)*tune.rejoinSecondsPerPoint:0;
    const deficitSeconds=Math.max(0,state.deficitSeconds+lost-regained);
    return {...state,lowKilometres,deficitSeconds:+deficitSeconds.toFixed(3),
      group:deficitSeconds>tune.droppedAtSeconds?'dropped':'peloton'};
  });
}
