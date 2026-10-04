import { NextResponse } from "next/server";
import { protectedRoute, requireGameWrites } from "../../../../lib/auth/server";
import { assertTeamId, AuthError } from "../../../../lib/auth/policy.mjs";
import { rpc, uuid } from "../../../../lib/race/server";
import { validateOrders } from "../../../../lib/race/orders.mjs";
export const POST = protectedRoute(async (req,context,auth) => {
  requireGameWrites();
  const body=await req.json().catch(()=>({}));
  assertTeamId(body.team_id,auth.team.id);
  if (!Array.isArray(body.selected_riders) || body.selected_riders.length!==8) throw new AuthError("INVALID_LINEUP","Select eight riders.",400);
  let orders;
  try { orders=validateOrders(body.orders,body.selected_riders,body.captain_id); } catch(e) { throw new AuthError("INVALID_ORDERS",e.message,400); }
  const result=await rpc(auth.db,"recovery_join_event_with_orders",{p_user:auth.user.id,p_event:uuid(body.event_id),p_riders:body.selected_riders.map(uuid),p_captain:uuid(body.captain_id),p_orders:orders});
  return NextResponse.json(result);
});
export const GET = protectedRoute(async (req,context,auth) => {
  const id=uuid(new URL(req.url).searchParams.get("event_id"));
  const {data,error}=await auth.db.from("event_teams").select("selected_riders,captain_id,orders").eq("event_id",id).eq("team_id",auth.team.id).maybeSingle();
  if (error) throw new AuthError("ENTRY_UNAVAILABLE","Could not load your entry.",503);
  return NextResponse.json({ok:true,entry:data});
});
