import { NextResponse } from 'next/server';
import { protectedRoute, requireGameWrites } from '../../../lib/auth/server';
import { AuthError } from '../../../lib/auth/policy.mjs';
import { publicRiderFields } from '../../../lib/onboarding/public-rider.mjs';
import { MarketInputError, marketAction, marketFilters } from '../../../lib/marketplace/validation.mjs';

export const dynamic='force-dynamic';
function inputError(error) {
  if (error instanceof MarketInputError)
    throw new AuthError('INVALID_MARKET_INPUT',error.message,400);
  throw error;
}
function databaseError(error) {
  if (!error) return;
  const status=Number(String(error.code||'').slice(2));
  if (/^PT(400|403|404|409)$/.test(error.code||''))
    throw new AuthError('MARKET_CONFLICT',error.message,status);
  throw new AuthError('MARKET_UNAVAILABLE','The rider market is unavailable. Please try again.',503);
}
async function riderMap(db,ids) {
  if (!ids.length) return new Map();
  const {data,error}=await db.from('riders').select(publicRiderFields).in('id',ids);
  databaseError(error);
  return new Map((data||[]).map(rider=>[rider.id,rider]));
}
async function getHandler(req,_context,{team,db}) {
  let filters;
  try { filters=marketFilters(new URL(req.url).searchParams); } catch(error) { inputError(error); }
  const [search,mine]=await Promise.all([
    db.rpc('rider_market_search',filters),
    db.from('rider_market_listings')
      .select('id,rider_id,seller_team_id,price,created_at')
      .eq('seller_team_id',team.id).eq('status','active')
      .order('created_at',{ascending:false}).limit(100),
  ]);
  databaseError(search.error); databaseError(mine.error);
  const ids=[...new Set([...(search.data||[]),...(mine.data||[])].map(row=>row.rider_id))];
  const riders=await riderMap(db,ids);
  const items=(search.data||[]).map(row=>({...row,rider:riders.get(row.rider_id)}))
    .filter(row=>row.rider);
  const myListings=(mine.data||[]).map(row=>({...row,rider:riders.get(row.rider_id)}))
    .filter(row=>row.rider);
  return NextResponse.json({ok:true,items,my_listings:myListings,
    has_more:items.length===50,coins:team.coins});
}
async function postHandler(req,_context,{user,db}) {
  requireGameWrites();
  let action;
  try { action=marketAction(await req.json()); } catch(error) {
    if (error instanceof SyntaxError) throw new AuthError('INVALID_MARKET_INPUT','Invalid market request.',400);
    inputError(error);
  }
  const rpc=action.action==='list'?'rider_market_list':
    action.action==='cancel'?'rider_market_cancel':'rider_market_buy';
  const args=action.action==='list'
    ? {p_user:user.id,p_rider:action.riderId,p_price:action.price}
    : {p_user:user.id,p_listing:action.listingId};
  const {data,error}=await db.rpc(rpc,args);
  databaseError(error);
  return NextResponse.json({ok:true,id:data??action.listingId});
}
export const GET=protectedRoute(getHandler);
export const POST=protectedRoute(postHandler);
