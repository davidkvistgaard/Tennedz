import { protectedRoute } from "../../../lib/auth/server";
import { NextResponse } from "next/server";
import { teamSizeFor } from "../../../lib/calendar/config.mjs";
import { pointsForResult } from "../../../lib/calendar/points.mjs";

// Upcoming entries must not disappear behind an ever-growing race archive.
// Read each bucket independently, returning only public event metadata.
const fields =
  "id,name,kind,gender,country_code,stage_profile_id,entry_fee,status,deadline,calendar_source,race_tier,race_team_size,scheduled_at,source_date,calendar_pair_id";
async function handler(req, context, auth) {
  const url = new URL(req.url);
  const requested = Number(url.searchParams.get("limit") ?? 50);
  if (!Number.isInteger(requested) || requested < 1 || requested > 100)
    return NextResponse.json(
      { ok: false, error: "The race count must be a whole number between 1 and 100." },
      { status: 400 },
    );
  const now = new Date().toISOString();
  const [upcoming, pending, finished] = await Promise.all([
    auth.db
      .from("events")
      .select(fields)
      .eq("status", "OPEN")
      .gt("deadline", now)
      .order("deadline")
      .limit(requested),
    auth.db
      .from("events")
      .select(fields)
      .eq("status", "OPEN")
      .lte("deadline", now)
      .order("deadline", { ascending: false })
      .limit(requested),
    auth.db
      .from("events")
      .select(fields)
      .neq("status", "OPEN")
      .order("deadline", { ascending: false })
      .limit(requested),
  ]);
  if (upcoming.error || pending.error || finished.error)
    throw new Error("Event query failed");
  const all = [...upcoming.data, ...pending.data, ...finished.data];
  const ids = all.map(event => event.id);
  const {data: entries, error: entryError} = ids.length
    ? await auth.db.from("event_teams").select("event_id,selected_riders,captain_id")
      .eq("team_id", auth.team.id).in("event_id", ids)
    : {data: [], error: null};
  if (entryError) throw new Error("Entry query failed");
  const byEvent = new Map(entries.map(entry => [entry.event_id, entry]));
  const events = all.map(event => {
    const entry = byEvent.get(event.id);
    const teamSize = teamSizeFor(event);
    return {...event, team_size: teamSize,
      team_count: entry?.selected_riders?.length ?? 0,
      team_ready: !!entry && entry.selected_riders?.length === teamSize &&
        entry.selected_riders.includes(entry.captain_id),
      winner_points: event.race_tier
        ? pointsForResult({tier: event.race_tier, resultType: event.kind === "one_day" ? "ONE_DAY" : "GC", placing: 1})
        : null};
  });
  return NextResponse.json({
    ok: true,
    events,
    server_time: now,
  });
}
export const GET = protectedRoute(handler);
