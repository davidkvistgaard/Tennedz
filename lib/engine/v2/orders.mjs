const EFFORTS=new Set(['conserve','steady','hard']);
const CHASE=new Set(['ignore','selective','all']);
const ATTACK=new Set(['none','selective','repeated']);
const CONTINGENCIES=new Set(['hold_plan','backup_if_captain_exhausted']);
const PRESETS=Object.freeze({
  balanced:{effort:'steady',chase:'selective',attack:'selective'},
  protect:{effort:'conserve',chase:'selective',attack:'none'},
  aggressive:{effort:'hard',chase:'all',attack:'repeated'},
});

function setting(value,allowed,label){
  if(!allowed.has(value))throw new Error(`Invalid ${label}.`);
  return value;
}
function onlyKeys(value,allowed,label){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))
    throw new Error(`Invalid ${label} fields.`);
}

export function normalizeOrders(input,{riderIds,distanceKm,keypoints=[]}){
  onlyKeys(input,['captainId','roadCaptainId','backupId','helperIds','preset','baseline','phases','contingency','version'],'order');
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
    onlyKeys(input.baseline,['effort','chase','attack'],'baseline');
    if(input.baseline.effort!==undefined)baseline.effort=setting(input.baseline.effort,EFFORTS,'effort');
    if(input.baseline.chase!==undefined)baseline.chase=setting(input.baseline.chase,CHASE,'chase rule');
    if(input.baseline.attack!==undefined)baseline.attack=setting(input.baseline.attack,ATTACK,'attack rule');
  }
  const points=new Set(keypoints.map(point=>Number(point.km)));
  const phases=(input?.phases??[]).map(phase=>{
    onlyKeys(phase,['atKm','effort','chase','attack'],'phase');
    const atKm=Number(phase?.atKm);
    if(!Number.isInteger(atKm)||atKm<=0||atKm>=distanceKm||atKm%10!==0&&!points.has(atKm))
      throw new Error('Phase changes must be at a 10 km marker or a route keypoint.');
    if(phase.effort===undefined&&phase.chase===undefined&&phase.attack===undefined)throw new Error('A phase must change an order.');
    return {atKm,...(phase.effort===undefined?{}:{effort:setting(phase.effort,EFFORTS,'effort')}),
      ...(phase.chase===undefined?{}:{chase:setting(phase.chase,CHASE,'chase rule')}),
      ...(phase.attack===undefined?{}:{attack:setting(phase.attack,ATTACK,'attack rule')})};
  });
  phases.sort((a,b)=>a.atKm-b.atKm);
  if(phases.some((phase,index)=>index&&phase.atKm===phases[index-1].atKm))throw new Error('One order phase per marker.');
  const helperIds=input?.helperIds??riderIds.filter(id=>id!==captainId&&id!==roadCaptainId);
  if(!Array.isArray(helperIds)||new Set(helperIds).size!==helperIds.length||helperIds.some(id=>!roster.has(id)||id===captainId||id===roadCaptainId))
    throw new Error('Helpers must be distinct lineup riders other than the captains.');
  const backupId=input?.backupId??null;
  if(backupId!==null&&(!roster.has(backupId)||backupId===captainId))throw new Error('The backup leader must be another lineup rider.');
  const contingency=setting(input?.contingency??'hold_plan',CONTINGENCIES,'contingency');
  if(contingency==='backup_if_captain_exhausted'&&!backupId)throw new Error('A backup leader is required for this contingency.');
  return {version:2,captainId,roadCaptainId,backupId,helperIds:[...helperIds],preset,baseline,phases,contingency};
}

export function orderAt(orders,km){
  let current={...orders.baseline};
  for(const phase of orders.phases){if(phase.atKm>km)break;current={...current,...('effort'in phase?{effort:phase.effort}:{}),...('chase'in phase?{chase:phase.chase}:{}),...('attack'in phase?{attack:phase.attack}:{})};}
  return current;
}
