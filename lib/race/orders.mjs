export const PLANS = {balanced:"Balanced racing", captain:"Ride for the captain", breakaway:"Chase a breakaway", conserve:"Save energy"};
export const ROLES = {free:"Free rider", helper:"Support the captain", attacker:"Seek a breakaway"};
export const EFFORTS = {careful:"Careful", balanced:"Balanced", aggressive:"Aggressive"};
export function defaultOrders(ids, captain) {
  return {version:1,plan:"balanced",riders:Object.fromEntries(ids.map(id=>[id,{role:id===captain?"captain":"free",effort:"balanced"}]))};
}
export function validateOrders(value, ids, captain) {
  if(value == null) return defaultOrders(ids,captain);
  const fail=()=>{throw new Error("Choose a valid race plan and orders for each of your eight riders.");};
  if(!value || value.version!==1 || !Object.hasOwn(PLANS,value.plan) || !value.riders || typeof value.riders!=="object" || Array.isArray(value.riders)) return fail();
  if(Object.keys(value).some(k=>!["version","plan","riders"].includes(k)) || Object.keys(value.riders).length!==ids.length) return fail();
  const normalized=defaultOrders(ids,captain);normalized.plan=value.plan;
  for(const id of ids){
    const order=value.riders[id];
    if(!order || Object.keys(order).some(k=>!["role","effort"].includes(k)) || !Object.hasOwn(EFFORTS,order.effort) || (id===captain?order.role!=="captain":!Object.hasOwn(ROLES,order.role))) return fail();
    normalized.riders[id]={role:order.role,effort:order.effort};
  }
  return normalized;
}
export function planOrders(ids,captain,plan){
  const orders=defaultOrders(ids,captain);orders.plan=plan;
  const attacker=ids.find(id=>id!==captain);
  for(const id of ids){if(id!==captain)orders.riders[id].role=plan==="captain"?"helper":plan==="breakaway"&&id===attacker?"attacker":"free";}
  return orders;
}
// Reconcile a draft after changing selection/captain; server validation never repairs invalid input.
export function draftOrders(value,ids,captain){
  const next=planOrders(ids,captain,value?.plan || "balanced");
  for(const id of ids){const prior=value?.riders?.[id];if(prior)next.riders[id]={role:id===captain?"captain":prior.role==="captain"?"free":prior.role,effort:prior.effort};}
  return next;
}
export function tacticalEffects(orders,riders,captain){
  const helpers=riders.filter(r=>orders.riders[r.id].role==="helper");
  const support=Math.min(.06,helpers.reduce((sum,r)=>sum+(Number(r.endurance??0)+Number(r.strength??0))/20000,0))*(orders.plan==="captain"?1.4:1);
  return Object.fromEntries(riders.map(r=>{
    const o=orders.riders[r.id];
    const effort=o.effort==="aggressive"?1.025:o.effort==="careful"?.975:1;
    const saving=orders.plan==="conserve";
    const helper=o.role==="helper";
    return [r.id,{role:o.role,effort:o.effort,plan:orders.plan,
      pace:effort*(saving?.98:1)*(helper?.98:1)*(r.id===captain?1+support:1),
      finish:effort*(saving?.96:1)*(helper?.94:1)*(r.id===captain?1+support:1),
      attackWeight:saving||helper?0:o.role==="attacker"?(orders.plan==="breakaway"?6:4):orders.plan==="captain"?0:1,
      fatigueDelta:(o.effort==="aggressive"?5:o.effort==="careful"?-4:0)+(saving?-5:0)+(helper||o.role==="attacker"?3:0)}];
  }));
}
