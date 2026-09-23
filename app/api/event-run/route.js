import { NextResponse } from "next/server";
import { protectedRoute } from "../../../lib/auth/server";
import { AuthError } from "../../../lib/auth/policy.mjs";
import { uuid } from "../../../lib/race/server";
export const GET = protectedRoute(async (req, context, auth) => {
  const url = new URL(req.url),
    id = uuid(url.searchParams.get("event_id"));
  const mine = await auth.db
    .from("event_divisions")
    .select("division_index")
    .eq("event_id", id)
    .eq("team_id", auth.team.id)
    .maybeSingle();
  if (mine.error)
    throw new AuthError(
      "RUN_UNAVAILABLE",
      "Divisionen kunne ikke hentes.",
      503,
    );
  const index = Number(
    url.searchParams.get("division_index") || mine.data?.division_index || 1,
  );
  if (!Number.isInteger(index) || index < 1)
    throw new AuthError("INVALID_DIVISION", "Ugyldig division.", 400);
  const { data, error } = await auth.db
    .from("event_division_runs")
    .select(
      "event_id,division_index,engine_version,stage_snapshot,feed,replay,created_at",
    )
    .eq("event_id", id)
    .eq("division_index", index)
    .maybeSingle();
  if (error)
    throw new AuthError(
      "RUN_UNAVAILABLE",
      "Løbsreferatet kunne ikke hentes.",
      503,
    );
  if (!data)
    throw new AuthError(
      "RUN_PENDING",
      "Denne division er ikke afviklet endnu.",
      404,
    );
  return NextResponse.json({ ok: true, run: data, team_id: auth.team.id });
});
