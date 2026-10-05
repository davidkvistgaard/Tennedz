import { NextResponse } from "next/server";
import { protectedRoute } from "../../../../lib/auth/server";
import { AuthError } from "../../../../lib/auth/policy.mjs";
import { uuid } from "../../../../lib/race/server";

export const GET = protectedRoute(async (req, context, auth) => {
  const params = new URL(req.url).searchParams;
  const eventId = uuid(params.get("event_id"));
  if (params.has("team_id") && params.get("team_id") !== auth.team.id)
    throw new AuthError("ACCESS_DENIED", "Access denied.", 403);

  const { data, error } = await auth.db
    .from("event_divisions")
    .select("division_index,total_divisions,team_id")
    .eq("event_id", eventId);
  if (error)
    throw new AuthError(
      "DIVISIONS_UNAVAILABLE",
      "Could not load the divisions. Please try again.",
      503,
    );

  const counts = new Map();
  let totalDivisions = 1;
  let myDivision = null;
  for (const row of data || []) {
    const index = Number(row.division_index);
    counts.set(index, (counts.get(index) || 0) + 1);
    totalDivisions = Number(row.total_divisions ?? totalDivisions);
    if (row.team_id === auth.team.id) myDivision = index;
  }
  const divisions = [...counts]
    .map(([division_index, team_count]) => ({ division_index, team_count }))
    .sort((a, b) => a.division_index - b.division_index);
  return NextResponse.json({
    ok: true,
    total_divisions: totalDivisions,
    divisions,
    my_division: myDivision,
  });
});
