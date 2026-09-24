import { NextResponse } from "next/server";
import { protectedRoute, requireGameWrites } from "../../../../lib/auth/server";
import { AuthError } from "../../../../lib/auth/policy.mjs";
import { executeRace, uuid } from "../../../../lib/race/server";
export const maxDuration = 60;

// A participant may request their locked race. Every sporting input comes from
// the server snapshot, and the atomic commit makes concurrent viewers harmless.
// This lets the first viewer prepare a race without paid scheduling services.
export const POST = protectedRoute(async (req, context, auth) => {
  requireGameWrites();
  const body = await req.json().catch(() => ({})),
    id = uuid(body.event_id);
  const { data, error } = await auth.db
    .from("event_teams")
    .select("team_id")
    .eq("event_id", id)
    .eq("team_id", auth.team.id)
    .maybeSingle();
  if (error)
    throw new AuthError(
      "ENTRY_UNAVAILABLE",
      "Tilmeldingen kunne ikke kontrolleres.",
      503,
    );
  if (!data)
    throw new AuthError(
      "NOT_ENTERED",
      "Dit hold er ikke tilmeldt dette løb. Det kan ses, når en deltager eller administrator har gjort løbet klar.",
      403,
    );
  const result = await executeRace(auth.db, id);
  return NextResponse.json({
    ok: true,
    already_finished: !!result.already_finished,
  });
});
