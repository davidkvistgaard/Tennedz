import { NextResponse } from "next/server";
import { protectedRoute, requireGameWrites, databaseClient } from "../../../../../lib/auth/server";
import { AuthError } from "../../../../../lib/auth/policy.mjs";
import { rpc, uuid } from "../../../../../lib/race/server";

export const POST = protectedRoute(async (req, context, auth) => {
  requireGameWrites();
  if (process.env.PELOTONIA_AUTOPILOT_ENABLED !== "true")
    throw new AuthError("TWO_PHASE_UNAVAILABLE", "Two-phase races are disabled.", 503);
  const body = await req.json().catch(() => ({}));
  const eventId = uuid(body.event_id);
  const result = await rpc(databaseClient(), "recovery_void_incomplete_two_phase_race", {
    p_event: eventId, p_user: auth.user.id,
  });
  return NextResponse.json(result);
}, { admin: true });
