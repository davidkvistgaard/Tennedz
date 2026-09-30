const EFFORTS=new Set(['conserve','steady','hard']);
const CHASE=new Set(['ignore','selective','all']);
const ATTACK=new Set(['none','selective','repeated']);
const BREAK_WORK=new Set(['cooperate','sit_on']);
const BREAK_FINALE=new Set(['hold_group','attack_if_outsprinted']);
const HELPER_ATTACK_POLICIES=new Set(['open','hold_for_captain','release_if_dropped']);
const CAPTAIN_SUPPORT=new Set(['hold_position','drop_back_if_dropped']);
const CONTINGENCIES=new Set(['hold_plan','backup_if_captain_exhausted']);
const BREAK_RESPONSES=new Set(['hold_plan','chase_if_threatened']);
const FORWARD_RESPONSES=new Set(['protect_forward','chase_if_fading']);
const PRESETS=Object.freeze({
  balanced:{effort:'steady',chase:'selective',attack:'selective',breakWork:'cooperate',
    breakFinale:'hold_group',helperAttackPolicy:'open',captainSupport:'hold_position'},
  protect:{effort:'conserve',chase:'selective',attack:'none',breakWork:'cooperate',
    breakFinale:'hold_group',helperAttackPolicy:'open',captainSupport:'hold_position'},
  aggressive:{effort:'hard',chase:'all',attack:'repeated',breakWork:'cooperate',
    breakFinale:'hold_group',helperAttackPolicy:'open',captainSupport:'hold_position'},
});

function setting(value,allowed,label){
  if(!allowed.has(value))throw new Error(`Invalid ${label}.`);
  return value;
}
function onlyKeys(value,allowed,label){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))
    throw new Error(`Invalid ${label} fields.`);
}
function attackRider(value,roster){
  if(value!==null&&!roster.has(value))throw new Error('The planned attacker must belong to the lineup.');
  return value;
}
function breakAttackRider(value,roster){
  if(typeof value!=='string'||!roster.has(value))
    throw new Error('A planned break attack needs a rider in the lineup.');
  return value;
}

