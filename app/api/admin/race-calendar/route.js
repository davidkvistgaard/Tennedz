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
  async () => NextResponse.json({ ok: true, templates: routeTemplates }),
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
    const result = await rpc(databaseClient(), "recovery_create_race_day", {
      p_request: id,
      p_user: auth.user.id,
      p_definition: definition,
    });
    return NextResponse.json(result);
  },
  { admin: true },
);
