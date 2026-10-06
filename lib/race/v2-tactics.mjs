import {normalizeOrders} from '../engine/v2/orders.mjs';

// Structural contract for a saved entry's v2 plan. Ownership, the preparation
// window, and the final tactics lock remain database responsibilities.
export function normalizeEnteredV2Orders(entry,stage,input){
  const riderIds=entry?.selected_riders;
  const captainId=entry?.captain_id;
  if(!Array.isArray(riderIds)||riderIds.length!==8||
    new Set(riderIds).size!==8||!riderIds.includes(captainId))
    throw new Error('V2 tactics need eight selected riders and an entered captain.');
  const orders=normalizeOrders(input,{riderIds,
    distanceKm:Number(stage?.distance_km),keypoints:stage?.keypoints??[]});
  if(orders.captainId!==captainId)
    throw new Error('The committed v2 captain differs from the entered captain.');
  return orders;
}