export function normalizeOrders(input,{riderIds,distanceKm,keypoints=[]}){
  onlyKeys(input,['captainId','roadCaptainId','backupId','helperIds','preset','baseline','phases','contingency','breakResponse','forwardResponse','version'],'order');
  if(input.version!==undefined&&input.version!==2)throw new Error('Unknown order version.');
  if(!Array.isArray(riderIds)||riderIds.length!==8||new Set(riderIds).size!==8)
    throw new Error('Orders require eight different riders.');
  if(!Number.isInteger(distanceKm)||distanceKm<20||distanceKm>400)throw new Error('Invalid route distance.');
  const roster=new Set(riderIds),captainId=input?.captainId,roadCaptainId=input?.roadCaptainId??captainId;
  if(!roster.has(captainId)||!roster.has(roadCaptainId))throw new Error('Both captains must belong to the lineup.');
  const preset=input?.preset??'balanced';
  if(!Object.hasOwn(PRESETS,preset))throw new Error('Unknown order preset.');
  const baseline={...PRESETS[preset]};
  if(input?.baseline){
    onlyKeys(input.baseline,['effort','chase','attack','attackRiderId','breakWork','breakFinale','helperAttackPolicy','captainSupport'],'baseline');
    if(input.baseline.effort!==undefined)baseline.effort=setting(input.baseline.effort,EFFORTS,'effort');
    if(input.baseline.chase!==undefined)baseline.chase=setting(input.baseline.chase,CHASE,'chase rule');
    if(input.baseline.attack!==undefined)baseline.attack=setting(input.baseline.attack,ATTACK,'attack rule');
    if(input.baseline.attackRiderId!==undefined)baseline.attackRiderId=attackRider(input.baseline.attackRiderId,roster);
    if(input.baseline.breakWork!==undefined)baseline.breakWork=setting(input.baseline.breakWork,BREAK_WORK,'break work');
    if(input.baseline.breakFinale!==undefined)
      baseline.breakFinale=setting(input.baseline.breakFinale,BREAK_FINALE,'break finale');
    if(input.baseline.helperAttackPolicy!==undefined)
      baseline.helperAttackPolicy=setting(input.baseline.helperAttackPolicy,
        HELPER_ATTACK_POLICIES,'helper attack policy');
    if(input.baseline.captainSupport!==undefined)
      baseline.captainSupport=setting(input.baseline.captainSupport,CAPTAIN_SUPPORT,'captain support');
  }
  const points=new Set(keypoints.map(point=>Number(point.km)));
  const phases=(input?.phases??[]).map(phase=>{
    onlyKeys(phase,['atKm','effort','chase','attack','attackRiderId','breakAttackRiderId','breakWork','breakFinale','helperAttackPolicy','captainSupport'],'phase');
    const atKm=Number(phase?.atKm);
    if(!Number.isInteger(atKm)||atKm<=0||atKm>=distanceKm||atKm%10!==0&&!points.has(atKm))
      throw new Error('Phase changes must be at a 10 km marker or a route keypoint.');
    if(phase.effort===undefined&&phase.chase===undefined&&phase.attack===undefined&&
      phase.attackRiderId===undefined&&phase.breakAttackRiderId===undefined&&
      phase.breakWork===undefined&&phase.breakFinale===undefined&&
      phase.helperAttackPolicy===undefined&&phase.captainSupport===undefined)
      throw new Error('A phase must change an order.');
    return {atKm,...(phase.effort===undefined?{}:{effort:setting(phase.effort,EFFORTS,'effort')}),
      ...(phase.chase===undefined?{}:{chase:setting(phase.chase,CHASE,'chase rule')}),
      ...(phase.attack===undefined?{}:{attack:setting(phase.attack,ATTACK,'attack rule')}),
      ...(phase.attackRiderId===undefined?{}:{attackRiderId:attackRider(phase.attackRiderId,roster)}),
      ...(phase.breakAttackRiderId===undefined?{}:{breakAttackRiderId:breakAttackRider(phase.breakAttackRiderId,roster)}),
      ...(phase.breakWork===undefined?{}:{breakWork:setting(phase.breakWork,BREAK_WORK,'break work')}),
      ...(phase.breakFinale===undefined?{}:{breakFinale:setting(phase.breakFinale,BREAK_FINALE,'break finale')}),
      ...(phase.helperAttackPolicy===undefined?{}:{helperAttackPolicy:setting(
        phase.helperAttackPolicy,HELPER_ATTACK_POLICIES,'helper attack policy')}),
      ...(phase.captainSupport===undefined?{}:{captainSupport:setting(phase.captainSupport,CAPTAIN_SUPPORT,'captain support')})};
  });
  phases.sort((a,b)=>a.atKm-b.atKm);
  if(phases.some((phase,index)=>index&&phase.atKm===phases[index-1].atKm))throw new Error('One order phase per marker.');
  const helperIds=input?.helperIds??riderIds.filter(id=>id!==captainId&&id!==roadCaptainId);
  if(!Array.isArray(helperIds)||new Set(helperIds).size!==helperIds.length||helperIds.some(id=>!roster.has(id)||id===captainId||id===roadCaptainId))
    throw new Error('Helpers must be distinct lineup riders other than the captains.');
  const backupId=input?.backupId??null;
  if(backupId!==null&&(!roster.has(backupId)||backupId===captainId))throw new Error('The backup leader must be another lineup rider.');
  const contingency=setting(input?.contingency??'hold_plan',CONTINGENCIES,'contingency');
  const breakResponse=setting(input?.breakResponse??'hold_plan',BREAK_RESPONSES,'break response');
  const forwardResponse=setting(input?.forwardResponse??'protect_forward',
    FORWARD_RESPONSES,'forward response');
  if(contingency==='backup_if_captain_exhausted'&&!backupId)throw new Error('A backup leader is required for this contingency.');
  return {version:2,captainId,roadCaptainId,backupId,helperIds:[...helperIds],preset,baseline,phases,
    contingency,breakResponse,forwardResponse};
}

export function orderAt(orders,km){
  let current={...orders.baseline};
  for(const phase of orders.phases){if(phase.atKm>km)break;current={...current,...('effort'in phase?{effort:phase.effort}:{}),...('chase'in phase?{chase:phase.chase}:{}),...('attack'in phase?{attack:phase.attack}:{}),...('attackRiderId'in phase?{attackRiderId:phase.attackRiderId}:{}),...('breakWork'in phase?{breakWork:phase.breakWork}:{}),...('breakFinale'in phase?{breakFinale:phase.breakFinale}:{}),...('helperAttackPolicy'in phase?{helperAttackPolicy:phase.helperAttackPolicy}:{}),...('captainSupport'in phase?{captainSupport:phase.captainSupport}:{})};}
  return current;
}

// A split from a break is a one-off committed move at the first kilometre
// after its marker, never a persistent automatic attack rule.
export function breakAttackAt(orders,km){
  if(!Number.isInteger(km)||km<1)throw new Error('Invalid break attack kilometre.');
  return orders.phases.find(phase=>phase.atKm===km-1)?.breakAttackRiderId??null;
}
