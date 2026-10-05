import { NextResponse } from "next/server";
import { protectedRoute, requireGameWrites } from "../../../../lib/auth/server";
import { assertTeamId, AuthError } from "../../../../lib/auth/policy.mjs";
import { rpc, uuid } from "../../../../lib/race/server";
import { validateOrders } from "../../../../lib/race/orders.mjs";

// Only previously entered teams in an opted-in, revealed race can use this.
// The database checks both phase boundaries and never charges an entry fee.
export const POST = protectedRoute(async (req, context, auth) => {
  requireGameWrites();
  const body = await req.json().catch(() => ({}));
  assertTeamId(body.team_id, auth.team.id);
  if (!Array.isArray(body.selected_riders) || body.selected_riders.length !== 8) {
    throw new AuthError("INVALID_LINEUP", "Select eight riders.", 400);
  }
  let orders;
  try {
    orders = validateOrders(body.orders, body.selected_riders, body.captain_id);
  } catch (error) {
    throw new AuthError("INVALID_ORDERS", error.message, 400);
  }
  const result = await rpc(auth.db, "recovery_edit_revealed_tactics", {
    p_user: auth.user.id,
    p_event: uuid(body.event_id),
    p_riders: body.selected_riders.map(uuid),
    p_captain: uuid(body.captain_id),
    p_orders: orders,
  });
  return NextResponse.json(result);
});
