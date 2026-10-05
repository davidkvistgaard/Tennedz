import { NextResponse } from "next/server";
import { protectedRoute, requireGameWrites } from "../../../../../lib/auth/server";
import { AuthError } from "../../../../../lib/auth/policy.mjs";
import { rpc, uuid } from "../../../../../lib/race/server";

// A registered manager can retry a due reveal after the automatic-entry scan
// has completed. The RPC itself enforces the deadline and freezes ranking
// points and assignments once, under the same advisory lock as entries.
export const POST = protectedRoute(async (req, context, auth) => {
  requireGameWrites();
  const body = await req.json().catch(() => ({}));
  const eventId = uuid(body.event_id);
  const { data: entry, error } = await auth.db.from("event_teams")
    .select("team_id").eq("event_id", eventId)
    .eq("team_id", auth.team.id).maybeSingle();
  if (error) throw new AuthError("REVEAL_UNAVAILABLE", "Could not check your entry.", 503);
  if (!entry) throw new AuthError("NOT_ENTERED", "Your team has not entered this race.", 403);
  const reveal = await rpc(auth.db, "recovery_commit_division_reveal", { p_event: eventId });
  return NextResponse.json({ ok: true, already_revealed: !!reveal.alreadyRevealed });
});
