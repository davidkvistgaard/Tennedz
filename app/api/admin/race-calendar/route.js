import { NextResponse } from "next/server";
import {
  protectedRoute,
  requireGameWrites,
  databaseClient,
} from "../../../../lib/auth/server";
import { AuthError } from "../../../../lib/auth/policy.mjs";
import { rpc, uuid } from "../../../../lib/race/server";
import {
  calendarRequest,
  routeTemplates,
} from "../../../../lib/race/templates.mjs";

export const GET = protectedRoute(
  async () => NextResponse.json({ ok: true, templates: routeTemplates,
    two_phase_available:process.env.PELOTONIA_AUTOPILOT_ENABLED==="true" }),
  { admin: true },
);
export const POST = protectedRoute(
  async (req, ctx, auth) => {
    requireGameWrites();
    const input = await req.json().catch(() => ({}));
    const id = uuid(input.request_id);
    let definition;
    try {
      definition = calendarRequest(input);
    } catch (e) {
      throw new AuthError("INVALID_CALENDAR", e.message, 400);
    }
    if(definition.tactics_deadline&&process.env.PELOTONIA_AUTOPILOT_ENABLED!=="true")
      throw new AuthError("TWO_PHASE_UNAVAILABLE",
        "Two-phase races require the automatic entry scan.",409);
    const scheduledRpc=process.env.PELOTONIA_AUTOPILOT_ENABLED==="true"
      ?"recovery_create_scheduled_race_day_safe":"recovery_create_scheduled_race_day";
    const result = await rpc(databaseClient(),
      definition.tactics_deadline?"recovery_create_two_phase_race_day":
        definition.scheduled_at?scheduledRpc:"recovery_create_race_day", {
      p_request: id,
      p_user: auth.user.id,
      p_definition: definition,
    });
    return NextResponse.json(result);
  },
  { admin: true },
);
