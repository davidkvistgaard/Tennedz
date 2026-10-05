import { NextResponse } from "next/server";
import { protectedRoute } from "../../../../lib/auth/server";
import { AuthError } from "../../../../lib/auth/policy.mjs";
import { uuid } from "../../../../lib/race/server";
import { participantRevealView } from "../../../../lib/calendar/participant-reveal.mjs";

// No opponent lineup, orders, rider data, or private tactics snapshot is read.
export const GET = protectedRoute(async (req, context, auth) => {
  const eventId = uuid(new URL(req.url).searchParams.get("event_id"));
  const { data: entry, error: entryError } = await auth.db
    .from("event_teams")
    .select("team_id")
    .eq("event_id", eventId)
    .eq("team_id", auth.team.id)
    .maybeSingle();
  if (entryError) throw new AuthError("REVEAL_UNAVAILABLE", "Could not load your division.", 503);
  if (!entry) throw new AuthError("NOT_ENTERED", "Your team has not entered this race.", 403);

  const { data: event, error: eventError } = await auth.db
    .from("events")
    .select("id,registration_deadline,tactics_deadline,scheduled_at")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError) throw new AuthError("REVEAL_UNAVAILABLE", "Could not load your division.", 503);
  if (!event?.registration_deadline || !event.tactics_deadline || !event.scheduled_at) {
    throw new AuthError("NO_TWO_PHASE_RACE", "This race has no separate division reveal.", 409);
  }

  const [{ data: assignments, error: revealError }, { data: lock, error: lockError }] =
    await Promise.all([
      auth.db.from("recovery_division_reveal_entries")
        .select("team_id,earned_points_at_lock,division_index,seed_rank")
        .eq("event_id", eventId).order("seed_rank"),
      auth.db.from("recovery_tactics_commits")
        .select("event_id").eq("event_id", eventId).maybeSingle(),
    ]);
  if (revealError || lockError) {
    throw new AuthError("REVEAL_UNAVAILABLE", "Could not load your division.", 503);
  }
  const teamNames = new Map();
  if (assignments?.length) {
    const { data: teams, error: namesError } = await auth.db.from("teams")
      .select("id,name").in("id", assignments.map((row) => row.team_id));
    if (namesError) throw new AuthError("REVEAL_UNAVAILABLE", "Could not load your division.", 503);
    for (const team of teams || []) teamNames.set(team.id, team.name);
  }
  let view;
  try {
    view = participantRevealView({ event, now: new Date().toISOString(),
      teamId: auth.team.id, assignments: assignments || [], teamNames,
      tacticsCommitted: Boolean(lock) });
  } catch {
    throw new AuthError("REVEAL_UNAVAILABLE", "Could not load your division.", 503);
  }
  return NextResponse.json({ ok: true, ...view });
});
