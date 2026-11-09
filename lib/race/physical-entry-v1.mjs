import {normalizeOrders} from '../engine/v2/orders.mjs';
import {CLUB_PALETTES,KIT_PATTERNS,defaultKit,
  validKitSelection} from '../riders/club-kit.mjs';

export const PHYSICAL_ENTRY_REQUEST_VERSION='physical-entry-request-v1';
const GOALS=new Set(['sprint_finish','summit_attack',
  'break_stage','none']);

// Persist exactly the manager's selected lineup, normalized order and stake.
// The game-owned kit is read separately; the database allocates race bibs.
export function preparePhysicalEntryV1({body,stage,team,
  savedKit=null}){
  const ids=body?.selected_riders;
  const order=body?.orders;
  const stake=body?.stake;
  const kit=savedKit??defaultKit(team?.id);
  if(body?.version!==PHYSICAL_ENTRY_REQUEST_VERSION||
    !Array.isArray(ids)||ids.length!==8||
    new Set(ids).size!==8||
    !ids.includes(body.captain_id)||
    !team?.id||!team?.name||
    !Number.isInteger(stage?.distance_km)||
    stage.distance_km<20||stage.distance_km>400||
    !order||typeof order!=='object'||Array.isArray(order)||
    order.captainId!==body.captain_id||
    !order.roadCaptainId||!Array.isArray(order.helperIds)||
    !order.baseline||
    !['effort','attack','chase','frontWork'].every(key=>
      Object.hasOwn(order.baseline,key))||
    !stake||typeof stake!=='object'||Array.isArray(stake)||
    Object.keys(stake).sort().join(',')!==
      'sportingCaptainId,sportingGoal'||
    !GOALS.has(stake.sportingGoal)||
    !ids.includes(stake.sportingCaptainId)||
    !validKitSelection(kit,team.id))
    throw new Error('A physical race entry needs eight riders, explicit orders, goal and saved kit.');
  const normalized=normalizeOrders(order,
    {riderIds:ids,distanceKm:stage.distance_km,
      keypoints:stage.keypoints??[],allowFrontWork:true,
      allowNamedFrontWorker:true});
  const palette=CLUB_PALETTES[kit.palette];
  const pattern=KIT_PATTERNS[kit.pattern];
  return {orders:normalized,stake:{...stake},
    teamStyle:{id:team.id,name:team.name,
      color:palette.primary,accent:palette.accent,
      pattern:'paths',paths:[...pattern.paths]}};
}
