import { AuthError } from "../auth/policy.mjs";

/** Keep missed reveals visible after the tactics deadline, when the due-reveal
 * RPC intentionally stops selecting them. Only the service cron calls this. */
export async function overdueDivisionReveals(db, now = new Date().toISOString()) {
  const { data: events, error: eventError } = await db.from("events")
    .select("id")
    .eq("kind", "one_day").eq("status", "OPEN")
    .in("calendar_source", ["UCI", "PELOTONIA"])
    .not("tactics_deadline", "is", null)
    .lte("tactics_deadline", now)
    .order("tactics_deadline")
    .limit(101);
  if (eventError) throw new AuthError("REVEAL_HEALTH_UNAVAILABLE",
    "Could not inspect overdue division reveals.", 503);
  if (!events?.length) return [];
  // Do not report a healthy run if the scan was truncated.
  if (events.length > 100) throw new AuthError("REVEAL_HEALTH_TRUNCATED",
    "Overdue division scan exceeded its limit.", 503);
  const ids = events.map(event => event.id);
  const { data: reveals, error: revealError } = await db.from("recovery_division_reveals")
    .select("event_id").in("event_id", ids);
  if (revealError) throw new AuthError("REVEAL_HEALTH_UNAVAILABLE",
    "Could not inspect saved division reveals.", 503);
  const saved = new Set((reveals ?? []).map(reveal => reveal.event_id));
  return ids.filter(id => !saved.has(id));
}
