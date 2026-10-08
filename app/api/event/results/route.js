import { protectedRoute } from "../../../../lib/auth/server";
import { AuthError } from "../../../../lib/auth/policy.mjs";
import { uuid } from "../../../../lib/race/server";
import { NextResponse } from "next/server";
export const GET = protectedRoute(async (req, context, auth) => {
  const url = new URL(req.url),
    event_id = uuid(url.searchParams.get("event_id")),
    division_index = Number(url.searchParams.get("division_index") || 1);
  if (
    !Number.isInteger(division_index) ||
    division_index < 1 ||
    division_index > 400
  )
    throw new AuthError("INVALID_DIVISION", "Invalid division.", 400);
  const [event, teams, riders] = await Promise.all([
    auth.db
      .from("events")
      .select("id,name,status")
      .eq("id", event_id)
      .maybeSingle(),
    auth.db
      .from("event_team_results")
      .select(
        "team_id,division_index,total_divisions,position,time_sec,points,multiplier,teams(name)",
      )
      .eq("event_id", event_id)
      .eq("division_index", division_index)
      .order("position")
      .limit(20),
    auth.db
      .from("event_rider_results")
      .select(
        "rider_id,team_id,position,time_sec,points,multiplier,riders(name),teams(name)",
      )
      .eq("event_id", event_id)
      .eq("division_index", division_index)
      .order("position")
      .limit(160),
  ]);
  if (event.error || teams.error || riders.error)
    throw new AuthError(
      "RESULT_UNAVAILABLE",
      "Could not load the result. Please try again.",
      503,
    );
  if (!event.data)
    throw new AuthError("EVENT_NOT_FOUND", "Race not found.", 404);
  return NextResponse.json({
    ok: true,
    event: event.data,
    division_index,
    total_divisions: teams.data[0]?.total_divisions || 1,
    teams: teams.data,
    riders: riders.data,
  });
});
